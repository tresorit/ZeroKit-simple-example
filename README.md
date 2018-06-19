**Notice:** This project is discontinued and no longer maintained nor supported by Tresorit. This repository only exists for archival purposes.
***
[![Build Status](https://travis-ci.org/tresorit/ZeroKit-simple-example.svg?branch=master)](https://travis-ci.org/tresorit/ZeroKit-simple-example)
# Welcome to ZeroKit!
This repository is a template of a basic example application that shows you how to use ZeroKit for zero knowledge authentication 
and end-to-end encryption in a very basic manner.
## Instructions
1. Make sure you have a nodejs (>6.0.0) installed.
    - You can download the current version from [here](https://nodejs.org)
2. Instantiate the application by running `node installer <tenantId> <adminKey> [hostId]`
    - To get your credentials visit the [management portal](manage.tresorit.io), you can sign up for a free account there.
3. The example app is now in the app subfolder, that you can optionally move wherever you like.
3. Start the example app server, by running `npm start` in the app folder
4. Navigate your browser (preferably chrome) to [http://localhost:3000](http://localhost:3000)
5. Register a new user, sign in and try encrypting and decrypting something.

Cross browser testing provided by <a href="https://www.browserstack.com"><image alt="BrowserStack" src="https://cdn.rawgit.com/tresorit/ZeroKit-simple-example/master/BrowserStackLogo.svg" width="150px" /></a>
