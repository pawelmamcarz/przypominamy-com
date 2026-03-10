/**
 * order-worker.js — Cloudflare Worker
 * POST /api/order
 * Body: { name, email, company, industry, phone, services[], volume, usecase, extra }
 *
 * Flow:
 *  1. Validate input
 *  2. Call Claude (Haiku) to generate a personalized proposal in Polish
 *  3. Send proposal email to the customer via MailChannels
 *  4. Save order to KV (optional — uncomment if KV binding configured)
 *  5. Return { success: true }
 *
 * Required secrets:
 *   ANTHROPIC_API_KEY — Anthropic API key
 *   NOTIFY_EMAIL      — internal notification email (e.g. owner's Gmail)
 *
 * Deploy: wrangler deploy order-worker.js --name przypominamy-order
 */

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

// ── Proposal prompt ──────────────────────────────────────────────────────────
function buildProposalPrompt(order) {
  return `Jesteś ekspertem sprzedaży platformy Przypominamy.com (polska platforma SMS/MMS/IVR).
Klient wypełnił formularz zamówienia. Przygotuj dla niego spersonalizowaną ofertę handlową w języku polskim.

DANE KLIENTA:
- Imię i nazwisko: ${order.name}
- Firma: ${order.company}
- Branża: ${order.industry || 'nie podano'}
- Telefon: ${order.phone || 'nie podano'}
- Zainteresowane usługi: ${(order.services || []).join(', ') || 'nie podano'}
- Szacowany wolumen: ${order.volume || 'nie podano'} wiadomości/miesiąc
- Opis potrzeb: ${order.usecase || 'nie podano'}
- Dodatkowe uwagi: ${order.extra || 'brak'}

CENNIK ORIENTACYJNY:
- Starter: 0,09 zł/SMS (min. doładowanie 100 zł) — SMS, podstawowy panel
- Business: 0,08 zł/SMS (min. doładowanie 500 zł) — SMS+MMS+IVR, API, raporty
- Enterprise: od 0,07 zł/SMS (negocjowane) — dedykowany opiekun, SLA, multi-konto

INSTRUKCJE:
1. Przywitaj klienta po imieniu
2. Podsumuj krótko czego szuka
3. Zaproponuj konkretny plan (Starter/Business/Enterprise) z uzasadnieniem
4. Podaj szacunkowy koszt miesięczny (na podstawie wolumenu)
5. Wymień 2-3 funkcje szczególnie przydatne w jego branży
6. Zakończ zaproszeniem do kontaktu i linkiem do panelu: https://panel.przypominamy.com
7. Stopka: Przypominamy.com · support@przypominamy.com

Format: czysty tekst (bez markdown, bez gwiazdek). Długość: 200-300 słów. Ton: profesjonalny ale przyjazny.`;
}

// ── Generate proposal via Claude ─────────────────────────────────────────────
async function generateProposal(order, apiKey) {
  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: buildProposalPrompt(order) }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic error: ${err}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || '';
}

// ── Send email via MailChannels ───────────────────────────────────────────────
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

  // MailChannels returns 202 on success
  if (res.status !== 202 && res.status !== 200) {
    const body = await res.text();
    throw new Error(`MailChannels error ${res.status}: ${body}`);
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(),
      });
    }

    if (request.method !== 'POST') {
      return jsonResp({ error: 'Method Not Allowed' }, 405);
    }

    let order;
    try {
      order = await request.json();
    } catch {
      return jsonResp({ error: 'Invalid JSON' }, 400);
    }

    // Basic validation
    const { name, email, company, services, volume } = order;
    if (!name || !email || !company) {
      return jsonResp({ error: 'Pola name, email i company są wymagane' }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResp({ error: 'Nieprawidłowy adres email' }, 400);
    }
    if (!services?.length || !volume) {
      return jsonResp({ error: 'Pola services i volume są wymagane' }, 400);
    }

    // === 1. Generate proposal with Claude ===
    let proposal;
    try {
      proposal = await generateProposal(order, env.ANTHROPIC_API_KEY);
    } catch (err) {
      console.error('Proposal generation failed:', err);
      // Fallback proposal if Claude call fails
      proposal = `Szanowny/a ${name},\n\nDziękujemy za zainteresowanie platformą Przypominamy.com!\n\nOtrzymaliśmy Twoje zgłoszenie i wkrótce skontaktujemy się z przygotowaną ofertą.\n\nPozdrawiamy,\nZespół Przypominamy.com\nsupport@przypominamy.com`;
    }

    // The from address — use a verified sender domain
    // IMPORTANT: the domain used in fromEmail must have SPF/DKIM configured for MailChannels
    // Set NOTIFY_EMAIL secret to your working email (e.g. your Gmail or company email)
    const FROM_EMAIL = env.FROM_EMAIL || 'oferta@przypominamy.com';
    const FROM_NAME  = 'Przypominamy.com';
    const INTERNAL_NOTIFY = env.NOTIFY_EMAIL; // optional internal copy

    // === 2. Send proposal email to customer ===
    try {
      await sendEmail({
        to: email,
        toName: name,
        subject: `Twoja oferta od Przypominamy.com — ${(services || []).join(' + ')}`,
        text: proposal,
        fromEmail: FROM_EMAIL,
        fromName: FROM_NAME,
      });
    } catch (err) {
      console.error('Customer email failed:', err);
      // Don't fail the whole request — still save the order
    }

    // === 3. Send internal notification (optional) ===
    if (INTERNAL_NOTIFY) {
      try {
        const summary = `Nowe zamówienie z formularza:\n\nImię: ${name}\nEmail: ${email}\nFirma: ${company}\nBranża: ${order.industry || '—'}\nUsługi: ${(services||[]).join(', ')}\nWolumen: ${volume}\nOpis: ${order.usecase || '—'}\n\n---\nOFERTA WYSŁANA DO KLIENTA:\n\n${proposal}`;
        await sendEmail({
          to: INTERNAL_NOTIFY,
          toName: 'Przypominamy Support',
          subject: `[ZAMÓWIENIE] ${name} · ${company} · ${(services||[]).join('+')}`,
          text: summary,
          fromEmail: FROM_EMAIL,
          fromName: FROM_NAME,
        });
      } catch (err) {
        console.error('Internal notify failed:', err);
      }
    }

    // === 4. Save to KV (optional) ===
    if (env.ORDERS_KV) {
      try {
        const key = `order_${Date.now()}_${email.replace(/[^a-z0-9]/gi, '_')}`;
        await env.ORDERS_KV.put(key, JSON.stringify({
          ...order,
          proposal,
          createdAt: new Date().toISOString(),
        }), { expirationTtl: 60 * 60 * 24 * 90 }); // keep 90 days
      } catch (err) {
        console.error('KV save failed:', err);
      }
    }

    return jsonResp({ success: true, message: 'Oferta wysłana na podany adres email.' });
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
