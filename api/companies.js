import { getStore } from './_lib/store.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const { search, limit = 50, offset = 0 } = req.query;
  let results = search
    ? getStore().companies.filter(c => c.company_name?.toLowerCase().includes(search.toLowerCase()))
    : [...getStore().companies];

  results.sort((a, b) => b.company_win_count - a.company_win_count);
  const off = Math.max(0, parseInt(offset, 10));
  const lim = Math.min(200, Math.max(1, parseInt(limit, 10)));
  res.json({ data: results.slice(off, off + lim), total: results.length, offset: off, limit: lim });
}
