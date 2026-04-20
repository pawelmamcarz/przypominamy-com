/**
 * Cloudflare Worker – Contact Form Handler
 * Deploy to: workers.cloudflare.com
 *
 * Receives JSON from the contact form and forwards
 * to support@przypominamy.com via MailChannels (free on Cloudflare Workers).
 *
 * STATUS: UNUSED — kept for future contact form page.
 * Current order flow goes through order-worker.js (/api/order).
 * No route is configured in any .toml and no frontend form POSTs here.
 */

export default {
  async fetch(request, env) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'https://przypominamy.com',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const data = await request.json();
      const { name, email, company, service, message } = data;

      // Basic validation
      if (!name || !email || !message) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Send via MailChannels (no API key needed on Cloudflare Workers)
      const emailPayload = {
        personalizations: [{
          to: [{ email: 'support@przypominamy.com', name: 'Przypominamy.com' }],
          reply_to: { email, name },
        }],
        from: { email: 'noreply@przypominamy.com', name: 'Formularz kontaktowy' },
        subject: `Nowe zapytanie: ${service} — ${name}`,
        content: [{
          type: 'text/plain',
          value: [
            `Imię i nazwisko: ${name}`,
            `E-mail: ${email}`,
            `Firma: ${company || '(nie podano)'}`,
            `Interesuje mnie: ${service}`,
            '',
            `Wiadomość:`,
            message,
          ].join('\n'),
        }],
      };

      const resp = await fetch('https://api.mailchannels.net/tx/v1/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailPayload),
      });

      if (!resp.ok) {
        console.error('MailChannels error:', await resp.text());
        throw new Error('Email send failed');
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (err) {
      console.error(err);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
