/**
 * Cloudflare Worker — receives joke submissions from fun.masoko.net and opens
 * a Pull Request adding a new `_jokes/<slug>.md` file. The owner reviews & merges.
 *
 * Secrets (set with `wrangler secret put <NAME>`):
 *   GITHUB_TOKEN     — fine-grained PAT for hjelev/fun.masoko.net
 *                      (Contents: Read/Write, Pull requests: Read/Write)
 *   TURNSTILE_SECRET — Cloudflare Turnstile secret key
 * Bindings (wrangler.toml):
 *   RATELIMIT        — KV namespace used for per-IP rate limiting
 * Vars (wrangler.toml [vars]):
 *   ALLOWED_ORIGIN   — e.g. "https://fun.masoko.net"
 *   REPO             — "hjelev/fun.masoko.net"
 *   BASE_BRANCH      — "master"
 */

const CATEGORY_NAMES = {
  family:  "Семейни",
  others:  "Разни",
  adults:  "За големи",
  work:    "Работа",
  ivancho: "За Иванчо",
  school:  "Училище",
};

const MAX_BODY = 4000;
const MAX_TITLE = 120;
const RATE_LIMIT = 3;        // submissions allowed...
const RATE_WINDOW = 3600;    // ...per this many seconds, per IP

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || "*";

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }
    if (request.method !== "POST") {
      return json({ ok: false, error: "Method not allowed" }, 405, origin);
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return json({ ok: false, error: "Невалидни данни." }, 400, origin);
    }

    // 1) Honeypot — bots fill hidden fields. Pretend success, create nothing.
    if (data.website && String(data.website).trim() !== "") {
      return json({ ok: true, url: "" }, 200, origin);
    }

    // 2) Turnstile CAPTCHA verification.
    const ip = request.headers.get("CF-Connecting-IP") || "";
    const captchaOk = await verifyTurnstile(env.TURNSTILE_SECRET, data.turnstileToken, ip);
    if (!captchaOk) {
      return json({ ok: false, error: "Неуспешна проверка (CAPTCHA)." }, 403, origin);
    }

    // 3) Rate limit by IP.
    if (env.RATELIMIT && ip) {
      const key = "rl:" + ip;
      const count = parseInt((await env.RATELIMIT.get(key)) || "0", 10);
      if (count >= RATE_LIMIT) {
        return json({ ok: false, error: "Твърде много заявки. Опитай по-късно." }, 429, origin);
      }
      // Bump count; the window resets when the key expires.
      await env.RATELIMIT.put(key, String(count + 1), { expirationTtl: RATE_WINDOW });
    }

    // 4) Validate.
    const category = String(data.category || "").trim();
    if (!CATEGORY_NAMES[category]) {
      return json({ ok: false, error: "Невалидна категория." }, 400, origin);
    }
    const body = String(data.body || "").replace(/\r\n/g, "\n").trim();
    if (body.length < 5 || body.length > MAX_BODY) {
      return json({ ok: false, error: "Вицът трябва да е между 5 и " + MAX_BODY + " символа." }, 400, origin);
    }
    if (/https?:\/\/|www\./i.test(body)) {
      return json({ ok: false, error: "Линкове не са разрешени във вицовете." }, 400, origin);
    }
    const title = String(data.title || "").trim().slice(0, MAX_TITLE);

    // 5) Build the markdown file.
    const slug = makeSlug(title) || ("submission-" + dateStamp() + "-" + rand(4));
    const path = "_jokes/" + slug + ".md";
    const content = buildMarkdown({ title, category, body: convertDashes(body) });

    // 6) Open the PR.
    try {
      const prUrl = await openPullRequest(env, { path, content, slug, title, category });
      return json({ ok: true, url: prUrl }, 200, origin);
    } catch (err) {
      return json({ ok: false, error: "Грешка при изпращане към GitHub." }, 502, origin);
    }
  },
};

/* ---------------- helpers ---------------- */

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function json(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin || "*") },
  });
}

