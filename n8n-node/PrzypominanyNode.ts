import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IHttpRequestMethods,
	NodeApiError,
} from 'n8n-workflow';

export class Przypominamy implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Przypominamy.com',
		name: 'przypominamy',
		icon: 'file:przypominamy.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Send SMS, MMS, and VMS messages via Przypominamy.com API',
		defaults: {
			name: 'Przypominamy.com',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'przypominanyApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: 'https://api.przypominamy.com',
			headers: {
				'Content-Type': 'application/json',
			},
		},
		properties: [
			// ── Resource ──
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'SMS', value: 'sms' },
					{ name: 'MMS', value: 'mms' },
					{ name: 'VMS', value: 'vms' },
					{ name: 'Account', value: 'account' },
				],
				default: 'sms',
			},

			// ── SMS Operations ──
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['sms'] } },
				options: [
					{
						name: 'Send',
						value: 'send',
						description: 'Send a single SMS message',
						action: 'Send an SMS message',
					},
					{
						name: 'Send Bulk',
						value: 'sendBulk',
						description: 'Send SMS to multiple recipients',
						action: 'Send bulk SMS messages',
					},
				],
				default: 'send',
			},

			// ── MMS Operations ──
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['mms'] } },
				options: [
					{
						name: 'Send',
						value: 'send',
						description: 'Send an MMS message',
						action: 'Send an MMS message',
					},
				],
				default: 'send',
			},

			// ── VMS Operations ──
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['vms'] } },
				options: [
					{
						name: 'Send',
						value: 'send',
						description: 'Send a voice message (text-to-speech)',
						action: 'Send a VMS message',
					},
				],
				default: 'send',
			},

			// ── Account Operations ──
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['account'] } },
				options: [
					{
						name: 'Check Balance',
						value: 'checkBalance',
						description: 'Check account balance',
						action: 'Check account balance',
					},
					{
						name: 'Verify Number (HLR)',
						value: 'verifyNumber',
						description: 'Verify a phone number via HLR lookup',
						action: 'Verify a phone number',
					},
				],
				default: 'checkBalance',
			},

			// ──────────────────────────────────────────────
			// SMS: Send
			// ──────────────────────────────────────────────
			{
				displayName: 'To',
				name: 'to',
				type: 'string',
				required: true,
				default: '',
				placeholder: '48500600700',
				description: 'Recipient phone number in international format',
				displayOptions: {
					show: { resource: ['sms'], operation: ['send'] },
				},
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				typeOptions: { rows: 4 },
				required: true,
				default: '',
				description: 'SMS message content',
				displayOptions: {
					show: { resource: ['sms'], operation: ['send'] },
				},
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: { resource: ['sms'], operation: ['send'] },
				},
				options: [
					{
						displayName: 'Sender Name',
						name: 'from',
						type: 'string',
						default: '',
						description: 'Registered sender name (max 11 characters)',
					},
					{
						displayName: 'Schedule Date',
						name: 'date',
						type: 'dateTime',
						default: '',
						description: 'Schedule message for future delivery (ISO 8601)',
					},
					{
						displayName: 'Encoding',
						name: 'encoding',
						type: 'options',
						options: [
							{ name: 'UTF-8', value: 'utf-8' },
							{ name: 'ISO-8859-1', value: 'iso-8859-1' },
						],
						default: 'utf-8',
					},
					{
						displayName: 'Flash SMS',
						name: 'flash',
						type: 'boolean',
						default: false,
						description: 'Whether to send as flash SMS (displayed immediately without saving)',
					},
					{
						displayName: 'Normalize Number',
						name: 'normalize',
						type: 'boolean',
						default: false,
						description: 'Whether to automatically normalize the phone number',
					},
					{
						displayName: 'External ID',
						name: 'idx',
						type: 'string',
						default: '',
						description: 'Your custom external identifier for this message',
					},
				],
			},

			// ──────────────────────────────────────────────
			// SMS: Send Bulk
			// ──────────────────────────────────────────────
			{
				displayName: 'Mode',
				name: 'bulkMode',
				type: 'options',
				options: [
					{
						name: 'Same Message to Multiple Recipients',
						value: 'sameMessage',
					},
					{
						name: 'Individual Messages',
						value: 'individual',
					},
				],
				default: 'sameMessage',
				displayOptions: {
					show: { resource: ['sms'], operation: ['sendBulk'] },
				},
			},
			{
				displayName: 'Recipients',
				name: 'recipients',
				type: 'string',
				required: true,
				default: '',
				placeholder: '48500600700,48500600701,48500600702',
				description: 'Comma-separated phone numbers (max 10,000)',
				displayOptions: {
					show: { resource: ['sms'], operation: ['sendBulk'], bulkMode: ['sameMessage'] },
				},
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				typeOptions: { rows: 4 },
				required: true,
				default: '',
				displayOptions: {
					show: { resource: ['sms'], operation: ['sendBulk'], bulkMode: ['sameMessage'] },
				},
			},
			{
				displayName: 'Messages',
				name: 'messages',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				default: {},
				placeholder: 'Add Message',
				displayOptions: {
					show: { resource: ['sms'], operation: ['sendBulk'], bulkMode: ['individual'] },
				},
				options: [
					{
						name: 'messageValues',
						displayName: 'Message',
						values: [
							{
								displayName: 'To',
								name: 'to',
								type: 'string',
								default: '',
								required: true,
								description: 'Recipient phone number',
							},
							{
								displayName: 'Message',
								name: 'message',
								type: 'string',
								typeOptions: { rows: 2 },
								default: '',
								required: true,
							},
							{
								displayName: 'Sender Name',
								name: 'from',
								type: 'string',
								default: '',
							},
						],
					},
				],
			},
			{
				displayName: 'Additional Fields',
				name: 'bulkAdditionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: { resource: ['sms'], operation: ['sendBulk'], bulkMode: ['sameMessage'] },
				},
				options: [
					{
						displayName: 'Sender Name',
						name: 'from',
						type: 'string',
						default: '',
					},
					{
						displayName: 'Schedule Date',
						name: 'date',
						type: 'dateTime',
						default: '',
					},
					{
						displayName: 'Encoding',
						name: 'encoding',
						type: 'options',
						options: [
							{ name: 'UTF-8', value: 'utf-8' },
							{ name: 'ISO-8859-1', value: 'iso-8859-1' },
						],
						default: 'utf-8',
					},
				],
			},

			// ──────────────────────────────────────────────
			// MMS: Send
			// ──────────────────────────────────────────────
			{
				displayName: 'To',
				name: 'to',
				type: 'string',
				required: true,
				default: '',
				placeholder: '48500600700',
				description: 'Recipient phone number in international format',
				displayOptions: {
					show: { resource: ['mms'], operation: ['send'] },
				},
			},
			{
				displayName: 'Subject',
				name: 'subject',
				type: 'string',
				required: true,
				default: '',
				description: 'MMS message subject',
				displayOptions: {
					show: { resource: ['mms'], operation: ['send'] },
				},
			},
			{
				displayName: 'SMIL Content',
				name: 'smil',
				type: 'string',
				typeOptions: { rows: 6 },
				required: true,
				default: '',
				description: 'SMIL markup defining the multimedia message layout',
				displayOptions: {
					show: { resource: ['mms'], operation: ['send'] },
				},
			},
			{
				displayName: 'Additional Fields',
				name: 'mmsAdditionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: { resource: ['mms'], operation: ['send'] },
				},
				options: [
					{
						displayName: 'Sender Name',
						name: 'from',
						type: 'string',
						default: '',
					},
					{
						displayName: 'Schedule Date',
						name: 'date',
						type: 'dateTime',
						default: '',
					},
				],
			},

			// ──────────────────────────────────────────────
			// VMS: Send
			// ──────────────────────────────────────────────
			{
				displayName: 'To',
				name: 'to',
				type: 'string',
				required: true,
				default: '',
				placeholder: '48500600700',
				description: 'Recipient phone number in international format',
				displayOptions: {
					show: { resource: ['vms'], operation: ['send'] },
				},
			},
			{
				displayName: 'Text to Speech',
				name: 'tts',
				type: 'string',
				typeOptions: { rows: 4 },
				required: true,
				default: '',
				description: 'Text that will be read aloud to the recipient',
				displayOptions: {
					show: { resource: ['vms'], operation: ['send'] },
				},
			},
			{
				displayName: 'Additional Fields',
				name: 'vmsAdditionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: { resource: ['vms'], operation: ['send'] },
				},
				options: [
					{
						displayName: 'Voice',
						name: 'tts_lector',
						type: 'options',
						options: [
							{ name: 'Ewa (female)', value: 'ewa' },
							{ name: 'Maja (female)', value: 'maja' },
							{ name: 'Jacek (male)', value: 'jacek' },
							{ name: 'Jan (male)', value: 'jan' },
						],
						default: 'ewa',
					},
					{
						displayName: 'Retry Attempts',
						name: 'tries',
						type: 'number',
						typeOptions: { minValue: 1, maxValue: 6 },
						default: 1,
						description: 'Number of call attempts if recipient does not answer (1-6)',
					},
					{
						displayName: 'Sender Name',
						name: 'from',
						type: 'string',
						default: '',
					},
					{
						displayName: 'Schedule Date',
						name: 'date',
						type: 'dateTime',
						default: '',
					},
				],
			},

			// ──────────────────────────────────────────────
			// Account: Verify Number
			// ──────────────────────────────────────────────
			{
				displayName: 'Phone Number',
				name: 'number',
				type: 'string',
				required: true,
				default: '',
				placeholder: '48500600700',
				description: 'Phone number to verify in international format',
				displayOptions: {
					show: { resource: ['account'], operation: ['verifyNumber'] },
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				let method: IHttpRequestMethods = 'GET';
				let endpoint = '';
				let body: Record<string, unknown> = {};
				let qs: Record<string, string> = {};

				// ── SMS: Send ──
				if (resource === 'sms' && operation === 'send') {
					method = 'POST';
					endpoint = '/v1/sms';
					body = {
						to: this.getNodeParameter('to', i) as string,
						message: this.getNodeParameter('message', i) as string,
					};
					const additionalFields = this.getNodeParameter('additionalFields', i) as Record<string, unknown>;
					Object.assign(body, additionalFields);
				}

				// ── SMS: Send Bulk ──
				else if (resource === 'sms' && operation === 'sendBulk') {
					method = 'POST';
					endpoint = '/v1/sms/bulk';
					const bulkMode = this.getNodeParameter('bulkMode', i) as string;

					if (bulkMode === 'sameMessage') {
						const recipientsStr = this.getNodeParameter('recipients', i) as string;
						const recipients = recipientsStr.split(',').map((r) => r.trim());
						body = {
							recipients,
							message: this.getNodeParameter('message', i) as string,
						};
						const additionalFields = this.getNodeParameter('bulkAdditionalFields', i) as Record<string, unknown>;
						Object.assign(body, additionalFields);
					} else {
						const messagesData = this.getNodeParameter('messages', i) as {
							messageValues: Array<{ to: string; message: string; from?: string }>;
						};
						body = {
							messages: messagesData.messageValues || [],
						};
					}
				}

				// ── MMS: Send ──
				else if (resource === 'mms' && operation === 'send') {
					method = 'POST';
					endpoint = '/v1/mms';
					body = {
						to: this.getNodeParameter('to', i) as string,
						subject: this.getNodeParameter('subject', i) as string,
						smil: this.getNodeParameter('smil', i) as string,
					};
					const additionalFields = this.getNodeParameter('mmsAdditionalFields', i) as Record<string, unknown>;
					Object.assign(body, additionalFields);
				}

				// ── VMS: Send ──
				else if (resource === 'vms' && operation === 'send') {
					method = 'POST';
					endpoint = '/v1/vms';
					body = {
						to: this.getNodeParameter('to', i) as string,
						tts: this.getNodeParameter('tts', i) as string,
					};
					const additionalFields = this.getNodeParameter('vmsAdditionalFields', i) as Record<string, unknown>;
					Object.assign(body, additionalFields);
				}

				// ── Account: Check Balance ──
				else if (resource === 'account' && operation === 'checkBalance') {
					method = 'GET';
					endpoint = '/v1/balance';
				}

				// ── Account: Verify Number (HLR) ──
				else if (resource === 'account' && operation === 'verifyNumber') {
					method = 'GET';
					endpoint = '/v1/hlr';
					qs = {
						number: this.getNodeParameter('number', i) as string,
					};
				}

				// ── Execute Request ──
				const options: Record<string, unknown> = {
					method,
					url: endpoint,
					qs: Object.keys(qs).length > 0 ? qs : undefined,
					body: method === 'POST' ? body : undefined,
					json: true,
				};

				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'przypominanyApi',
					{
						method,
						url: `https://api.przypominamy.com${endpoint}`,
						qs: Object.keys(qs).length > 0 ? qs : undefined,
						body: method === 'POST' ? body : undefined,
						json: true,
					},
				);

				if (Array.isArray(response)) {
					returnData.push(...response.map((item) => ({ json: item })));
				} else {
					returnData.push({ json: response });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message } });
					continue;
				}
				throw new NodeApiError(this.getNode(), error as Record<string, unknown>);
			}
		}

		return [returnData];
	}
}
