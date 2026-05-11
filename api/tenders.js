import { getStore } from './_lib/store.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const { agency, year, winner, unit, search, limit = 25, offset = 0 } = req.query;
  let results = getStore().tenders;
  const match = (field, query) => field?.toLowerCase().includes(query.toLowerCase());

  if (agency) results = results.filter(t => match(t.agency_name, agency));
  if (year) results = results.filter(t => String(t.fiscal_year) === String(year));
  if (winner) results = results.filter(t => match(t.winner_name, winner));
  if (unit) results = results.filter(t => match(t.work_unit, unit));
  if (search) {
    const q = search.toLowerCase();
    results = results.filter(t =>
      match(t.tender_name, q) || match(t.tender_id, q) || match(t.agency_name, q) ||
      match(t.klpd_name, q) || match(t.winner_name, q) || match(t.procurement_method, q) ||
      match(t.work_unit, q)
    );
  }

  const off = Math.max(0, parseInt(offset, 10));
  const lim = Math.min(200, Math.max(1, parseInt(limit, 10)));
  res.json({ data: results.slice(off, off + lim), total: results.length, offset: off, limit: lim });
}
