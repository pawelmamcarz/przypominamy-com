/**
 * chat-worker.js — Cloudflare Worker
 * POST /api/chat
 * Body: { messages: [{role: "user"|"assistant", content: string}] }
 * Returns: text/event-stream (Anthropic streaming format)
 *
 * Required secret: ANTHROPIC_API_KEY
 * Deploy: wrangler deploy chat-worker.js --name przypominamy-chat
 */

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

const SYSTEM_PROMPT = `Jesteś pomocnym asystentem sprzedaży platformy Przypominamy.com — polskiej platformy do masowej komunikacji mobilnej.

TWOJA WIEDZA O PLATFORMIE:
- Usługi: wysyłka SMS (jednostronna i dwukierunkowa), MMS (z grafiką/wideo), IVR/TTS (wiadomości głosowe)
- Kanały: wszystkie polskie sieci komórkowe (Plus, Orange, T-Mobile, Play), zasięg: wszystkie kraje UE (27 państw) oraz Australia i UK
- Panel: zarządzanie kampaniami, szablony z personalizacją ({Imię}, {Termin} itp.), import CSV, raporty w czasie rzeczywistym
- API: REST API v1.7, tokeny Bearer, webhooks/callbacki, bulk import, dokumentacja PDF dostępna online
- Integracje: CRM, ERP, sklepy e-commerce, systemy rezerwacji

CENNIK (orientacyjny):
- Starter: 0,15 zł/SMS, min. doładowanie 100 zł — dla małych firm
- Business: 0,10 zł/SMS, min. doładowanie 500 zł — pełne funkcje + API
- Enterprise: negocjowane — dedykowany opiekun, SLA, multi-konto

ZASTOSOWANIA:
- Medycyna: potwierdzenia i przypomnienia wizyt, odwoływanie
- E-commerce: potwierdzenia zamówień, statusy przesyłek, promocje
- Finanse: alerty transakcyjne, weryfikacja 2FA, wezwania do zapłaty
- Motoryzacja: serwis, badania techniczne, umówienie wizyty
- Media: powiadomienia push, przedłużenie subskrypcji
- HR: komunikacja wewnętrzna, potwierdzenia spotkań

STYL ODPOWIEDZI:
- Odpowiadaj po polsku, konkretnie i pomocnie
- Jeśli klient pyta o cenę — podaj orientacyjny przedział i zaproponuj wypełnienie formularza zamówienia dla spersonalizowanej wyceny
- Jeśli pyta o integrację techniczną — możesz podać przykład kodu API
- Bądź przyjazny, profesjonalny, nie przesadzaj z formalizmem
- Odpowiedzi trzymaj do 3-4 zdań (chyba że pytanie wymaga więcej)
- Nie wymyślaj funkcji ani cen których nie znasz — zaproponuj kontakt z support@przypominamy.com`;

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError('Invalid JSON', 400);
    }

    const { messages } = body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return jsonError('messages array required', 400);
    }

    // Keep last 20 messages to stay within context limits
    const trimmedMessages = messages.slice(-20);

    // Call Anthropic with streaming
    const anthropicRes = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: trimmedMessages,
        stream: true,
      }),
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text();
      console.error('Anthropic error:', err);
      return jsonError('AI service error', 502);
    }

    // Stream the SSE response back to the client
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Process the Anthropic SSE stream
    (async () => {
      const reader = anthropicRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          // Buffer chunks — JSON may span multiple network reads
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          // Keep the last (potentially incomplete) line in the buffer
          buffer = lines.pop();

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (!data) continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                const token = parsed.delta.text;
                await writer.write(encoder.encode(
                  `data: ${JSON.stringify({ delta: { text: token } })}\n\n`
                ));
              }
            } catch {}
          }
        }
        await writer.write(encoder.encode('data: [DONE]\n\n'));
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};

function jsonError(msg, status) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
