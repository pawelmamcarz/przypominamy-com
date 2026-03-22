'use strict';

const API_BASE = 'https://api.przypominamy.com';

const perform = async (z, bundle) => {
  const body = {
    to: bundle.inputData.to,
    tts: bundle.inputData.tts,
  };

  if (bundle.inputData.tts_lector) body.tts_lector = bundle.inputData.tts_lector;
  if (bundle.inputData.from) body.from = bundle.inputData.from;
  if (bundle.inputData.date) body.date = bundle.inputData.date;
  if (bundle.inputData.tries) body.tries = bundle.inputData.tries;

  const response = await z.request({
    url: `${API_BASE}/v1/vms`,
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
  key: 'sendVms',
  noun: 'Voice Message',
  display: {
    label: 'Send Voice Message (VMS)',
    description:
      'Send a voice message (text-to-speech) to a phone number via Przypominamy.com.',
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
        key: 'tts',
        label: 'Text to Speak',
        type: 'string',
        required: true,
        helpText:
          'The text that will be read aloud to the recipient using text-to-speech.',
      },
      {
        key: 'tts_lector',
        label: 'Voice / Lector',
        type: 'string',
        required: false,
        default: 'ewa',
        choices: {
          ewa: 'Ewa (female)',
          jacek: 'Jacek (male)',
          jan: 'Jan (male)',
          maja: 'Maja (female)',
        },
        helpText: 'Choose the TTS voice for the message. Default: Ewa.',
      },
      {
        key: 'from',
        label: 'Caller ID',
        type: 'string',
        required: false,
        helpText: 'The phone number displayed as caller ID.',
      },
      {
        key: 'date',
        label: 'Schedule Date',
        type: 'datetime',
        required: false,
        helpText: 'Schedule the voice call for a future date/time.',
      },
      {
        key: 'tries',
        label: 'Retry Attempts',
        type: 'integer',
        required: false,
        helpText:
          'Number of call attempts if the recipient does not answer (1-6). Default: 1.',
      },
    ],
    sample: {
      id: '6501234567890',
      to: '+48123456789',
      status: 'queued',
      cost: 0.30,
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
