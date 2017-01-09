const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

// *************************************
//                  app
// *************************************

const app = express();


// *************************************
//              middlewares
// *************************************

// log requests with response status code
app.use(function(req, res, next) {
  res.on('finish', () => console.log('Request: ' + res.statusCode + ' - ' + req.url));
  next();
});

// serve some of the files without session lookup
const early_router = express.Router();
app.use(early_router);

// setup request content processing, session handling
app.use(bodyParser.json());

const router = express.Router();
app.use(router);


// *************************************
//                routes
// *************************************

// static file routing
const static_files = express.static(path.join(__dirname, 'static/'));

// Api calls must be protected by checking the calling users permissions. Permission handling is omitted here for
// simplicity.
router.use('/api',
  require('./app.api')()
);

// At last, serve all static files. This is the right place to check if the user is logged in by the idp, and redirect
// if not.
router.use(
  static_files
);

router.get('/', (req, res) => res.redirect('/login.html'));
module.exports = app;
