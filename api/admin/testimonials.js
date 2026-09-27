const { neon } = require('@neondatabase/serverless');

function isAuthorized(req) {
  const provided = req.headers['x-admin-password'];
  return Boolean(provided) && Boolean(process.env.ADMIN_PASSWORD) && provided === process.env.ADMIN_PASSWORD;
}

module.exports = async (req, res) => {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  if (!process.env.DATABASE_URL) {
    res.status(500).json({ error: 'not_configured' });
    return;
  }

  const sql = neon(process.env.DATABASE_URL);

  if (req.method === 'GET') {
    const rows = await sql`
      SELECT id, type, name, avatar_url, text_content, youtube_id, label, status, created_at
      FROM testimonials
      ORDER BY (status = 'pending') DESC, created_at DESC
      LIMIT 300
    `;
    res.status(200).json({ testimonials: rows });
    return;
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const action = body.action;

    if (action === 'approve' || action === 'reject') {
      if (!body.id) {
        res.status(400).json({ error: 'missing_id' });
        return;
      }
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      await sql`UPDATE testimonials SET status = ${newStatus} WHERE id = ${body.id}`;
      res.status(200).json({ ok: true });
      return;
    }

    if (action === 'delete') {
      if (!body.id) {
        res.status(400).json({ error: 'missing_id' });
        return;
      }
      await sql`DELETE FROM testimonials WHERE id = ${body.id}`;
      res.status(200).json({ ok: true });
      return;
    }

    if (action === 'add_video') {
      const name = (body.name || '').toString().trim().slice(0, 200);
      const youtubeId = (body.youtube_id || '').toString().trim().slice(0, 50);
      const label = (body.label || '').toString().trim().slice(0, 200) || null;
      if (!name || !youtubeId) {
        res.status(400).json({ error: 'missing_fields' });
        return;
      }
      await sql`
        INSERT INTO testimonials (type, name, youtube_id, label, status)
        VALUES ('video', ${name}, ${youtubeId}, ${label}, 'approved')
      `;
      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ error: 'unknown_action' });
    return;
  }

  res.status(405).json({ error: 'method_not_allowed' });
};
