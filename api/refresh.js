import { getStore } from './_lib/store.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const s = getStore();
  res.json({ message: 'Data dari seed (LPSE portals unreachable dari cloud)', status: s.ingestionStatus, totalTenders: s.summary.totalTenders });
}
