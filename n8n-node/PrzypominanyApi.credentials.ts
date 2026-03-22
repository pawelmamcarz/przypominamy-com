import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class PrzypominanyApi implements ICredentialType {
	name = 'przypominanyApi';
	displayName = 'Przypominamy.com API';
	documentationUrl = 'https://przypominamy.com/api-docs';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Klucz API z panelu Przypominamy.com (Ustawienia > API)',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.przypominamy.com',
			url: '/v1/balance',
			method: 'GET',
		},
	};
}
