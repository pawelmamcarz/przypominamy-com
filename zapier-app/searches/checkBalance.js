'use strict';

const API_BASE = 'https://api.przypominamy.com';

const perform = async (z, bundle) => {
  const response = await z.request({
    url: `${API_BASE}/v1/balance`,
    method: 'GET',
  });

  const result = response.data;
  if (result.success && result.data) {
    return [result.data];
  }

  return [result.data || result];
};

module.exports = {
  key: 'checkBalance',
  noun: 'Balance',
  display: {
    label: 'Check Account Balance',
    description: 'Get the current account balance from Przypominamy.com.',
  },
  operation: {
    perform,
    inputFields: [
      {
        key: 'currency',
        label: 'Currency',
        type: 'string',
        default: 'PLN',
        required: false,
        helpText: 'Currency for the balance (default: PLN).',
      },
    ],
    sample: {
      balance: 125.50,
      currency: 'PLN',
      username: 'moja_firma',
    },
    outputFields: [
      { key: 'balance', label: 'Balance', type: 'number' },
      { key: 'currency', label: 'Currency', type: 'string' },
      { key: 'username', label: 'Username', type: 'string' },
    ],
  },
};
