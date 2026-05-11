import { getStore } from './_lib/store.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const s = getStore();
  res.json({ data: s.directory, total: s.directory.length, lastUpdated: s.lastUpdated });
}
