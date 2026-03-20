/**
 * email-worker.js — Cloudflare Email Worker
 *
 * Obsługuje przychodzące emaile na support@przypominamy.com:
 *  1. Parsuje treść wiadomości
 *  2. Generuje odpowiedź przez Claude (Haiku)
 *  3. Odsyła odpowiedź do nadawcy przez MailChannels
 *  4. Opcjonalnie: forwarduje oryginał + odpowiedź do FORWARD_TO
 *
 * Required secrets:
 *   ANTHROPIC_API_KEY — klucz Anthropic API
 *   FORWARD_TO        — Twój prywatny email do kopii (np. pawel@mamcarz.com)
 *
 * Deploy:
 *   wrangler deploy email-worker.js --name przypominamy-email
 *
 * Podpięcie w Cloudflare Dashboard:
 *   Email → Email Routing → Routing Rules → Send to a Worker → przypominamy-email
 */

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

const SUPPORT_SYSTEM_PROMPT = `Jesteś agentem wsparcia technicznego i sprzedażowego platformy Przypominamy.com.

TWOJA WIEDZA:
- Platforma do masowej wysyłki SMS, MMS i wiadomości głosowych (IVR/TTS)
- Zasięg: wszystkie polskie sieci (Plus, Orange, T-Mobile, Play), Australia, UK, Czechy i inne
- Panel: kampanie, szablony z personalizacją, import CSV, raporty real-time
- API: REST API v1.7, tokeny Bearer, webhooks, bulk import
- Integracje: CRM, ERP, e-commerce, systemy rezerwacji

CENNIK:
- Starter: 0,15 zł/SMS, min. doładowanie 100 zł
- Business: 0,10 zł/SMS, min. doładowanie 500 zł — pełne funkcje + API
- Enterprise: cena negocjowana od wolumenu — dedykowany opiekun

TYPOWE PYTANIA I ODPOWIEDZI:
- Jak zacząć? → Rejestracja na panel.przypominamy.com, weryfikacja firmy, doładowanie
- Jak działa API? → REST API, dokumentacja na stronie, tokeny Bearer
- Problem techniczny? → Poproś o nr konta lub opis błędu, eskaluj do zespołu technicznego
- Cennik dla dużych wolumenów? → Zaproponuj kontakt handlowy, zaoferuj Enterprise

STYL:
- Odpowiadaj PO POLSKU, chyba że email jest po angielsku — wtedy odpowiedz po angielsku
- Ton: profesjonalny, pomocny, przyjazny
- Długość: 3-6 zdań, konkretnie na temat
- Zawsze kończ podpisem: Zespół Przypominamy.com
- Jeśli problem wykracza poza Twoją wiedzę — napisz że przekazujesz sprawę do zespołu i odpiszą w ciągu 1 dnia roboczego
- NIE wymyślaj funkcji ani cen których nie znasz`;

// ── Parse raw email stream ────────────────────────────────────────────────────
async function parseEmail(message) {
  const rawText = await streamToText(message.raw);

  // Extract subject from headers
  const subjectMatch = rawText.match(/^Subject:\s*(.+)$/im);
  const subject = subjectMatch ? subjectMatch[1].trim() : '(brak tematu)';

  // Try to extract plain text body (after blank line following headers)
  // Simple heuristic: find the first blank line and take everything after
  const headerBodySplit = rawText.indexOf('\r\n\r\n');
  let body = headerBodySplit !== -1
    ? rawText.slice(headerBodySplit + 4)
    : rawText;

  // Strip quoted reply chains (lines starting with ">")
  body = body
    .split('\n')
    .filter(l => !l.trim().startsWith('>'))
    .join('\n')
    .trim();

  // Truncate to ~2000 chars to stay within prompt budget
  if (body.length > 2000) {
    body = body.slice(0, 2000) + '\n[... treść obcięta ...]';
  }

  return { subject, body };
}

async function streamToText(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  return result;
}

// ── Generate reply via Claude ─────────────────────────────────────────────────
async function generateReply(fromName, fromEmail, subject, body, apiKey) {
  const userContent = `Otrzymałeś email od klienta. Napisz profesjonalną odpowiedź.

NADAWCA: ${fromName || fromEmail}
EMAIL: ${fromEmail}
TEMAT: ${subject}

TREŚĆ WIADOMOŚCI:
${body}

Napisz teraz odpowiedź (sam tekst odpowiedzi, bez nagłówka "Odpowiedź:").`;

  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: SUPPORT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic error: ${err}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || '';
}

// ── Send reply via MailChannels ───────────────────────────────────────────────
async function sendReply({ to, toName, replySubject, replyText }) {
  const res = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to, name: toName || to }] }],
      from: { email: 'support@przypominamy.com', name: 'Przypominamy.com Support' },
      subject: replySubject,
      content: [{ type: 'text/plain', value: replyText }],
    }),
  });

  if (res.status !== 202 && res.status !== 200) {
    const body = await res.text();
    throw new Error(`MailChannels error ${res.status}: ${body}`);
  }
}

// ── Main Email handler ────────────────────────────────────────────────────────
export default {
  async email(message, env, ctx) {
    const fromEmail = message.from;
    const toEmail = message.to;

    // Extract sender name from "Name <email>" format
    const fromRaw = message.headers?.get('from') || fromEmail;
    const nameMatch = fromRaw.match(/^"?([^<"]+)"?\s*</);
    const fromName = nameMatch ? nameMatch[1].trim() : '';

    let subject = '(brak tematu)';
    let body = '';

    // Parse email content
    try {
      const parsed = await parseEmail(message);
      subject = parsed.subject;
      body = parsed.body;
    } catch (err) {
      console.error('Email parse error:', err);
      body = '(nie udało się odczytać treści wiadomości)';
    }

    console.log(`Incoming email from ${fromEmail}: ${subject}`);

    // Generate AI reply
    let reply = '';
    try {
      reply = await generateReply(fromName, fromEmail, subject, body, env.ANTHROPIC_API_KEY);
    } catch (err) {
      console.error('Reply generation failed:', err);
      // Fallback reply
      reply = `Szanowny/a ${fromName || 'Kliencie'},

Dziękujemy za kontakt z platformą Przypominamy.com.

Otrzymaliśmy Twoją wiadomość i odpiszemy najszybciej jak to możliwe — zwykle w ciągu 1 dnia roboczego.

W pilnych sprawach możesz też skontaktować się przez formularz na stronie: https://przypominamy.com

Pozdrawiamy,
Zespół Przypominamy.com`;
    }

    // Send reply to customer
    const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
    try {
      await sendReply({
        to: fromEmail,
        toName: fromName,
        replySubject,
        replyText: reply,
      });
      console.log(`Reply sent to ${fromEmail}`);
    } catch (err) {
      console.error('Failed to send reply:', err);
    }

    // Forward original + reply to internal email (FORWARD_TO secret)
    if (env.FORWARD_TO) {
      try {
        const forwardText = `=== NOWY EMAIL OD KLIENTA ===
Od: ${fromName ? `${fromName} <${fromEmail}>` : fromEmail}
Temat: ${subject}

--- TREŚĆ ---
${body}

=== AUTOMATYCZNA ODPOWIEDŹ WYSŁANA DO KLIENTA ===
${reply}`;

        await sendReply({
          to: env.FORWARD_TO,
          toName: 'Przypominamy Support',
          replySubject: `[SUPPORT] ${fromName || fromEmail}: ${subject}`,
          replyText: forwardText,
        });
      } catch (err) {
        console.error('Forward failed:', err);
      }
    }
  },
};
