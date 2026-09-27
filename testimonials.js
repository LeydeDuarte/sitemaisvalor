const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  if (!process.env.DATABASE_URL) {
    res.status(500).json({ error: 'not_configured' });
    return;
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      SELECT id, type, name, avatar_url, text_content, youtube_id, label, created_at
      FROM testimonials
      WHERE status = 'approved'
      ORDER BY created_at DESC
      LIMIT 100
    `;
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
    res.status(200).json({ testimonials: rows });
  } catch (err) {
    res.status(500).json({ error: 'server_error' });
  }
};
