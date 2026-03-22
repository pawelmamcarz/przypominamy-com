'use strict';

const API_BASE = 'https://api.przypominamy.com';

const perform = async (z, bundle) => {
  const recipientsList = bundle.inputData.recipients
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);

  const body = {
    recipients: recipientsList,
    message: bundle.inputData.message,
  };

  if (bundle.inputData.from) body.from = bundle.inputData.from;
  if (bundle.inputData.date) body.date = bundle.inputData.date;

  const response = await z.request({
    url: `${API_BASE}/v1/sms/bulk`,
    method: 'POST',
    body,
  });

  const result = response.data;
  if (result.success && result.data) {
    return result.data;
  }

  return result.data || result;
};

module.exports = {
  key: 'sendSmsBulk',
  noun: 'Bulk SMS',
  display: {
    label: 'Send Bulk SMS',
    description:
      'Send the same SMS message to multiple recipients at once via Przypominamy.com.',
  },
  operation: {
    perform,
    inputFields: [
      {
        key: 'recipients',
        label: 'Recipients',
        type: 'string',
        required: true,
        helpText:
          'Comma-separated list of phone numbers with country codes, e.g. +48123456789,+48111222333. Maximum 10,000 recipients.',
      },
      {
        key: 'message',
        label: 'Message',
        type: 'text',
        required: true,
        helpText: 'The text content of the SMS message sent to all recipients.',
      },
      {
        key: 'from',
        label: 'Sender Name',
        type: 'string',
        required: false,
        helpText:
          'Sender name (max 11 characters). Must be pre-registered in your account.',
      },
      {
        key: 'date',
        label: 'Schedule Date',
        type: 'datetime',
        required: false,
        helpText: 'Schedule the bulk SMS for a future date/time.',
      },
    ],
    sample: {
      count: 3,
      messages: [
        {
          id: '6501234567890',
          to: '+48123456789',
          status: 'queued',
          parts: 1,
          cost: 0.15,
        },
        {
          id: '6501234567891',
          to: '+48111222333',
          status: 'queued',
          parts: 1,
          cost: 0.15,
        },
      ],
    },
    outputFields: [
      { key: 'count', label: 'Messages Sent', type: 'integer' },
      { key: 'messages', label: 'Messages', type: 'string' },
    ],
  },
};
