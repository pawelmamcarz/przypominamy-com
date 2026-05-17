# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Marketing site + serverless backend for **przypominamy.com**, a Polish SMS/MMS/IVR platform that white-labels SMSAPI.pl. Site language is Polish (English mirror at `en.html`). Everything ships to Cloudflare — static pages via Cloudflare Pages, dynamic endpoints via separate Cloudflare Workers, each with its own `*.toml` config.

There is no build step for the site itself: pages are hand-written HTML in the repo root + `blog/` + `integracje/`. Cloudflare Pages serves the directory as-is (`pages_build_output_dir = "."`).

## High-level architecture

Three logical layers live in one repo:

1. **Static marketing site** (root + `blog/` + `integracje/`) — served by Cloudflare Pages. `_headers` sets CSP / cache, `_redirects` handles legacy WordPress paths and locale aliases.
2. **Workers** (`*-worker.js`) — five independent Workers, each deployed separately. They are *not* Pages Functions; routing is via Custom Worker Routes on `przypominamy.com/api/*` and the `api.przypominamy.com` subdomain.
3. **Third-party SDKs** under `n8n-node/`, `zapier-app/`, `make-app/` — published to the n8n/Zapier/Make marketplaces. They are clients of the API Gateway Worker, not part of the site bundle.

### Worker → config → route map

| Worker file | Config | Deployed name | Route | Secrets |
|---|---|---|---|---|
| `chat-worker.js` | `chat.toml` | `przypominamy-chat` | `przypominamy.com/api/chat` | `ANTHROPIC_API_KEY` |
| `order-worker.js` | `order.toml` | `przypominamy-order` | `przypominamy.com/api/order` | `ANTHROPIC_API_KEY`, `NOTIFY_EMAIL`, `FROM_EMAIL` |
| `register-worker.js` | `register.toml` | `przypominamy-register` | `przypominamy.com/api/register` | `NOTIFY_EMAIL`, optionally `FROM_EMAIL` |
| `email-worker.js` | `workers.toml` | `przypominamy-email` | (no HTTP route — Email Routing trigger) | `ANTHROPIC_API_KEY`, `FORWARD_TO` |
| `api-worker.js` | `api.toml` | `przypominamy-api` | `api.przypominamy.com/*` (KV-backed) | `SMSAPI_TOKEN` |

`wrangler.toml` at the repo root configures **Pages**, not a Worker — do not deploy it as a Worker.

`contact-worker.js` is unused (commented at top of file); leave it alone unless reviving the legacy contact form.

### Where to make changes

- **Adding a new public API endpoint** → almost always means extending `api-worker.js` (it's a proxy over SMSAPI.pl with its own auth, rate-limiting, DLR callback, and incoming-SMS handling). The endpoint allowlist lives in `ENDPOINT_MAP` and is gated per-client via `client.allowed_endpoints` in `CLIENTS_KV`.
- **Adding an SDK operation** → mirror the change in `api-worker.js`, then in each SDK: `n8n-node/nodes/Przypominamy/Przypominamy.node.ts`, `zapier-app/creates/` or `searches/`, and `make-app/modules/*.json`.
- **Static content** → edit the corresponding `.html`. There is no templating; navigation/footers are duplicated across pages.
- **AI-related copy** → the system prompts live inline at the top of `chat-worker.js`, `order-worker.js` (`buildProposalPrompt`), and `email-worker.js` (`SUPPORT_SYSTEM_PROMPT`). They share pricing/feature claims — when one changes, scan the others.

## Common commands

Workers are deployed individually. There is no monorepo task runner.

```bash
# Pages (auto on git push to main)
git push origin main

# Workers — deploy from a config file
wrangler deploy -c chat.toml
wrangler deploy -c api.toml
wrangler deploy -c register.toml
wrangler deploy -c order.toml
wrangler deploy -c workers.toml          # email-worker
# Note: DEPLOY.md §3 still shows the legacy `wrangler deploy order-worker.js --name ...`
# form for order-worker — order.toml supersedes it.

# Secrets
wrangler secret put ANTHROPIC_API_KEY --name przypominamy-chat
wrangler secret put SMSAPI_TOKEN      --name przypominamy-api

# Local dev for a Worker
wrangler dev -c chat.toml

# n8n SDK (TypeScript)
cd n8n-node && npm install && npm run build       # tsc → dist/
cd n8n-node && npm run dev                        # tsc --watch

# Zapier SDK
cd zapier-app && npm install
cd zapier-app && npm run validate                 # zapier validate
cd zapier-app && npm test                         # jest
cd zapier-app && npx jest test/<file>.test.js     # single test file
cd zapier-app && npm run push                     # zapier push (publish private version)

# Make app — no build step; the JSON files in make-app/ are uploaded manually
# via the Make Developer Portal per make-app/README.md.
```

## Non-obvious behavior

These are traps already learned from incidents; check before changing related code.

- **Pretty URLs and `_redirects`**: Cloudflare Pages auto-strips `.html` and 301s `*.html` → pretty path. Adding an explicit `/register → /register.html` rewrite creates an infinite 308 loop (fixed in `d548847`). The comment at the top of `_redirects` is load-bearing — do not add `(200)` rewrites for files that already exist as `.html`.
- **Chat SSE streaming**: `chat-worker.js` uses `new ReadableStream({ start(controller) { ... } })`, **not** `TransformStream` + a detached IIFE. The previous pattern dropped all chunks after the first one in Cloudflare Workers because the writer wasn't held by the response (fixed in `d0c59e4`). Preserve the controller-based shape if editing.
- **API surface is documented in three places** that must stay in sync: `api-worker.js` (truth), `DEPLOY.md §7`, `llms.txt` / `llms-full.txt`, and `sitemap.xml`. The "ujednolicenie" commits (`f5fdbec`, `bd29789`) were about reconciling drift between them.
- **Anthropic model**: all three AI workers pin `claude-haiku-4-5-20251001`. When upgrading, change all three together.
- **CORS**: chat-worker allows `*`; order-worker and register-worker restrict to `https://przypominamy.com`. The API Gateway allows `*` because clients are server-to-server.
- **MailChannels** is the outbound mail path (free on CF Workers). The `from` domain must have SPF/DKIM configured per DEPLOY.md §6 — silently fails otherwise.
- **KV keys in api-worker**: `token:<bearer>` → client record, `client:<client_id>` → webhook config, `rl:<client_id>:<unix_minute>` → rate-limit counter (TTL 120s). Don't conflate the two namespaces when adding a new lookup.

## Repository conventions

- Site is **Polish-first**. All user-facing strings, prompts, and error messages should be in Polish unless you're editing `en.html` or English-only SDK READMEs.
- Comments and commit messages are in Polish (see `git log`).
- Secrets are never committed: `.gitignore` excludes `.dev.vars`, `.env`, and `notes/`.
- Local working notes go in `notes/` (gitignored) — do not surface them.
