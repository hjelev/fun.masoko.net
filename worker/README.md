# fun-masoko-worker

Cloudflare Worker behind the **Изпрати виц** form on fun.masoko.net. It validates a
submission, checks it isn't spam, and opens a **Pull Request** adding a new
`_jokes/<slug>.md` file to `hjelev/fun.masoko.net`. You review the PR and click
**Merge** — GitHub Pages then rebuilds and the joke goes live.

Nothing is published automatically; every submission waits for your merge.

```
form (submit.html)  ──POST──▶  this Worker  ──GitHub API──▶  Pull Request  ──you merge──▶  live
                               · honeypot
                               · Turnstile CAPTCHA
                               · per-IP rate limit
                               · content validation
```

> **Config location:** there is a single `wrangler.toml` at the **repo root** (worker
> name `fun-masoko-worker`, `main = "worker/src/index.js"`). Run all `wrangler`
> commands from the repo root, not from `worker/`.

## One-time setup

You need a **free Cloudflare account**. From the **repo root**:

```bash
npx wrangler login
```

### 1. Turnstile (CAPTCHA) — free

1. Cloudflare dashboard → **Turnstile** → **Add widget**.
2. Domain: `fun.masoko.net` (add `localhost`/`127.0.0.1` too for local testing).
3. You get two keys:
   - **Site key** (public) → put it in `submit.html`, replacing `TURNSTILE_SITE_KEY`.
   - **Secret key** → store it as a Worker secret:
     ```bash
     npx wrangler secret put TURNSTILE_SECRET
     ```

### 2. GitHub token

Create a **fine-grained personal access token**
(GitHub → Settings → Developer settings → Fine-grained tokens):

- **Repository access:** only `hjelev/fun.masoko.net`.
- **Permissions:** *Contents* → Read and write, *Pull requests* → Read and write.

Store it:

```bash
npx wrangler secret put GITHUB_TOKEN
```

### 3. KV namespace (rate limiting)

Already configured in the root `wrangler.toml` (`[[kv_namespaces]]`). If you ever need a
fresh one:

```bash
npx wrangler kv namespace create RATELIMIT
```

then copy the printed `id` into the root `wrangler.toml`.

### 4. (Optional) "submission" label

In the repo, create a label named `submission` so each PR gets tagged. If you skip
this, the Worker just won't add a label — no error.

### 5. Deploy

```bash
npx wrangler deploy
```

Wrangler prints the Worker URL, e.g. `https://fun-masoko-worker.<you>.workers.dev`.
Put that URL in `assets/js/submit.js`, replacing `WORKER_URL`.

## Config summary

| Where | Replace | With |
|-------|---------|------|
| `submit.html` | `TURNSTILE_SITE_KEY` | Turnstile **site** key |
| `assets/js/submit.js` | `WORKER_URL` | deployed Worker URL |
| Worker secret | `TURNSTILE_SECRET` | Turnstile **secret** key |
| Worker secret | `GITHUB_TOKEN` | fine-grained PAT |

## Local testing

```bash
npx wrangler dev
```

`wrangler dev` uses the same secrets/KV. Use Turnstile's test keys
(`1x00000000000000000000AA` site / `1x0000000000000000000000000000000AA` secret) if you
want the CAPTCHA to always pass while testing. Submitting then opens a real PR — close
it afterwards.

## Tunables (top of `src/index.js`)

- `RATE_LIMIT` / `RATE_WINDOW` — submissions allowed per IP per window (default 3/hour).
- `MAX_BODY` / `MAX_TITLE` — length caps.
- `CATEGORY_NAMES` — the 6 categories and their Bulgarian names.