async function verifyTurnstile(secret, token, ip) {
  if (!secret || !token) return false;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
    });
    const out = await r.json();
    return !!out.success;
  } catch {
    return false;
  }
}

// Leading "-" on a line is rendered by Markdown as a bullet list. Replace it
// with the &minus; HTML entity so dialogue dashes display as plain dashes.
// Also drop empty lines and append two trailing spaces to each remaining line
// so Markdown renders a hard line break between consecutive lines.
function convertDashes(body) {
  return body
    .split("\n")
    .map((line) => line.replace(/^(\s*)[-–—](\s*)/, "$1&minus;$2"))
    .map((line) => line.trimEnd())
    .filter((line) => line !== "")
    .map((line) => line + "  ")
    .join("\n");
}

function yamlEscape(s) {
  return String(s).replace(/"/g, '\\"');
}

function buildMarkdown({ title, category, body }) {
  const fm = [
    "---",
    "layout: joke",
    'title: "' + yamlEscape(title) + '"',
    "date: " + dateStamp(true),
    "category: " + category,
    'category_name: "' + CATEGORY_NAMES[category] + '"',
    "tags: []",
    "---",
    "",
    body,
    "",
  ];
  return fm.join("\n");
}

// "YYYY-MM-DD" or full "YYYY-MM-DD HH:MM:SS" (UTC) when withTime is true.
function dateStamp(withTime) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const day = d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate());
  if (!withTime) return day;
  return day + " " + p(d.getUTCHours()) + ":" + p(d.getUTCMinutes()) + ":" + p(d.getUTCSeconds());
}

function rand(n) {
  return Math.random().toString(36).slice(2, 2 + n);
}

// Transliterate Cyrillic → latin and kebab-case for a tidy filename.
const TRANSLIT = {
  а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",
  н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",
  щ:"sht",ъ:"a",ь:"y",ю:"yu",я:"ya",
};
function makeSlug(text) {
  const lower = (text || "").toLowerCase();
  let out = "";
  for (const ch of lower) out += (TRANSLIT[ch] !== undefined) ? TRANSLIT[ch] : ch;
  out = out.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return out;
}

async function gh(env, method, path, payload) {
  const r = await fetch("https://api.github.com" + path, {
    method,
    headers: {
      Authorization: "Bearer " + env.GITHUB_TOKEN,
      Accept: "application/vnd.github+json",
      "User-Agent": "fun-masoko-submit-worker",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!r.ok) {
    throw new Error("GitHub " + method + " " + path + " -> " + r.status);
  }
  return r.json();
}

async function openPullRequest(env, { path, content, slug, title, category }) {
  const repo = env.REPO;
  const base = env.BASE_BRANCH || "master";
  const branch = "submit-" + slug + "-" + rand(4);

  // base sha
  const ref = await gh(env, "GET", `/repos/${repo}/git/ref/heads/${base}`);
  const baseSha = ref.object.sha;

  // create branch
  await gh(env, "POST", `/repos/${repo}/git/refs`, {
    ref: "refs/heads/" + branch,
    sha: baseSha,
  });

  // create file on branch
  await gh(env, "PUT", `/repos/${repo}/contents/${path}`, {
    message: "Нов виц: " + (title || slug),
    content: b64(content),
    branch,
  });

  // open PR
  const displayTitle = title || "(без заглавие)";
  const prBody = [
    "Изпратен виц през формата на сайта.",
    "",
    "- **Категория:** " + (CATEGORY_NAMES[category] || category),
    "- **Файл:** `" + path + "`",
    "",
    "Прегледай и слей (merge), за да се публикува.",
  ].join("\n");

  const pr = await gh(env, "POST", `/repos/${repo}/pulls`, {
    title: "Нов виц: " + displayTitle,
    head: branch,
    base,
    body: prBody,
  });

  // best-effort label (ignore failure if the label doesn't exist)
  try {
    await gh(env, "POST", `/repos/${repo}/issues/${pr.number}/labels`, { labels: ["submission"] });
  } catch {}

  return pr.html_url;
}

// UTF-8 safe base64 for the Contents API.
function b64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
