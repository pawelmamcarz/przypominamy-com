'use strict';

const API_BASE = 'https://api.przypominamy.com';

const perform = async (z, bundle) => {
  const response = await z.request({
    url: `${API_BASE}/v1/hlr`,
    method: 'GET',
    params: {
      number: bundle.inputData.number,
    },
  });

  const result = response.data;
  if (result.success && result.data) {
    return [result.data];
  }

  return result.data ? [result.data] : [];
};

module.exports = {
  key: 'verifyNumber',
  noun: 'Number Verification',
  display: {
    label: 'Verify Phone Number (HLR)',
    description:
      'Perform an HLR lookup to verify if a phone number is active and get network information.',
  },
  operation: {
    perform,
    inputFields: [
      {
        key: 'number',
        label: 'Phone Number',
        type: 'string',
        required: true,
        helpText:
          'The phone number to verify (with country code), e.g. +48123456789.',
      },
    ],
    sample: {
      number: '+48123456789',
      status: 'active',
      ported: false,
      network: 'T-Mobile',
      country: 'PL',
      cost: 0.01,
    },
    outputFields: [
      { key: 'number', label: 'Phone Number', type: 'string' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'ported', label: 'Ported', type: 'boolean' },
      { key: 'network', label: 'Network', type: 'string' },
      { key: 'country', label: 'Country Code', type: 'string' },
      { key: 'cost', label: 'Lookup Cost (PLN)', type: 'number' },
    ],
  },
};
