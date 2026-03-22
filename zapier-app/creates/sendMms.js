'use strict';

const API_BASE = 'https://api.przypominamy.com';

const perform = async (z, bundle) => {
  const body = {
    to: bundle.inputData.to,
    subject: bundle.inputData.subject,
    smil: bundle.inputData.smil,
  };

  if (bundle.inputData.from) body.from = bundle.inputData.from;
  if (bundle.inputData.date) body.date = bundle.inputData.date;

  const response = await z.request({
    url: `${API_BASE}/v1/mms`,
    method: 'POST',
    body,
  });

  const result = response.data;
  if (result.success && result.data && result.data.messages && result.data.messages[0]) {
    return result.data.messages[0];
  }

  return result.data || result;
};

module.exports = {
  key: 'sendMms',
  noun: 'MMS',
  display: {
    label: 'Send MMS',
    description:
      'Send an MMS multimedia message via Przypominamy.com.',
  },
  operation: {
    perform,
    inputFields: [
      {
        key: 'to',
        label: 'Recipient Phone Number',
        type: 'string',
        required: true,
        helpText: 'Phone number with country code, e.g. +48123456789.',
      },
      {
        key: 'subject',
        label: 'Subject',
        type: 'string',
        required: true,
        helpText: 'The subject/title of the MMS message.',
      },
      {
        key: 'smil',
        label: 'SMIL Content',
        type: 'text',
        required: true,
        helpText:
          'SMIL markup defining the MMS content (images, text, audio layout).',
      },
      {
        key: 'from',
        label: 'Sender Name',
        type: 'string',
        required: false,
        helpText: 'Sender name. Must be pre-registered in your account.',
      },
      {
        key: 'date',
        label: 'Schedule Date',
        type: 'datetime',
        required: false,
        helpText: 'Schedule the MMS for a future date/time.',
      },
    ],
    sample: {
      id: '6501234567890',
      to: '+48123456789',
      status: 'queued',
      cost: 0.50,
      sent_at: '2025-01-15T12:00:00.000Z',
    },
    outputFields: [
      { key: 'id', label: 'Message ID', type: 'string' },
      { key: 'to', label: 'Recipient', type: 'string' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'cost', label: 'Cost (PLN)', type: 'number' },
      { key: 'sent_at', label: 'Sent At', type: 'datetime' },
    ],
  },
};
