const { neon } = require('@neondatabase/serverless');
const { createRemoteJWKSet, jwtVerify } = require('jose');

const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  if (!process.env.DATABASE_URL || !process.env.GOOGLE_CLIENT_ID) {
    res.status(500).json({ error: 'not_configured' });
    return;
  }

  try {
    const body = req.body || {};
    const credential = body.credential;
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const allowedLabels = [
      'Contratei um Financiamento Imobiliário (FI)',
      'Contratei um Home Equity (CGI)'
    ];
    const label = allowedLabels.includes(body.label) ? body.label : null;

    if (!credential || !text) {
      res.status(400).json({ error: 'missing_fields' });
      return;
    }
    if (text.length < 10) {
      res.status(400).json({ error: 'text_too_short' });
      return;
    }
    const trimmedText = text.slice(0, 2000);

    const { payload } = await jwtVerify(credential, JWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const sub = payload.sub;
    if (!sub) {
      res.status(401).json({ error: 'invalid_token' });
      return;
    }
    const name = (payload.name || payload.given_name || 'Cliente').toString().slice(0, 200);
    const picture = payload.picture ? payload.picture.toString() : null;

    const sql = neon(process.env.DATABASE_URL);
    await sql`
      INSERT INTO testimonials (type, google_sub, name, avatar_url, text_content, label, status)
      VALUES ('written', ${sub}, ${name}, ${picture}, ${trimmedText}, ${label}, 'pending')
      ON CONFLICT (google_sub)
      DO UPDATE SET
        name = EXCLUDED.name,
        avatar_url = EXCLUDED.avatar_url,
        text_content = EXCLUDED.text_content,
        label = EXCLUDED.label,
        status = 'pending',
        created_at = now()
    `;

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(401).json({ error: 'invalid_token' });
  }
};