'use strict';

const API_BASE = 'https://api.przypominamy.com';

const authentication = {
  type: 'custom',
  fields: [
    {
      computed: false,
      key: 'api_key',
      required: true,
      label: 'Klucz API / API Key',
      type: 'string',
      helpText:
        'Znajdziesz go w panelu [Przypominamy.com](https://przypominamy.com) w ustawieniach konta. / You can find it in your account settings at [Przypominamy.com](https://przypominamy.com).',
    },
  ],
  test: {
    url: `${API_BASE}/v1/balance`,
    method: 'GET',
    headers: {
      Authorization: 'Bearer {{bundle.authData.api_key}}',
      Accept: 'application/json',
    },
    removeMissingValuesFrom: { params: true },
  },
  connectionLabel: (z, bundle) => {
    const data = bundle.cleanedRequest?.data;
    if (data && data.username) {
      return `${data.username} (${data.balance} ${data.currency})`;
    }
    return 'Przypominamy.com';
  },
};

// Middleware to inject Bearer token into every request
const addApiKeyToHeader = (request, z, bundle) => {
  if (bundle.authData && bundle.authData.api_key) {
    request.headers = request.headers || {};
    request.headers.Authorization = `Bearer ${bundle.authData.api_key}`;
  }
  return request;
};

// Middleware to handle API error responses
const handleErrors = (response, z, bundle) => {
  if (response.status === 401) {
    throw new z.errors.Error(
      'Nieprawidlowy klucz API. Sprawdz ustawienia konta. / Invalid API key.',
      'AuthenticationError',
      response.status
    );
  }

  if (response.status === 429) {
    throw new z.errors.ThrottledError(
      'Przekroczono limit zapytan. / Rate limit exceeded.',
      60
    );
  }

  if (response.status >= 400) {
    const body =
      typeof response.data === 'object' ? response.data : response.json;
    const message =
      body?.error?.message || `Blad API: ${response.status}`;
    throw new z.errors.Error(message, 'ApiError', response.status);
  }

  return response;
};

module.exports = {
  authentication,
  addApiKeyToHeader,
  handleErrors,
};
