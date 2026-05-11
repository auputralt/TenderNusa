import { getStore } from '../_lib/store.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const tender = getStore().tenders.find(t => t.tender_id === req.query.id);
  return tender ? res.json(tender) : res.status(404).json({ error: 'Tender tidak ditemukan', id: req.query.id });
}
