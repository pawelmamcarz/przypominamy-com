'use strict';

const API_BASE = 'https://api.przypominamy.com';

const subscribeHook = async (z, bundle) => {
  const response = await z.request({
    url: `${API_BASE}/v1/webhooks`,
    method: 'POST',
    body: {
      target_url: bundle.targetUrl,
      event: 'incoming_sms',
    },
  });
  return response.data;
};

const unsubscribeHook = async (z, bundle) => {
  const webhookId = bundle.subscribeData?.id;
  if (webhookId) {
    await z.request({
      url: `${API_BASE}/v1/webhooks/${webhookId}`,
      method: 'DELETE',
    });
  }
  return {};
};

const perform = (z, bundle) => {
  const payload = bundle.cleanedRequest;

  // Normalize to array for Zapier
  return [
    {
      id: payload.message_id || `incoming_${Date.now()}`,
      from: payload.from,
      to: payload.to,
      message: payload.message,
      message_id: payload.message_id,
      received_at: payload.received_at,
    },
  ];
};

const performList = async (z, bundle) => {
  // Provide sample data when no webhook payloads are available yet
  return [
    {
      id: 'sample_incoming_1',
      from: '+48123456789',
      to: '+48987654321',
      message: 'Przykladowa wiadomosc przychodzaca',
      message_id: 'sample_incoming_1',
      received_at: new Date().toISOString(),
    },
  ];
};

module.exports = {
  key: 'incomingSms',
  noun: 'Incoming SMS',
  display: {
    label: 'New Incoming SMS',
    description:
      'Triggers when a new incoming SMS message is received on your Przypominamy.com number.',
  },
  operation: {
    type: 'hook',
    performSubscribe: subscribeHook,
    performUnsubscribe: unsubscribeHook,
    perform,
    performList,
    sample: {
      id: 'msg_abc123',
      from: '+48123456789',
      to: '+48987654321',
      message: 'Przykladowa wiadomosc',
      message_id: 'msg_abc123',
      received_at: '2025-01-15T12:00:00.000Z',
    },
    outputFields: [
      { key: 'id', label: 'ID', type: 'string' },
      { key: 'from', label: 'From Number', type: 'string' },
      { key: 'to', label: 'To Number', type: 'string' },
      { key: 'message', label: 'Message Text', type: 'string' },
      { key: 'message_id', label: 'Message ID', type: 'string' },
      { key: 'received_at', label: 'Received At', type: 'datetime' },
    ],
  },
};
