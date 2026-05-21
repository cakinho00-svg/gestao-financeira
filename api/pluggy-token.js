export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  try {
    const authRes = await fetch('https://api.pluggy.ai/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: process.env.PLUGGY_CLIENT_ID,
        clientSecret: process.env.PLUGGY_CLIENT_SECRET,
      }),
    });

    if (!authRes.ok) {
      const err = await authRes.text();
      console.error('Pluggy auth error:', err);
      return res.status(502).json({ error: 'Falha ao autenticar com Pluggy' });
    }

    const { apiKey } = await authRes.json();
    const body = req.body || {};
    const clientUserId = body.clientUserId || 'default';

    const tokenRes = await fetch('https://api.pluggy.ai/connect_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({ clientUserId }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('Pluggy token error:', err);
      return res.status(502).json({ error: 'Falha ao criar token de conexão' });
    }

    const data = await tokenRes.json();
    res.status(200).json(data);
  } catch (err) {
    console.error('Handler error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
}
