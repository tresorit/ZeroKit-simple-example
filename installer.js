const fs = require('fs');
const exec = require('child_process').exec;
const path = require('path');
const vm = require('vm');

if (require.main === module) {
  if (process.argv.length < 4) {
    console.log('Usage: "node installer <tenantId> <adminKey> [hostId]"');
    return 0;
  }
  main(process.argv[2], process.argv[3], process.argv[4]);
}

module.exports = main;

function logStep(header) {
  console.log('*********************************************************************************');
  header += header.length%2 ? '' : ' ';
  const l = Math.floor((80 - header.length) / 2);
  console.log('*'.repeat(l) + ' ' + header + ' ' + '*'.repeat(l));
}

function promisify(cb) {
  return new Promise((resolve, reject) => {
    cb((err, res) => {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
}

function asyncFor(arr, body) {
  let i = 0;

  return Promise.resolve().then(() => iterate());

  function iterate() {
    if (i < arr.length) {
      let ci = i++;
      return Promise.resolve(body(arr[ci], ci, arr)).then(() => iterate());
    }
  }
}

function instantiate(context){
  const mkdirp = require('mkdirp'); // It is important to require in here, as may be done as part of this script
  const glob = require('glob');

  logStep('Instantiating template');

  return promisify(
        cb => glob(path.resolve('.', '**/*.*'),
          {ignore: [path.resolve('./node_modules/', '**/*.*'),
            path.resolve('./app/', '**/*.*')]}, cb)
    ).then(files => {
      return asyncFor(files, globFileName => {
        const fileName = path.resolve(globFileName);
        const relFile = path.relative('.', fileName);
        console.log('Processing file ' + relFile);

        const fileExt = path.extname(fileName);
        if (fileExt !== '.include') {
          return promisify(
                    cb => fs.readFile(fileName, 'utf8', cb)
                ).then(content => {
                  const processed = content.replace(/{{[^}]*?}}/g, function(x){
                    const s = x.substring(2, x.length - 2);
                    return vm.runInContext(s, context);
                  });
                  return putFile(path.resolve('./app', relFile), processed);
                });
        }
      });
    });

  function putFile(fname, contents) {
    return promisify(cb => mkdirp(path.dirname(fname), cb)).then(
      () => promisify(cb => fs.writeFile(fname, contents, 'utf8', cb))
    );
  }
}

function main(tenantId, adminKey, hostId) {
  logStep('Starting install');

  if (!hostId) {
    hostId = tenantId;
  } else {
    hostId = 'host-' + hostId;
  }

  const context = vm.createContext({
    ZkitSdk: {
      'AdminKey': adminKey,
      'AdminUserId': `admin@${tenantId}.tresorit.io`,
      'ApiBase': `https://${hostId}.api.tresorit.io`,
      'TenantRoot': hostId !== tenantId ? '/tenant-' + tenantId : '',
      'FrameOrigin': `https://${hostId}.api.tresorit.io` // Can be different from ApiBase when testing
    }
  });
  logStep('Installing templating tools and example dependencies');
  exec('npm install --only=production', (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return;
    }
    console.log(stdout);
    console.error(stderr);

    return instantiate(context).then(() => {
      logStep('Done :)');
      console.log('You can start the app with: "cd app && npm start"');
    }, console.error);
  });
}
