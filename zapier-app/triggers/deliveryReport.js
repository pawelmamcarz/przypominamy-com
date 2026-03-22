'use strict';

const API_BASE = 'https://api.przypominamy.com';

const subscribeHook = async (z, bundle) => {
  const response = await z.request({
    url: `${API_BASE}/v1/webhooks`,
    method: 'POST',
    body: {
      target_url: bundle.targetUrl,
      event: 'delivery_report',
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

  return [
    {
      id: payload.message_id || `dlr_${Date.now()}`,
      message_id: payload.message_id,
      to: payload.to,
      status: payload.status,
      sent_at: payload.sent_at,
      done_at: payload.done_at,
    },
  ];
};

const performList = async (z, bundle) => {
  return [
    {
      id: 'sample_dlr_1',
      message_id: 'sample_dlr_1',
      to: '+48123456789',
      status: 'delivered',
      sent_at: new Date().toISOString(),
      done_at: new Date().toISOString(),
    },
  ];
};

module.exports = {
  key: 'deliveryReport',
  noun: 'Delivery Report',
  display: {
    label: 'Delivery Report (DLR)',
    description:
      'Triggers when a delivery report is received for a sent message.',
    important: true,
  },
  operation: {
    type: 'hook',
    performSubscribe: subscribeHook,
    performUnsubscribe: unsubscribeHook,
    perform,
    performList,
    sample: {
      id: 'msg_abc123',
      message_id: 'msg_abc123',
      to: '+48123456789',
      status: 'delivered',
      sent_at: '2025-01-15T12:00:00.000Z',
      done_at: '2025-01-15T12:00:05.000Z',
    },
    outputFields: [
      { key: 'id', label: 'ID', type: 'string' },
      { key: 'message_id', label: 'Message ID', type: 'string' },
      { key: 'to', label: 'Recipient Number', type: 'string' },
      {
        key: 'status',
        label: 'Delivery Status',
        type: 'string',
        helpText:
          'Possible values: queued, sent, delivered, expired, failed, accepted, rejected, undelivered, unknown.',
      },
      { key: 'sent_at', label: 'Sent At', type: 'datetime' },
      { key: 'done_at', label: 'Delivered At', type: 'datetime' },
    ],
  },
};
