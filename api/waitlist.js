// Serverless function: POST /api/waitlist
// Adds an email to a Resend audience (https://resend.com). Welcome emails are
// sent by configuring a Broadcast/automation in the Resend dashboard that
// targets the audience, so this endpoint stays minimal.
//
// Required environment variables (set in Vercel project settings):
//   RESEND_API_KEY      - from https://resend.com/api-keys (audiences:write)
//   RESEND_AUDIENCE_ID  - UUID of the audience to add contacts to
//   ALLOWED_ORIGINS     - comma-separated, e.g. "https://taaruf.app,https://www.taaruf.app"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 254;            // RFC 5321
const MAX_BODY_BYTES = 1024;
const RATE_LIMIT = { windowMs: 10 * 60 * 1000, max: 5 };

// Best-effort per-instance rate limit. Vercel may run multiple instances,
// so this is a first line of defence, not a hard cap.
const hits = new Map();

function rateLimited(ip) {
  if (!ip) return false;
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < RATE_LIMIT.windowMs);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t > RATE_LIMIT.windowMs)) hits.delete(k);
    }
  }
  return arr.length > RATE_LIMIT.max;
}

function allowedOrigin(origin) {
  const list = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!list.length) return true; // no allow-list configured (e.g. preview), allow
  return origin && list.includes(origin);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const rawOrigin = req.headers.origin || req.headers.referer || '';
  let originHost = '';
  try {
    originHost = rawOrigin ? new URL(rawOrigin).origin : '';
  } catch {
    /* ignore */
  }
  if (!allowedOrigin(originHost)) {
    return res.status(403).json({ error: 'forbidden' });
  }

  // Parse body with a hard size cap.
  let body = req.body;
  if (typeof body === 'string') {
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
      return res.status(413).json({ error: 'payload_too_large' });
    }
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'bad_json' });
    }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'bad_request' });
  }

  // Honeypot: if a bot fills the hidden "website" field, pretend success.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return res.status(200).json({ ok: true });
  }

  const email =
    typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!email || email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'invalid_email' });
  }

  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    '';
  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!apiKey || !audienceId) {
    console.error('waitlist: missing RESEND_API_KEY or RESEND_AUDIENCE_ID');
    return res.status(500).json({ error: 'server_misconfigured' });
  }

  // Resend's create-contact returns 422 if the email already exists in the
  // audience; treat that — and 409 if they ever align with REST norms — as
  // success so duplicate signups don't error out.
  const resendRes = await fetch(
    `https://api.resend.com/audiences/${encodeURIComponent(audienceId)}/contacts`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, unsubscribed: false }),
    },
  );

  if (resendRes.ok || resendRes.status === 409 || resendRes.status === 422) {
    return res.status(200).json({ ok: true });
  }

  const detail = await resendRes.text().catch(() => '');
  console.error('waitlist: resend failed', resendRes.status, detail);
  return res.status(502).json({ error: 'upstream_failed' });
};
