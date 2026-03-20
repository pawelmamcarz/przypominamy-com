# Deployment — przypominamy.com → Cloudflare

Kompletna instrukcja: GitHub → Cloudflare Pages + Workers + Email Routing.

---

## 1. Wypchnij repo na GitHub

```bash
# Stwórz nowe repo na github.com/new (np. "przypominamy-com"), następnie:
cd przypominamy.com
git remote add origin https://github.com/TWOJ_LOGIN/przypominamy-com.git
git push -u origin main
```

---

## 2. Podłącz Cloudflare Pages

1. Zaloguj się na **dash.cloudflare.com** → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
2. Wybierz repo `przypominamy-com`
3. Ustawienia build:
   - **Framework preset:** None
   - **Build command:** *(puste)*
   - **Build output directory:** `.`
4. Kliknij **Save and Deploy**

Cloudflare automatycznie przypisze domenę `przypominamy-com.pages.dev`.

### Podpięcie własnej domeny

W Cloudflare Pages → **Custom domains** → **Set up a custom domain** → wpisz `przypominamy.com`.
Cloudflare automatycznie doda rekord CNAME.

---

## 3. Wdróż Workers

### Instalacja Wrangler (jednorazowo)

```bash
npm install -g wrangler
wrangler login   # otworzy przeglądarkę do autoryzacji
```

### Chat Worker

```bash
wrangler deploy chat-worker.js --name przypominamy-chat

# Ustaw sekret:
wrangler secret put ANTHROPIC_API_KEY --name przypominamy-chat
# Wklej klucz z console.anthropic.com/settings/keys
```

### Order Worker

```bash
wrangler deploy order-worker.js --name przypominamy-order

# Ustaw sekrety:
wrangler secret put ANTHROPIC_API_KEY --name przypominamy-order
wrangler secret put NOTIFY_EMAIL      --name przypominamy-order
# → Twój email do powiadomień (np. pawel@mamcarz.com)
wrangler secret put FROM_EMAIL        --name przypominamy-order
# → Nadawca ofert (np. oferta@przypominamy.com) — musi mieć SPF/DKIM w DNS

# Opcjonalnie — KV do zapisu zamówień:
wrangler kv:namespace create ORDERS_KV
# Skopiuj ID z outputu i wklej do wrangler.toml w sekcji [[kv_namespaces]]
```

---

## 4. Połącz Workers z Pages (routing API)

W Cloudflare Dashboard → **Workers & Pages** → `przypominamy-com` (Pages) → **Settings** → **Functions** → **KV namespace bindings** / **Route bindings**

Lub szybciej — dodaj ręcznie Worker Routes w DNS:

1. Cloudflare Dashboard → **Workers & Pages** → `przypominamy-chat` → **Triggers** → **Add route**
   - Route: `przypominamy.com/api/chat*`
   - Zone: `przypominamy.com`

2. Tak samo dla `przypominamy-order`:
   - Route: `przypominamy.com/api/order*`
   - Zone: `przypominamy.com`

---

## 5. Email Routing — agent odpowiedzi (email-worker.js)

> support@przypominamy.com nie działa → przekieruj do Cloudflare Email Routing

### A. Włącz Cloudflare Email Routing

1. Cloudflare Dashboard → `przypominamy.com` → **Email** → **Email Routing** → **Enable**
2. Cloudflare doda automatycznie rekordy MX i TXT do DNS
3. Kliknij **Add address** → `support@przypominamy.com` → Forward to: Twój email (np. `pawel@mamcarz.com`)

### B. Wdróż Email Worker (obsługuje przychodzące emaile + Claude odpowiada)

```bash
wrangler deploy email-worker.js --name przypominamy-email

wrangler secret put ANTHROPIC_API_KEY --name przypominamy-email
wrangler secret put FORWARD_TO        --name przypominamy-email
# → Twój email docelowy (np. pawel@mamcarz.com)
```

### C. Podepnij Email Worker do adresu

Cloudflare Dashboard → **Email** → **Email Routing** → **Routing Rules** →
zamiast "Forward to email" wybierz **"Send to a Worker"** → `przypominamy-email`

---

## 6. SPF / DKIM dla MailChannels (wysyłka maili z order-worker)

