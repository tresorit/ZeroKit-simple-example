const webdriverio = require('webdriverio');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const expect = chai.expect;

const testPassword = 'asdf';

const browsersToTest = [
  { browserName: 'chrome',  version: 55 },
  { browserName: 'firefox', version: 50 },
  { browserName: 'edge' }
];

const browserStackDevice = {
  user: process.env.BROWSERSTACK_USERNAME,
  key: process.env.BROWSERSTACK_ACCESS_KEY,
  desiredCapabilities: {
    'browserstack.local': true,
    'browserstack.localIdentifier': process.env.BROWSERSTACK_LOCAL_IDENTIFIER || 'local'
  }
};

describe('Default flow', function(){
  for(let i = 0; i < browsersToTest.length; ++i){
    const b1 = browsersToTest[i];
    const b2 = browsersToTest[(i+1)%browsersToTest.length];

    const cOpts = {};
    cOpts.dev1 = Object.assign({}, browserStackDevice);
    cOpts.dev1.desiredCapabilities = Object.assign({}, cOpts.dev1.desiredCapabilities, b1);

    cOpts.dev2 = Object.assign({}, browserStackDevice);
    cOpts.dev2.desiredCapabilities = Object.assign({}, cOpts.dev2.desiredCapabilities, b2);

    it(`should work in ${b1.browserName}@${b1.version}-${b2.browserName}@${b2.version}`, function () {
      this.timeout(180000);
      const browsers = webdriverio.multiremote(cOpts);
      console.log('Running init');
      return browsers.init().then(() => {
        console.log('Starting tests');
        return executeBasicFlow(browsers);
      }).then(
        () => browsers.end(),
        (err) => {browsers.end(); throw err;});
    });
  }

  function executeBasicFlow(browser) {
    let dev1 = browser.select('dev1');
    let dev2 = browser.select('dev2');
    let userA = 'dev1' + Date.now();
    let userB = 'dev2' + Date.now();
    let userIdA, userIdB, enc;

    return browser.url('http://localhost:3000/login.html')
      .waitForVisible('#zkitLogin', 20000)
      .click('#gotoReg a')
      .waitForVisible('#regIframe', 20000).then(() => {
        return register(dev1, userA, testPassword);
      }).then(() => {
        return register(dev2, userB, testPassword);
      }).then(() => {
        return browser.waitForVisible('#nextStep', 20000);
      }).then(() => {
        console.log('***Registrations done');
        return browser.click('#nextStep a');
      }).then(() => {
        return browser.waitForVisible('#zkitLogin');
      }).then(() => {
        return logIn(dev1, userA, testPassword);
      }).then(() => {
        return logIn(dev2, userB, testPassword);
      }).then(() => {
        return browser.waitForVisible('#loggedIn', 20000);
      }).then(() => {
        console.log('***Both logged in');
        return Promise.all([
          dev1.click('=Encrypt'),
          dev2.click('=Decrypt')
        ]);
      }).then(() => {
        return browser.waitForVisible('#userIdPanel', 20000);
      }).then(() => {
        return dev1.getText('#userId');
      }).then((id) => {
        userIdA = id;
        expect(userIdA).to.be.not.equal('null', 'Still logged in after navigation');
        return dev2.getText('#userId');
      }).then((id) => {
        userIdB = id;
        expect(userIdB).to.be.not.equal('null', 'Still logged in after navigation');
        console.log('***Navigated');
        return dev1.waitForVisible('#createTresorPanel', 20000)
          .click('#createTresorPanel button')
          .waitForVisible('#encryptPanel', 20000)
          .setValue('#encryptPanel textarea', 'testText')
          .click('#encryptPanel button')
          .waitForVisible('#decryptPanel', 20000);
      }).then(() => {
        return dev1.getValue('#decryptPanel textarea#encryptedText');
      }).then((text) => {
        enc = text;
        return dev1.click('#decryptPanel button')
          .waitForText('#decryptPanel #decryptedText', 20000);
      }).then(() => {
        return expect(dev1.getText('#decryptPanel #decryptedText')).to.be.eventually.equal('testText');
      }).then(() => {
        console.log('***Decrypted');
        dev2.setValue('#decryptPanel #encryptedText', enc)
          .click('#decryptPanel button')
          .waitUntil(() => dev2.getText('#decryptPanel #decryptedText').then(t => t === 'Couldn\'t decrypt'), 20000);
      }).then(() => {
        return dev1.waitForVisible('#sharePanel', 20000)
          .setValue('#sharePanel #shareWith', userIdB)
          .click('#sharePanel button')
          .waitForVisible('#sharePanel #shared', 20000);
      }).then(() => {
        console.log('***Shared');
        //return browser.getTitle().pause(5000);
      }).then(() => {
        return dev2.click('#decryptPanel button')
          .waitUntil(() => dev2.getText('#decryptPanel #decryptedText').then(t => t === 'testText'), 20000);
      }).then(() => {
        console.log('***Checked that dev2 can decrypt now');
      });
  }

  function register(device, userName, password) {
    return device.element('[placeholder="Username"]').setValue(userName)
      .element('#regIframe iframe').then(frameEle =>
        device.frame(frameEle.value)
          .element('#pw1').setValue(password)
          .element('#pw2').setValue(password)
          .frame()
          .click('#regIframe+button'));
  }

  function logIn(device, userName, password){
    return device.element('[placeholder="Username"]').setValue(userName)
      .element('#zkitLogin iframe').then(frameEle =>
        device.frame(frameEle.value)
          .element('#pw1').setValue(password)
          .frame()
          .click('#zkitLogin+button'));
  }

  function keepAwake(){
    return browser.getTitle();
  }
});

