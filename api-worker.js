/**
 * Przypominamy.com — API Gateway Worker
 * White-label proxy over SMSAPI.pl
 *
 * Routes: api.przypominamy.com/v1/*
 * Auth: Bearer token per client (stored in CLIENTS_KV)
 * Backend: SMSAPI.pl REST API
 */

const SMSAPI_BASE = 'https://api.smsapi.pl';
const FETCH_TIMEOUT = 10000;
const CALLBACK_BASE = 'https://api.przypominamy.com/v1/callback/';

const SMSAPI_ERRORS = {
  8:   { status: 422, message: 'Nieprawidłowy numer telefonu' },
  11:  { status: 422, message: 'Wiadomość przekracza dopuszczalną długość' },
  12:  { status: 422, message: 'Wiadomość jest pusta' },
  13:  { status: 402, message: 'Niewystarczające środki na koncie' },
  14:  { status: 422, message: 'Nieprawidłowa nazwa nadawcy' },
  101: { status: 502, message: 'Błąd uwierzytelnienia z dostawcą SMS' },
  103: { status: 403, message: 'Funkcja niedostępna dla Twojego konta' },
  105: { status: 502, message: 'Wewnętrzny błąd dostawcy SMS' },
};

const STATUS_MAP = {
  QUEUE: 'queued', SENT: 'sent', DELIVERED: 'delivered',
  NOT_FOUND: 'not_found', EXPIRED: 'expired', FAILED: 'failed',
  ACCEPTED: 'accepted', UNKNOWN: 'unknown', REJECTED: 'rejected',
  UNDELIVERED: 'undelivered',
};

// ─── Utilities ───────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function jsonResp(body, status = 200, extraHeaders = null) {
  const headers = { 'Content-Type': 'application/json', ...CORS_HEADERS };
  if (extraHeaders) Object.assign(headers, extraHeaders);
  return new Response(JSON.stringify(body), { status, headers });
}

function jsonError(message, status = 400, details = null) {
  const body = { error: { code: status, message } };
  if (details) body.error.details = details;
  return jsonResp(body, status);
}

function unixToISO(ts) {
  if (!ts) return null;
  return new Date(Number(ts) * 1000).toISOString();
}

function isoToUnix(iso) {
  const d = new Date(iso);
  return isNaN(d) ? null : Math.floor(d.getTime() / 1000);
}

// ─── SMSAPI proxy ────────────────────────────────────────────

