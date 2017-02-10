const express = require('express');
const db = require('node-localdb');
const crypto = require('crypto');
const rp = require('request-promise-native');

// These come from your config file and are used for authenticating administrative calls:
const AdminKey = '{{ZkitSdk.AdminKey}}';
const AdminUId = '{{ZkitSdk.AdminUserId}}';
const ApiBase = '{{ZkitSdk.ApiBase}}/';
const TenantRoot = '{{ZkitSdk.TenantRoot.length === 0 ? "" : ZkitSdk.TenantRoot.substr(1) + "/"}}';

/*
    Called by init-user-reg, this initiates the user registration flow
    This endpoint on the server returns an object containing:
    UserId: This is the new user's id, used for operations like tresor sharing. Uniquely identifies the new user.
    RegSessionId: This is a public information that identifies this registration process.
    RegSessionVerifier: This is a server side secret, that should never touch the client device. Used during validation.
*/
function initUserRegistration(){
  return authorizedCall('api/v4/admin/user/init-user-registration', { }); // we need to make this a post
}

/*
    Called by finished-registration, in most real applications this is called later after an out-of-band validation.
    This server call will enable the user: now it can be used to log in.
    The parameters are described above: the server gets them from the initUserRegistration call, and will need to be
    stored on the application server until validation.
    The regValidationVerifier is returned by the sdk registration call, and is sent to and stored on the app server.
*/
function validateUser(id, regSessionId, regSessionVerifier, regValidationVerifier){
  return authorizedCall('api/v4/admin/user/validate-user-registration', {
    RegSessionId: regSessionId,
    RegSessionVerifier: regSessionVerifier,
    RegValidationVerifier: regValidationVerifier,
    UserId: id
  });
}

/*
    Called by new-tresor api call
    This method is used to commit the tresor creation operation, before it the tresor is unusable.
    This provides control over the flow of information in your application and serves to synchronize the application and
    the tenant database
 */
function approveTresorCreation(tresorId) {
  return authorizedCall('api/v4/admin/tresor/approve-tresor-creation', {TresorId: tresorId});
}

/*
    Called by shared-tresor
    This method is used to commit the share operation, before approval, the share has no effect on the database and on
    the tresor data downloaded by other users. After approval the tresor changes and the invited user can now decrypt
    data encrypted by this tresor.
    This provides control over the flow of information in your application and serves to synchronize the application and
    the tenant database
 */
function approveShare(inviteId) {
  return authorizedCall('api/v4/admin/tresor/approve-share?inviteId=' + inviteId, { OperationId: inviteId });
}


// Concatenates the headers into a canonical format used to sign the request
function getHeaderStringToHash(verb, url, headers, hmacHeaders) {
  return verb + '\n' + url + '\n' + hmacHeaders.map(key => key + ':' + headers[key]).join('\n');
}

// Calculates the necessary headers for authentication. The exact definitions and a detailed guide on this type of
// authentication can be found in the in Chapter 5.1 of the provided documentation.
function adminPostAuth(url, contentBuffer) {
  // Format ISO8601 with no milliseconds
  const date = new Date().toISOString().substr(0, 19) + 'Z';
  const headers = {
    'UserId': AdminUId,
    'TresoritDate': date,
    'Content-Type': 'application/json',
  };

  if (contentBuffer)
    headers['Content-SHA256'] = sha256hex(contentBuffer);

  const hmacHeaders = Object.keys(headers);
  hmacHeaders.push('HMACHeaders');
  headers['HMACHeaders'] = hmacHeaders.join(',');

  const headerStringToHash = getHeaderStringToHash(contentBuffer ? 'POST' : 'GET', url, headers, hmacHeaders);
  headers['Authorization'] = 'AdminKey ' + hmacSha256base64(headerStringToHash, AdminKey);
  return headers;
}

