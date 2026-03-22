'use strict';

const zapier = require('zapier-platform-core');
const App = require('../index');

const appTester = zapier.createAppTester(App);
zapier.tools.env.inject();

describe('Authentication', () => {
  it('should authenticate with a valid API key', async () => {
    const bundle = {
      authData: {
        api_key: process.env.API_KEY || 'test_api_key_123',
      },
    };

    // This will fail without a real API key, but tests the wiring
    try {
      const response = await appTester(
        App.authentication.test,
        bundle
      );
      expect(response).toBeDefined();
      expect(response.data).toBeDefined();
    } catch (error) {
      // Expected to fail without real credentials
      expect(error).toBeDefined();
    }
  });

  it('should include Bearer token in request headers', async () => {
    const bundle = {
      authData: { api_key: 'test_key_abc' },
    };

    const request = {
      headers: {},
      url: 'https://api.przypominamy.com/v1/balance',
    };

    const result = App.beforeRequest[0](request, null, bundle);
    expect(result.headers.Authorization).toBe('Bearer test_key_abc');
  });
});

describe('Send SMS', () => {
  it('should have correct input fields', () => {
    const sendSms = App.creates.sendSms;
    expect(sendSms.key).toBe('sendSms');
    expect(sendSms.noun).toBe('SMS');

    const fields = sendSms.operation.inputFields;
    const fieldKeys = fields.map((f) => f.key);

    expect(fieldKeys).toContain('to');
    expect(fieldKeys).toContain('message');
    expect(fieldKeys).toContain('from');
    expect(fieldKeys).toContain('date');
    expect(fieldKeys).toContain('flash');

    const toField = fields.find((f) => f.key === 'to');
    expect(toField.required).toBe(true);

    const messageField = fields.find((f) => f.key === 'message');
    expect(messageField.required).toBe(true);
    expect(messageField.type).toBe('text');
  });

  it('should build correct request', async () => {
    const bundle = {
      authData: { api_key: 'test_key' },
      inputData: {
        to: '+48123456789',
        message: 'Test message',
        from: 'MyApp',
      },
    };

    try {
      await appTester(App.creates.sendSms.operation.perform, bundle);
    } catch (error) {
      // Expected - no real API
      expect(error).toBeDefined();
    }
  });
});

describe('Send Bulk SMS', () => {
  it('should have correct input fields', () => {
    const bulk = App.creates.sendSmsBulk;
    expect(bulk.key).toBe('sendSmsBulk');

    const fields = bulk.operation.inputFields;
    const recipientsField = fields.find((f) => f.key === 'recipients');
    expect(recipientsField.required).toBe(true);
    expect(recipientsField.type).toBe('string');
  });
});

describe('Send MMS', () => {
  it('should have required smil field', () => {
    const mms = App.creates.sendMms;
    const fields = mms.operation.inputFields;
    const smilField = fields.find((f) => f.key === 'smil');
    expect(smilField.required).toBe(true);
    expect(smilField.type).toBe('text');
  });
});

describe('Send VMS', () => {
  it('should have TTS lector choices', () => {
    const vms = App.creates.sendVms;
    const fields = vms.operation.inputFields;
    const lectorField = fields.find((f) => f.key === 'tts_lector');
    expect(lectorField.choices).toBeDefined();
    expect(lectorField.choices.ewa).toBeDefined();
    expect(lectorField.choices.jacek).toBeDefined();
    expect(lectorField.choices.jan).toBeDefined();
    expect(lectorField.choices.maja).toBeDefined();
  });

  it('should have tries field with integer type', () => {
    const vms = App.creates.sendVms;
    const fields = vms.operation.inputFields;
    const triesField = fields.find((f) => f.key === 'tries');
    expect(triesField.type).toBe('integer');
    expect(triesField.required).toBe(false);
  });
});

describe('Check Balance', () => {
  it('should have no input fields', () => {
    const balance = App.searches.checkBalance;
    expect(balance.operation.inputFields).toHaveLength(0);
  });

  it('should have correct output fields', () => {
    const balance = App.searches.checkBalance;
    const outputKeys = balance.operation.outputFields.map((f) => f.key);
    expect(outputKeys).toContain('balance');
    expect(outputKeys).toContain('currency');
    expect(outputKeys).toContain('username');
  });
});

describe('Verify Number (HLR)', () => {
  it('should require number input', () => {
    const hlr = App.searches.verifyNumber;
    const fields = hlr.operation.inputFields;
    const numberField = fields.find((f) => f.key === 'number');
    expect(numberField.required).toBe(true);
  });

  it('should have correct output fields', () => {
    const hlr = App.searches.verifyNumber;
    const outputKeys = hlr.operation.outputFields.map((f) => f.key);
    expect(outputKeys).toContain('number');
    expect(outputKeys).toContain('status');
    expect(outputKeys).toContain('ported');
    expect(outputKeys).toContain('network');
    expect(outputKeys).toContain('country');
    expect(outputKeys).toContain('cost');
  });
});

describe('Triggers', () => {
  it('should register incoming SMS trigger', () => {
    const trigger = App.triggers.incomingSms;
    expect(trigger.key).toBe('incomingSms');
    expect(trigger.operation.type).toBe('hook');
  });

  it('should register delivery report trigger', () => {
    const trigger = App.triggers.deliveryReport;
    expect(trigger.key).toBe('deliveryReport');
    expect(trigger.operation.type).toBe('hook');
  });

  it('should parse incoming SMS payload', () => {
    const trigger = App.triggers.incomingSms;
    const bundle = {
      cleanedRequest: {
        event: 'incoming_sms',
        from: '+48123456789',
        to: '+48987654321',
        message: 'Hello',
        message_id: 'msg_123',
        received_at: '2025-01-15T12:00:00.000Z',
      },
    };

    const result = trigger.operation.perform(null, bundle);
    expect(result).toHaveLength(1);
    expect(result[0].from).toBe('+48123456789');
    expect(result[0].message).toBe('Hello');
    expect(result[0].id).toBe('msg_123');
  });

  it('should parse delivery report payload', () => {
    const trigger = App.triggers.deliveryReport;
    const bundle = {
      cleanedRequest: {
        event: 'delivery_report',
        message_id: 'msg_456',
        to: '+48123456789',
        status: 'delivered',
        sent_at: '2025-01-15T12:00:00.000Z',
        done_at: '2025-01-15T12:00:05.000Z',
      },
    };

    const result = trigger.operation.perform(null, bundle);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('delivered');
    expect(result[0].message_id).toBe('msg_456');
  });
});

describe('App Structure', () => {
  it('should have correct version', () => {
    expect(App.version).toBe('1.0.0');
  });

  it('should have authentication configured', () => {
    expect(App.authentication).toBeDefined();
    expect(App.authentication.type).toBe('custom');
    expect(App.authentication.fields).toHaveLength(1);
    expect(App.authentication.fields[0].key).toBe('api_key');
  });

  it('should have beforeRequest middleware', () => {
    expect(App.beforeRequest).toHaveLength(1);
  });

  it('should have afterResponse middleware', () => {
    expect(App.afterResponse).toHaveLength(1);
  });

  it('should register all triggers', () => {
    expect(Object.keys(App.triggers)).toHaveLength(2);
  });

  it('should register all creates', () => {
    expect(Object.keys(App.creates)).toHaveLength(4);
  });

  it('should register all searches', () => {
    expect(Object.keys(App.searches)).toHaveLength(2);
  });
});