async function smsapiRequest(method, path, params, token) {
  const url = new URL(path, SMSAPI_BASE);
  params.set('format', 'json');

  const opts = {
    method,
    headers: { 'Authorization': `Bearer ${token}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  };

  if (method === 'POST') {
    opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    opts.body = params.toString();
  } else {
    url.search = params.toString();
  }

  let res;
  try {
    res = await fetch(url.toString(), opts);
  } catch (err) {
    return { ok: false, status: 504, message: 'Dostawca SMS nie odpowiada' };
  }

  let data;
  try {
    data = await res.json();
  } catch {
    return { ok: false, status: 502, message: 'Nieprawidłowa odpowiedź od dostawcy SMS' };
  }

  if (data.error) {
    const mapped = SMSAPI_ERRORS[data.error] || { status: 502, message: 'Błąd dostawcy SMS' };
    return { ok: false, status: mapped.status, message: mapped.message, raw: data };
  }

  return { ok: true, data };
}

// ─── Response translators ────────────────────────────────────

function translateMessageList(data, includeParts = false) {
  if (!data.list || !data.list.length) {
    return { success: true, data: { count: 0, messages: [] } };
  }
  const messages = data.list.map(m => {
    const msg = {
      id: m.id,
      to: m.number,
      status: STATUS_MAP[m.status] || 'unknown',
      cost: m.points || 0,
      sent_at: unixToISO(m.date_sent),
    };
    if (includeParts) msg.parts = m.parts || 1;
    return msg;
  });
  return {
    success: true,
    data: { count: data.count || messages.length, messages },
  };
}

function translateHlrResponse(data) {
  if (!data.list || !data.list.length) {
    return { success: true, data: null };
  }
  const h = data.list[0];
  return {
    success: true,
    data: {
      number: h.number,
      status: h.status,
      ported: h.ported || false,
      network: h.network || null,
      country: h.country_code || null,
      cost: h.points || 0,
    },
  };
}

// ─── Common param helpers ────────────────────────────────────

function applyCommonParams(params, body, client) {
  if (body.from) params.set('from', body.from);
  else if (client.sender_name) params.set('from', client.sender_name);

  if (body.date) {
    const ts = isoToUnix(body.date);
    if (!ts) return 'Nieprawidłowy format daty. Użyj ISO 8601';
    params.set('date', ts);
    params.set('date_validate', '1');
  }

  if (client.webhook_url && client.client_id) {
    params.set('notify_url', CALLBACK_BASE + client.client_id);
  }

  return null; // no error
}

// ─── Auth & Rate Limiting ────────────────────────────────────

async function authenticate(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: jsonError('Brak tokenu autoryzacji. Użyj nagłówka: Authorization: Bearer <token>', 401) };
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return { error: jsonError('Pusty token autoryzacji', 401) };
  }

  const client = await env.CLIENTS_KV.get(`token:${token}`, 'json');
  if (!client) {
    return { error: jsonError('Nieprawidłowy token autoryzacji', 401) };
  }

  const smsapiToken = client.smsapi_token || env.SMSAPI_TOKEN;
  return { client, smsapiToken };
}

async function checkRateLimit(clientId, limit, env) {
  const minute = Math.floor(Date.now() / 60000);
  const key = `rl:${clientId}:${minute}`;

  const current = parseInt(await env.CLIENTS_KV.get(key) || '0', 10);
  if (current >= limit) {
    return { limited: true, retryAfter: 60 - (Math.floor(Date.now() / 1000) % 60) };
  }

  await env.CLIENTS_KV.put(key, String(current + 1), { expirationTtl: 120 });
  return { limited: false, remaining: limit - current - 1 };
}

// ─── Endpoint Handlers ───────────────────────────────────────

async function handleSms(body, smsapiToken, client) {
  if (!body.to) return jsonError('Pole "to" jest wymagane', 422);
  if (!body.message) return jsonError('Pole "message" jest wymagane', 422);

  const params = new URLSearchParams();
  params.set('to', body.to);
  params.set('message', body.message);
  params.set('encoding', body.encoding || 'utf-8');
  params.set('details', '1');

  const err = applyCommonParams(params, body, client);
  if (err) return jsonError(err, 422);

  if (body.flash) params.set('flash', '1');
  if (body.normalize) params.set('normalize', '1');
  if (body.idx) params.set('idx', body.idx);

  const result = await smsapiRequest('POST', '/sms.do', params, smsapiToken);
  if (!result.ok) return jsonError(result.message, result.status);

  return jsonResp(translateMessageList(result.data, true));
}

async function handleSmsBulk(body, smsapiToken, client) {
  if (!body.messages && !body.recipients) {
    return jsonError('Pole "messages" lub "recipients" jest wymagane', 422);
  }

  // Case 1: same message to multiple recipients
  if (body.recipients && body.message) {
    if (!Array.isArray(body.recipients) || body.recipients.length === 0) {
      return jsonError('Pole "recipients" musi być niepustą tablicą', 422);
    }
    if (body.recipients.length > 10000) {
      return jsonError('Maksymalnie 10 000 odbiorców na żądanie', 422);
    }

    const params = new URLSearchParams();
    params.set('to', body.recipients.join(','));
    params.set('message', body.message);
    params.set('encoding', body.encoding || 'utf-8');
    params.set('details', '1');

    const err = applyCommonParams(params, body, client);
    if (err) return jsonError(err, 422);

    const result = await smsapiRequest('POST', '/sms.do', params, smsapiToken);
    if (!result.ok) return jsonError(result.message, result.status);
    return jsonResp(translateMessageList(result.data, true));
  }

  // Case 2: different messages per recipient
  if (Array.isArray(body.messages)) {
    if (body.messages.length === 0) return jsonError('Tablica "messages" jest pusta', 422);
    if (body.messages.length > 100) {
      return jsonError('Maksymalnie 100 wiadomości na żądanie (dla indywidualnych treści)', 422);
    }

    const CHUNK = 50;
    const promises = body.messages.map(msg => {
      if (!msg.to || !msg.message) return Promise.resolve(null);
      const params = new URLSearchParams();
      params.set('to', msg.to);
      params.set('message', msg.message);
      params.set('encoding', 'utf-8');
      params.set('details', '1');
      const err = applyCommonParams(params, msg, client);
      if (err) return Promise.resolve({ ok: false, status: 422, message: err });
      return smsapiRequest('POST', '/sms.do', params, smsapiToken);
    });

    // Process in chunks to avoid upstream rate limits
    const results = [];
    for (let i = 0; i < promises.length; i += CHUNK) {
      const chunk = await Promise.all(promises.slice(i, i + CHUNK));
      results.push(...chunk);
    }
    const allMessages = results.map((r, i) => {
      const msg = body.messages[i];
      if (!r) {
        return { to: msg.to, status: 'error', error: 'Brak wymaganych pól' };
      }
      if (!r.ok) {
        return { to: msg.to, status: 'error', error: r.message };
      }
      if (r.data.list && r.data.list[0]) {
        const m = r.data.list[0];
        return {
          id: m.id, to: m.number,
          status: STATUS_MAP[m.status] || 'unknown',
          parts: m.parts || 1, cost: m.points || 0,
        };
      }
      return { to: msg.to, status: 'unknown' };
    });

    return jsonResp({
      success: true,
      data: { count: allMessages.length, messages: allMessages },
    });
  }

  return jsonError('Nieprawidłowy format żądania bulk', 422);
}

async function handleMms(body, smsapiToken, client) {
  if (!body.to) return jsonError('Pole "to" jest wymagane', 422);
  if (!body.subject) return jsonError('Pole "subject" jest wymagane', 422);
  if (!body.smil) return jsonError('Pole "smil" (SMIL markup) jest wymagane', 422);

  const params = new URLSearchParams();
  params.set('to', body.to);
  params.set('subject', body.subject);
  params.set('smil', body.smil);

  const err = applyCommonParams(params, body, client);
  if (err) return jsonError(err, 422);

  const result = await smsapiRequest('POST', '/mms.do', params, smsapiToken);
  if (!result.ok) return jsonError(result.message, result.status);

  return jsonResp(translateMessageList(result.data));
}

async function handleVms(body, smsapiToken, client) {
  if (!body.to) return jsonError('Pole "to" jest wymagane', 422);
  if (!body.tts) return jsonError('Pole "tts" (tekst do odczytania) jest wymagane', 422);

  const lectors = ['ewa', 'jacek', 'jan', 'maja'];
  const lector = body.tts_lector || 'ewa';
  if (!lectors.includes(lector)) {
    return jsonError(`Pole "tts_lector" musi być jednym z: ${lectors.join(', ')}`, 422);
  }

  const params = new URLSearchParams();
  params.set('to', body.to);
  params.set('tts', body.tts);
  params.set('tts_lector', lector);

  const err = applyCommonParams(params, body, client);
  if (err) return jsonError(err, 422);

  if (body.tries) params.set('tries', Math.min(Math.max(parseInt(body.tries) || 1, 1), 6));

  const result = await smsapiRequest('POST', '/vms.do', params, smsapiToken);
  if (!result.ok) return jsonError(result.message, result.status);

  return jsonResp(translateMessageList(result.data));
}

async function handleHlr(url, smsapiToken) {
  const number = url.searchParams.get('number');
  if (!number) return jsonError('Parametr "number" jest wymagany', 422);

  const params = new URLSearchParams();
  params.set('number', number);

  const result = await smsapiRequest('GET', '/hlr.do', params, smsapiToken);
  if (!result.ok) return jsonError(result.message, result.status);

  return jsonResp(translateHlrResponse(result.data));
}

async function handleBalance(smsapiToken) {
  const params = new URLSearchParams();
  const result = await smsapiRequest('GET', '/profile', params, smsapiToken);
  if (!result.ok) return jsonError(result.message, result.status);

  const data = result.data;
  return jsonResp({
    success: true,
    data: {
      balance: data.points || 0,
      currency: 'PLN',
      username: data.username || null,
    },
  });
}

// ─── Callback (DLR) Handler ──────────────────────────────────

function parseSmsapiParams(request) {
  if (request.method === 'POST') {
    return request.text().then(t => new URLSearchParams(t));
  }
  return Promise.resolve(new URL(request.url).searchParams);
}

async function handleCallback(clientId, request, env, ctx) {
  const clientData = await env.CLIENTS_KV.get(`client:${clientId}`, 'json');
  if (!clientData || !clientData.webhook_url) {
    return new Response('OK', { status: 200 });
  }

  const dlrParams = await parseSmsapiParams(request);
  const payload = {
    event: 'delivery_report',
    message_id: dlrParams.get('MsgId') || null,
    to: dlrParams.get('to') || null,
    status: STATUS_MAP[(dlrParams.get('status') || '').toUpperCase()] || dlrParams.get('status_name') || 'unknown',
    sent_at: unixToISO(dlrParams.get('sent_at')),
    done_at: unixToISO(dlrParams.get('donedate')),
    idx: dlrParams.get('idx') || null,
  };

  // Fire-and-forget — respond OK to SMSAPI immediately
  ctx.waitUntil(
    fetch(clientData.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    }).catch(err => console.error('DLR forward failed:', clientId, err.message))
  );

  return new Response('OK', { status: 200 });
}

// ─── Incoming SMS Handler ────────────────────────────────────

async function handleIncoming(request, env, ctx) {
  const params = await parseSmsapiParams(request);

  const clientId = params.get('username') || 'default';
  const clientData = await env.CLIENTS_KV.get(`client:${clientId}`, 'json');

  if (clientData && clientData.webhook_url) {
    const payload = {
      event: 'incoming_sms',
      message_id: params.get('MsgId'),
      from: params.get('sms_from'),
      to: params.get('sms_to'),
      message: params.get('sms_text'),
      received_at: new Date().toISOString(),
    };

    ctx.waitUntil(
      fetch(clientData.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      }).catch(err => console.error('Incoming SMS forward failed:', clientId, err.message))
    );
  }

  return new Response('OK', { status: 200 });
}

// ─── Main Router ─────────────────────────────────────────────

const HEALTH_RESPONSE = JSON.stringify({
  status: 'ok',
  service: 'Przypominamy.com API',
  version: '1.0',
  endpoints: ['/v1/sms', '/v1/sms/bulk', '/v1/mms', '/v1/vms', '/v1/hlr', '/v1/balance'],
});

// Endpoint name lookup for permission check
const ENDPOINT_MAP = {
  '/v1/sms': 'sms',
  '/v1/sms/bulk': 'sms/bulk',
  '/v1/mms': 'mms',
  '/v1/vms': 'vms',
  '/v1/hlr': 'hlr',
  '/v1/balance': 'balance',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Health check
    if (path === '/v1/health' || path === '/v1') {
      return new Response(HEALTH_RESPONSE, {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // Callback endpoints (no auth — SMSAPI sends these)
    if (path.startsWith('/v1/callback/')) {
      const clientId = path.slice('/v1/callback/'.length).replace(/\/+$/, '');
      if (clientId && /^[a-zA-Z0-9_-]+$/.test(clientId)) {
        return handleCallback(clientId, request, env, ctx);
      }
      return new Response('OK', { status: 200 });
    }

    if (path === '/v1/incoming') {
      return handleIncoming(request, env, ctx);
    }

    // ── Authenticated endpoints ──

    const auth = await authenticate(request, env);
    if (auth.error) return auth.error;

    const { client, smsapiToken } = auth;

    // Rate limiting
    const rl = await checkRateLimit(client.client_id, client.rate_limit || 100, env);
    if (rl.limited) {
      return jsonResp(
        { error: { code: 429, message: 'Przekroczono limit żądań. Spróbuj ponownie za chwilę.' } },
        429,
        { 'Retry-After': String(rl.retryAfter) }
      );
    }

    // Check endpoint access
    const endpointName = ENDPOINT_MAP[path];
    if (!endpointName) {
      return jsonError(`Nieznany endpoint: ${method} ${path}`, 404);
    }
    if (client.allowed_endpoints && !client.allowed_endpoints.includes(endpointName)) {
      return jsonError(`Brak dostępu do endpointu: ${path}`, 403);
    }

    // Parse JSON body for POST requests
    let body = {};
    if (method === 'POST') {
      try {
        body = await request.json();
      } catch {
        return jsonError('Nieprawidłowy JSON w treści żądania', 400);
      }
    }

    // Route to handler
    if (path === '/v1/sms' && method === 'POST') return handleSms(body, smsapiToken, client);
    if (path === '/v1/sms/bulk' && method === 'POST') return handleSmsBulk(body, smsapiToken, client);
    if (path === '/v1/mms' && method === 'POST') return handleMms(body, smsapiToken, client);
    if (path === '/v1/vms' && method === 'POST') return handleVms(body, smsapiToken, client);
    if (path === '/v1/hlr' && method === 'GET') return handleHlr(url, smsapiToken);
    if (path === '/v1/balance' && method === 'GET') return handleBalance(smsapiToken);

    return jsonError(`Nieznany endpoint: ${method} ${path}`, 404);
  },
};
