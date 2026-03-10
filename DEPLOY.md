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

## 7. Migracja z innych hostów

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
| `_headers` | Security headers dla Pages |
| `_redirects` | SPA redirects |
| `wrangler.toml` | Cloudflare config |
