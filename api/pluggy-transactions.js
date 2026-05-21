export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

  const { itemId, de, ate } = req.query;
  if (!itemId) return res.status(400).json({ error: 'itemId é obrigatório' });

  try {
    const authRes = await fetch('https://api.pluggy.ai/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: process.env.PLUGGY_CLIENT_ID,
        clientSecret: process.env.PLUGGY_CLIENT_SECRET,
      }),
    });

    if (!authRes.ok) return res.status(502).json({ error: 'Falha ao autenticar com Pluggy' });
    const { apiKey } = await authRes.json();

    const accountsRes = await fetch(
      `https://api.pluggy.ai/accounts?itemId=${encodeURIComponent(itemId)}`,
      { headers: { 'X-API-KEY': apiKey } }
    );

    if (!accountsRes.ok) return res.status(502).json({ error: 'Falha ao buscar contas' });
    const accountsData = await accountsRes.json();
    const accounts = accountsData.results || [];

    const todasTransacoes = [];

    for (const account of accounts) {
      const params = new URLSearchParams({ accountId: account.id, pageSize: '500' });
      if (de) params.set('from', de);
      if (ate) params.set('to', ate);

      const txRes = await fetch(`https://api.pluggy.ai/transactions?${params}`, {
        headers: { 'X-API-KEY': apiKey },
      });

      if (!txRes.ok) continue;
      const txData = await txRes.json();

      const txs = (txData.results || []).map((tx) => ({
        id: tx.id,
        description: tx.description,
        descriptionRaw: tx.descriptionRaw,
        amount: tx.amount,
        date: tx.date,
        type: tx.type,
        category: tx.category,
        accountId: account.id,
        accountType: account.type,
        accountSubtype: account.subtype,
        accountName: account.name,
      }));

      todasTransacoes.push(...txs);
    }

    todasTransacoes.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json({ transactions: todasTransacoes, accounts });
  } catch (err) {
    console.error('Handler error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
}
