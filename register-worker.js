/**
 * register-worker.js — Cloudflare Worker
 * POST /api/register
 * Body: { email, company, name, phone, nip?, industry?, volume?, usecase?, website (honeypot) }
 *
 * Flow:
 *  1. Honeypot check — if `website` filled, return silent 200 (don't tip off bots)
 *  2. Validate input (email regex, required fields)
 *  3. Send notification email to owner (env.NOTIFY_EMAIL) with full data
 *  4. Send confirmation email to user: "we review in 24h"
 *  5. Save to KV (optional, env.REGISTRATIONS_KV) — 90 days TTL
 *  6. Return { success: true }
 *
 * Required secrets:
 *   NOTIFY_EMAIL — owner's email for new registration notifications
 *
 * Deploy: wrangler deploy --config register.toml
 */

async function sendEmail({ to, toName, subject, text, fromEmail, fromName }) {
  const res = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to, name: toName }] }],
      from: { email: fromEmail, name: fromName },
      subject,
      content: [{ type: 'text/plain', value: text }],
    }),
  });

  if (res.status !== 202 && res.status !== 200) {
    const body = await res.text();
    throw new Error(`MailChannels error ${res.status}: ${body}`);
  }
}

function buildOwnerEmail(reg) {
  return `Nowe zgłoszenie rejestracji z przypominamy.com/register

DANE ZGŁOSZENIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Imię i nazwisko: ${reg.name}
Email:           ${reg.email}
Telefon:         ${reg.phone}
Firma:           ${reg.company}
NIP:             ${reg.nip || 'nie podano'}
Branża:          ${reg.industry || 'nie podano'}
Wolumen SMS/mc:  ${reg.volume || 'nie podano'}

Opis potrzeb:
${reg.usecase || 'nie podano'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Zgłoszenie odebrane: ${new Date().toISOString()}

AKCJE:
1. Zweryfikuj firmę (NIP, strona WWW, dane kontaktowe)
2. Utwórz konto w panelu.przypominamy.com
3. Wyślij dane dostępu na: ${reg.email}

Odpowiedz: mailto:${reg.email}
`;
}

function buildUserEmail(reg) {
  return `Cześć ${reg.name.split(' ')[0]},

Dziękujemy za zgłoszenie do Przypominamy.com.

Otrzymaliśmy Twoje dane i w ciągu 24 godzin zweryfikujemy zgłoszenie. Po pozytywnej weryfikacji wyślemy Ci dane dostępu do panelu na ten adres email.

Co sprawdzamy?
• Zgodność danych firmy (NIP, branża)
• Dopasowanie platformy do Twoich potrzeb
• Kompletność zgłoszenia

Jeśli coś będzie wymagało doprecyzowania, odezwiemy się bezpośrednio.

W międzyczasie możesz przejrzeć dokumentację na:
https://przypominamy.com

Pozdrawiam,
Paweł Mamcarz
Przypominamy.com · support@przypominamy.com
`;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }
    if (request.method !== 'POST') {
      return jsonResp({ error: 'Method Not Allowed' }, 405);
    }

    let reg;
    try {
      reg = await request.json();
    } catch {
      return jsonResp({ error: 'Invalid JSON' }, 400);
    }

    // === 1. Honeypot — silent success if triggered ===
    if (reg.website && reg.website.trim() !== '') {
      return jsonResp({ success: true, message: 'OK' });
    }

    // === 2. Validation ===
    const { email, company, name, phone } = reg;
    if (!email || !company || !name || !phone) {
      return jsonResp({ error: 'Pola email, firma, imię i telefon są wymagane' }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResp({ error: 'Nieprawidłowy adres email' }, 400);
    }

    const FROM_EMAIL = env.FROM_EMAIL || 'rejestracja@przypominamy.com';
    const FROM_NAME = 'Przypominamy.com';
    const NOTIFY = env.NOTIFY_EMAIL;

    // === 3. Notify owner ===
    if (NOTIFY) {
      try {
        await sendEmail({
          to: NOTIFY,
          toName: 'Przypominamy Support',
          subject: `[REJESTRACJA] ${company} · ${name} · ${email}`,
          text: buildOwnerEmail(reg),
          fromEmail: FROM_EMAIL,
          fromName: FROM_NAME,
        });
      } catch (err) {
        console.error('Owner notify failed:', err);
      }
    }

    // === 4. Confirm to user ===
    try {
      await sendEmail({
        to: email,
        toName: name,
        subject: 'Twoje zgłoszenie do Przypominamy.com',
        text: buildUserEmail(reg),
        fromEmail: FROM_EMAIL,
        fromName: FROM_NAME,
      });
    } catch (err) {
      console.error('User confirm failed:', err);
    }

    // === 5. Save to KV (optional) ===
    if (env.REGISTRATIONS_KV) {
      try {
        const key = `reg_${Date.now()}_${email.replace(/[^a-z0-9]/gi, '_')}`;
        await env.REGISTRATIONS_KV.put(
          key,
          JSON.stringify({ ...reg, createdAt: new Date().toISOString() }),
          { expirationTtl: 60 * 60 * 24 * 90 }
        );
      } catch (err) {
        console.error('KV save failed:', err);
      }
    }

    return jsonResp({
      success: true,
      message: 'Dziękujemy, sprawdzimy zgłoszenie w ciągu 24 godzin.',
    });
  },
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': 'https://przypominamy.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResp(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}