Dodaj do DNS (Cloudflare → `przypominamy.com` → **DNS**):

```
TXT  @      "v=spf1 include:relay.mailchannels.net ~all"
TXT  mailchannels._domainkey   "v=DKIM1; p="
```

Pełna instrukcja: https://support.mailchannels.com/hc/en-us/articles/16918954360845

---

## 7. API Gateway Worker (proxy SMSAPI.pl)

API Gateway umożliwia klientom wysyłkę SMS/MMS/VMS przez `api.przypominamy.com/v1/*`.
W tle korzysta z SMSAPI.pl jako dostawcy.

### A. Utwórz KV namespace

```bash
wrangler kv:namespace create CLIENTS_KV
# Skopiuj ID z outputu i wklej do api.toml w polu id = "..."
```

### B. Wdróż API Worker

```bash
wrangler deploy -c api.toml

# Ustaw sekret — master token SMSAPI.pl:
wrangler secret put SMSAPI_TOKEN --name przypominamy-api
# Wklej Bearer token z https://ssl.smsapi.pl/react/oauth/manage
```

### C. Dodaj subdomenę API

Cloudflare DNS → dodaj rekord:
```
CNAME   api   przypominamy-com.pages.dev   (proxy: ON)
```

Cloudflare automatycznie podepnie SSL.

### D. Dodaj klienta (token API)

```bash
# Wygeneruj token (np. openssl rand -hex 32):
TOKEN="tu_wklej_wygenerowany_token"

# Dodaj do KV:
wrangler kv:key put --namespace-id=XXXXX "token:$TOKEN" '{
  "client_id": "acme-corp",
  "name": "ACME Corporation",
  "smsapi_token": null,
  "webhook_url": "https://acme.com/webhooks/sms",
  "rate_limit": 100,
  "allowed_endpoints": ["sms", "sms/bulk", "mms", "vms", "hlr", "balance"],
  "sender_name": "ACME"
}'

# Dodaj mapping klienta dla callbacków DLR:
wrangler kv:key put --namespace-id=XXXXX "client:acme-corp" '{
  "webhook_url": "https://acme.com/webhooks/sms"
}'
```

### E. Testuj

```bash
# Health check
curl https://api.przypominamy.com/v1/health

# Wyślij SMS
curl -X POST https://api.przypominamy.com/v1/sms \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to": "+48600100200", "message": "Test z API Przypominamy.com"}'

# Sprawdź saldo
curl https://api.przypominamy.com/v1/balance \
  -H "Authorization: Bearer $TOKEN"
```

### Endpointy API

| Metoda | Endpoint | Opis |
|--------|----------|------|
| `POST` | `/v1/sms` | Wyślij SMS |
| `POST` | `/v1/sms/bulk` | Masowa wysyłka SMS |
| `POST` | `/v1/mms` | Wyślij MMS (SMIL) |
| `POST` | `/v1/vms` | Wiadomość głosowa TTS |
| `GET`  | `/v1/hlr?number=...` | Weryfikacja numeru |
| `GET`  | `/v1/balance` | Saldo konta |
| `POST` | `/v1/callback/:clientId` | DLR webhook (z SMSAPI) |
| `POST/GET` | `/v1/incoming` | Przychodzący SMS |
| `GET`  | `/v1/health` | Status API |

---

## 8. Migracja z innych hostów

1. **DNS cut-over**: W Cloudflare DNS zastąp stare rekordy A/CNAME rekordami Pages
2. **Stary hosting**: Możesz ustawić redirect 301 na starym serwerze do czasu propagacji TTL
3. **SSL**: Cloudflare automatycznie wystawia certyfikat Let's Encrypt

---

## Podsumowanie plików

| Plik | Rola |
|------|------|
| `index.html` | Marketing page (static) |
| `chat-worker.js` | `/api/chat` — streaming AI chat |
| `order-worker.js` | `/api/order` — AI oferta + email |
| `email-worker.js` | Incoming email handler — AI auto-reply |
| `api-worker.js` | `/v1/*` — API Gateway proxy SMSAPI.pl |
| `_headers` | Security headers dla Pages |
| `_redirects` | SPA redirects |
| `wrangler.toml` | Cloudflare Pages config |
| `api.toml` | API Gateway worker config |
