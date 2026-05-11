import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { fetchTenders, fetchDirectory } from './ingestion/fetch-lpse.js';
import { normalizeTenders, normalizeDirectory, deriveCompanies, deriveSummary } from './ingestion/normalize-lpse.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const LPSE_BASE_URL = process.env.LPSE_BASE_URL || 'https://lpse.go.id';

// In-memory data store
const store = {
  tenders: [],
  companies: [],
  directory: [],
  summary: { totalTenders: 0, totalAgencies: 0, totalWinners: 0, totalContractValue: 0 },
  lastUpdated: { tenders: null, directory: null },
  ingestionStatus: 'idle',
  ingestionError: null
};

app.use(express.static(path.join(__dirname), { index: 'index.html', extensions: ['html'] }));

// CORS middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// API Endpoints
app.get('/api/summary', (req, res) => {
  res.json({
    ...store.summary,
    lastUpdated: store.lastUpdated.tenders,
    ingestionStatus: store.ingestionStatus,
    ingestionError: store.ingestionError
  });
});

app.get('/api/tenders', (req, res) => {
  const { agency, year, winner, unit, search, limit = 25, offset = 0 } = req.query;
  let results = store.tenders;

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
});

app.get('/api/tenders/:id', (req, res) => {
  const tender = store.tenders.find(t => t.tender_id === req.params.id);
  return tender ? res.json(tender) : res.status(404).json({ error: 'Tender tidak ditemukan', id: req.params.id });
});

app.get('/api/directory', (req, res) => {
  res.json({ data: store.directory, total: store.directory.length, lastUpdated: store.lastUpdated.directory });
});

app.get('/api/companies', (req, res) => {
  const { search, limit = 50, offset = 0 } = req.query;
  let results = search
    ? store.companies.filter(c => c.company_name?.toLowerCase().includes(search.toLowerCase()))
    : [...store.companies];

  results.sort((a, b) => b.company_win_count - a.company_win_count);

  const off = Math.max(0, parseInt(offset, 10));
  const lim = Math.min(200, Math.max(1, parseInt(limit, 10)));

  res.json({ data: results.slice(off, off + lim), total: results.length, offset: off, limit: lim });
});

app.post('/api/refresh', (req, res) => {
  if (store.ingestionStatus === 'running') return res.status(409).json({ error: 'Ingestion sedang berjalan' });
  res.json({ message: 'Ingestion dimulai', status: 'running' });
  runIngestion();
});

// Ingestion Pipeline
async function runIngestion() {
  store.ingestionStatus = 'running';
  store.ingestionError = null;
  const startTime = Date.now();
  console.log(`\n[Ingestion] Mulai: ${new Date().toISOString()} | Target: ${LPSE_BASE_URL}`);

  try {
    const rawTenders = await fetchTenders(LPSE_BASE_URL);
    const normalizedTenders = normalizeTenders(rawTenders, LPSE_BASE_URL);

    const rawDirectory = await fetchDirectory(LPSE_BASE_URL);
    const normalizedDirectory = normalizeDirectory(rawDirectory);

    const companies = deriveCompanies(normalizedTenders);
    const summary = deriveSummary(normalizedTenders);

    // If live ingestion yielded no data, fall back to seed data
    if (normalizedTenders.length === 0) {
      console.log('[Ingestion] Live ingestion returned 0 records. Loading seed data...');
      try {
        const seed = JSON.parse(readFileSync(path.join(__dirname, 'seed-data.json'), 'utf-8'));
        const seedTenders = seed.tenders || [];
        const seedDirectory = seed.directory || [];
        const seedCompanies = deriveCompanies(seedTenders);
        const seedSummary = deriveSummary(seedTenders);

        Object.assign(store, { tenders: seedTenders, companies: seedCompanies, directory: seedDirectory, summary: seedSummary });
        store.lastUpdated = { tenders: new Date().toISOString(), directory: new Date().toISOString() };
        store.ingestionStatus = 'completed';
        store.ingestionError = null;
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[Ingestion] Seed data loaded: ${seedTenders.length} tenders. Total kontrak: Rp ${seedSummary.totalContractValue.toLocaleString('id-ID')}\n`);
        return;
      } catch (seedErr) {
        console.error('[Ingestion] Seed data load failed:', seedErr.message);
      }
    }

    // Atomically update store
    Object.assign(store, { tenders: normalizedTenders, companies, directory: normalizedDirectory, summary });
    store.lastUpdated = { tenders: new Date().toISOString(), directory: new Date().toISOString() };
    store.ingestionStatus = 'completed';

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Ingestion] Selesai dalam ${elapsed}s. Total kontrak: Rp ${summary.totalContractValue.toLocaleString('id-ID')}\n`);
  } catch (err) {
    store.ingestionStatus = 'error';
    store.ingestionError = err.message;
    console.error(`[Ingestion Error]:`, err);
  }
}

app.listen(PORT, () => {
  console.log(`\n🚀 TenderNusa berjalan di http://localhost:${PORT}\n`);
  runIngestion();
});
