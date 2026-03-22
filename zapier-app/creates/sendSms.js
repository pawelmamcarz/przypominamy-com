'use strict';

const API_BASE = 'https://api.przypominamy.com';

const perform = async (z, bundle) => {
  const body = {
    to: bundle.inputData.to,
    message: bundle.inputData.message,
  };

  if (bundle.inputData.from) body.from = bundle.inputData.from;
  if (bundle.inputData.date) body.date = bundle.inputData.date;
  if (bundle.inputData.flash) body.flash = true;

  const response = await z.request({
    url: `${API_BASE}/v1/sms`,
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
  key: 'sendSms',
  noun: 'SMS',
  display: {
    label: 'Send SMS',
    description: 'Send an SMS message to a phone number via Przypominamy.com.',
  },
  operation: {
    perform,
    inputFields: [
      {
        key: 'to',
        label: 'Recipient Phone Number',
        type: 'string',
        required: true,
        helpText:
          'Phone number with country code, e.g. +48123456789 or 48123456789.',
      },
      {
        key: 'message',
        label: 'Message',
        type: 'string',
        required: true,
        helpText:
          'The text content of the SMS message. Standard SMS is 160 characters (70 for Unicode).',
      },
      {
        key: 'from',
        label: 'Sender Name',
        type: 'string',
        required: false,
        helpText:
          'Sender name (max 11 characters, alphanumeric). Must be pre-registered in your account.',
      },
      {
        key: 'date',
        label: 'Schedule Date',
        type: 'datetime',
        required: false,
        helpText: 'Schedule the SMS for a future date/time (ISO 8601 format).',
      },
      {
        key: 'flash',
        label: 'Flash SMS',
        type: 'boolean',
        required: false,
        helpText:
          'Send as a Flash SMS (displayed immediately on the screen without being saved).',
      },
    ],
    sample: {
      id: '6501234567890',
      to: '+48123456789',
      status: 'queued',
      parts: 1,
      cost: 0.15,
      sent_at: '2025-01-15T12:00:00.000Z',
    },
    outputFields: [
      { key: 'id', label: 'Message ID', type: 'string' },
      { key: 'to', label: 'Recipient', type: 'string' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'parts', label: 'SMS Parts', type: 'integer' },
      { key: 'cost', label: 'Cost (PLN)', type: 'number' },
      { key: 'sent_at', label: 'Sent At', type: 'datetime' },
    ],
  },
};
