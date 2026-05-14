// Serverless function: POST /api/waitlist
// 1. Adds the email to a Resend audience (the launch-day broadcast list).
// 2. Sends a one-off welcome email via Resend's /emails endpoint.
// Welcome-send failure is non-fatal — the contact still ends up on the list.
//
// Required environment variables (set in Vercel project settings):
//   RESEND_API_KEY      - from https://resend.com/api-keys
//                         (needs audiences:write AND emails:send)
//   RESEND_AUDIENCE_ID  - UUID of the audience to add contacts to
//   RESEND_FROM_EMAIL   - e.g. "Taaruf <welcome@taaruf.dev>" (must be on a
//                         verified Resend domain)
//   ALLOWED_ORIGINS     - comma-separated, e.g.
//                         "https://taaruf.app,https://www.taaruf.app"
// Optional:
//   RESEND_REPLY_TO     - reply-to address shown to recipients

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

const WELCOME_SUBJECT = 'Welcome to Taaruf <3';
const WELCOME_PREVIEW =
  'A calm, structured conversation for Muslims considering marriage — built with intention.';

const WELCOME_TEXT = `Welcome to Taaruf.

At Taaruf, we want to make one of the most important conversations of your life feel calm again. So many of us hit the same quiet roadblock: you're getting to know someone for marriage and you don't actually know what to ask to be sure this is half your deen. Scraping questions together from Reddit threads or generic apps shouldn't be the answer — and it doesn't have to be.

Our goal is to give Muslims a structured, mahram-supervised conversation built around the things that actually matter to a Muslim home: deen, family vision, lifestyle, career & finances, and the way two souls quietly fit together.

As a new contact, you can expect:
- An email when Taaruf opens for early access

If you have questions, feedback, or you'd like to be among the first to test Taaruf, we'd love to hear from you. Your thoughts genuinely shape what we build.

JazakAllah Khairan for being here from the start. We can't wait to build Taaruf alongside you.

Bāraka Allāhu fīk,
The Taaruf team

—
You're receiving this because you joined the Taaruf waitlist.
`;

const WELCOME_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Welcome to Taaruf</title>
</head>
<body style="margin:0; padding:0; background:#f5efe6; font-family: Georgia, 'Times New Roman', serif; color:#1a1f2e;">
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">${WELCOME_PREVIEW}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5efe6;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; background:#fbf7ef; border:1px solid #d9cfbb;">
          <tr>
            <td style="padding:36px 36px 4px;">
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size:11px; letter-spacing:0.22em; color:#b8533a; text-transform:uppercase;">Taaruf &middot; تَعَارُف</div>
              <h1 style="margin:18px 0 0; font-family: Georgia, 'Times New Roman', serif; font-style:italic; font-weight:400; font-size:34px; line-height:1.1; color:#1a1f2e; letter-spacing:-1px;">
                Welcome to Taaruf.
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 36px 16px;">
              <table role="presentation" width="160" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-top:1px solid #d9cfbb; border-bottom:1px solid #d9cfbb; height:6px; line-height:6px; font-size:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 36px 36px; font-family: Georgia, serif; font-size:16px; line-height:1.65; color:#3d4456;">
              <p style="margin:0 0 16px;">At Taaruf, we want to make one of the most important conversations of your life feel calm again. So many of us hit the same quiet roadblock: you're getting to know someone for marriage and you don't actually know what to ask to be sure this is <em style="color:#b8533a; font-style:italic;">half your deen</em>. Scraping questions together from Reddit threads or generic apps shouldn't be the answer — and it doesn't have to be.</p>
              <p style="margin:0 0 16px;">Our goal is to give Muslims a structured, mahram-supervised conversation built around the things that actually matter to a Muslim home: deen, family vision, lifestyle, career &amp; finances, and the way two souls quietly fit together.</p>
              <p style="margin:0 0 8px;">As a new contact, you can expect:</p>
              <ul style="margin:0 0 20px; padding-left:18px;">
                <li style="margin-bottom:6px;">An email when Taaruf opens for early access</li>
              </ul>
              <p style="margin:0 0 16px;">If you have questions, feedback, or you'd like to be among the first to test Taaruf, we'd love to hear from you. Your thoughts genuinely shape what we build.</p>
              <p style="margin:0 0 24px;">JazakAllah Khairan for being here from the start. We can't wait to build Taaruf alongside you.</p>
              <p style="margin:0; font-style:italic; color:#1a1f2e;">Bāraka Allāhu fīk,<br />The Taaruf team</p>
            </td>
          </tr>
        </table>
        <div style="margin-top:18px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size:11px; color:#6b6f7d;">
          You're receiving this because you joined the Taaruf waitlist.
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;

async function sendWelcomeEmail(apiKey, to) {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    console.error('waitlist: skipping welcome — RESEND_FROM_EMAIL not set');
    return;
  }

  const payload = {
    from,
    to: [to],
    subject: WELCOME_SUBJECT,
    html: WELCOME_HTML,
    text: WELCOME_TEXT,
  };
  if (process.env.RESEND_REPLY_TO) {
    payload.reply_to = process.env.RESEND_REPLY_TO;
  }

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    console.error('waitlist: welcome send failed', r.status, detail);
  }
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

  // 1) Add to audience. Resend returns 422 on duplicate; treat as success.
  const audienceRes = await fetch(
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

  const alreadyOnList =
    audienceRes.status === 409 || audienceRes.status === 422;
  if (!audienceRes.ok && !alreadyOnList) {
    const detail = await audienceRes.text().catch(() => '');
    console.error('waitlist: resend audience add failed', audienceRes.status, detail);
    return res.status(502).json({ error: 'upstream_failed' });
  }

  // 2) Send the welcome email. Only for first-time signups — duplicates
  // skip the welcome so we don't re-email someone who already has it.
  // Failure here is logged but doesn't fail the request: the contact is
  // already on the list, so the launch broadcast will still reach them.
  if (!alreadyOnList) {
    try {
      await sendWelcomeEmail(apiKey, email);
    } catch (err) {
      console.error('waitlist: welcome send threw', err);
    }
  }

  return res.status(200).json({ ok: true });
};