// Convenience function to call admin endpoints on the tenant server.
function authorizedCall(urlPart, contentObj) {
  urlPart = TenantRoot + urlPart;
  const contentBuffer = contentObj ? contentify(contentObj) : null;
  const headers = adminPostAuth(urlPart, contentBuffer);

  return rp({
    method: contentObj ? 'POST' : 'GET',
    uri: ApiBase + urlPart,
    headers: headers,
    body: contentBuffer,
  }).then(body => body.length > 0 ? JSON.parse(body) : {});
}

/*
    Below you can see the boilerplate code that calls the functions above.
    Most of the code below is database handling, parsing the data in the requests and some error handling.
 */
// Create simple local datastore to persist the users
const dbRegInfo = db('localdb/reg-info.json');

module.exports = function() {
  const api = express.Router();

  // Initiates a registration process. Returns a new unique userid, and some registration tokens to make the
  // registration transactional. For more information see the [7. Common flows] chapter in the documentation.
  api.post('/get-user-id',
    function (req, res, next) {
      dbRegInfo.findOne({alias: req.body.alias}).then(
        user => {
          if (user) {
            res.json({userId: user.userId});
          } else {
            res.status(404).json('User not found');
          }
        }, (err) => next(err || {})
      );
    }
  );

  // Initiates a registration process. Returns a new unique userid, and some registration tokens to make the
  // registration transactional. For more information see the [7. Common flows] chapter in the documentation.
  api.post('/init-user-reg',
    function (req, res, next) {
      // calls the initiation function
      initUserRegistration().then((initResponse) => {
        // saves both the server side secret and the client side data
        return dbRegInfo.insert({
          alias: req.body.alias,
          userId: initResponse.UserId,
          regSessionId: initResponse.RegSessionId,
          regSessionVerifier: initResponse.RegSessionVerifier
        }).then(() => {
          // returns the client side data
          res.json({
            userId: initResponse.UserId,
            regSessionId: initResponse.RegSessionId
          });
        });
      }).catch(err => next(err || {}));
    }
  );

  // This endpoint is called when a user finishes registration, and normally only stores the necessary information
  // to validate the user, but for the sake of the example it also calls the validation function immediately.
  // This is where you can for example commit the user to a more permanent database or start an
  // out of band validation process.
  api.post('/finished-registration',
    function (req, res, next) {
      dbRegInfo.findOne({ userId: req.body.userId })
        .then((regInfo) => {
          if (regInfo) {
            regInfo.regValidationVerifier = req.body.regValidationVerifier;
            dbRegInfo.update({ userId: regInfo.userId }, regInfo);
            return validateUser(
              regInfo.userId,
              regInfo.regSessionId,
              regInfo.regSessionVerifier,
              regInfo.regValidationVerifier,
              regInfo.alias
            ).then(() => res.status(200).json(null));
          } else {
            res.status(400).json({type: 'UserNotFound'});
          }
        })
        .catch(err => next(err || {}));
    }
  );

  // Creates a new tresor and stores the tresorid in the local database.
  api.post('/new-tresor',
    function (req, res, next) {
      approveTresorCreation(req.body.id).then(
        () => res.send(),
        err => next(err || {})
      );
    }
  );

  // This endpoint "commits" a sharing transaction initiated on the client side by the `zkit_sdk.shareTresor` call.
  // This is the right place to check application specific permissions, and to track the changes in tresor-user sharing
  // relations. This provides the application control over the information flow.
  api.post('/shared-tresor',
    function (req, res, next) {
      approveShare(req.body.id)
        .then(r => res.json(r).status(200))
        .catch(err => {
          console.log(err);
          next(err || {});
        });
    }
  );

  return api;
};

// Convenience functions to make the code above more concise
// Encode an object into a buffer to be sent.
function contentify(obj) {
  return new Buffer(JSON.stringify(obj));
}

// Simple hash functions
function sha256hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}
function hmacSha256base64(data, key) {
  return crypto.createHmac('sha256', new Buffer(key, 'hex')).update(data).digest('base64');
}
