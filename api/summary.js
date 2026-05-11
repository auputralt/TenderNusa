import { getStore } from './_lib/store.js';

export default function handler(req, res) {
  const s = getStore();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  res.json({ ...s.summary, lastUpdated: s.lastUpdated, ingestionStatus: s.ingestionStatus, ingestionError: s.ingestionError });
}
