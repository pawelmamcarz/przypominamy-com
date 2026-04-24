'use strict';

const {
  authentication,
  addApiKeyToHeader,
  handleErrors,
} = require('./authentication');

const sendSms = require('./creates/sendSms');
const sendSmsBulk = require('./creates/sendSmsBulk');
const sendMms = require('./creates/sendMms');
const sendVms = require('./creates/sendVms');

const checkBalance = require('./searches/checkBalance');
const verifyNumber = require('./searches/verifyNumber');

module.exports = {
  version: require('./package.json').version,
  platformVersion: require('zapier-platform-core').version,

  authentication: authentication,

  beforeRequest: [addApiKeyToHeader],
  afterResponse: [handleErrors],

  triggers: {},

  creates: {
    [sendSms.key]: sendSms,
    [sendSmsBulk.key]: sendSmsBulk,
    [sendMms.key]: sendMms,
    [sendVms.key]: sendVms,
  },

  searches: {
    [checkBalance.key]: checkBalance,
    [verifyNumber.key]: verifyNumber,
  },
};
