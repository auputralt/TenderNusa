import { readFileSync } from 'fs';
import { join } from 'path';

let _cache = null;

function loadSeed() {
  if (_cache) return _cache;
  const seed = JSON.parse(readFileSync(join(process.cwd(), 'seed-data.json'), 'utf-8'));
  const tenders = seed.tenders || [];
  const directory = seed.directory || [];

  const companyMap = new Map();
  tenders.forEach(({ winner_name, contract_value }) => {
    if (!winner_name) return;
    const e = companyMap.get(winner_name) || { company_name: winner_name, company_win_count: 0, company_total_contract_value: 0 };
    e.company_win_count++;
    e.company_total_contract_value += (contract_value || 0);
    companyMap.set(winner_name, e);
  });

  const agencies = new Set(), winners = new Set();
  let totalContractValue = 0;
  tenders.forEach(t => {
    if (t.agency_name) agencies.add(t.agency_name);
    if (t.winner_name) winners.add(t.winner_name);
    totalContractValue += t.contract_value || 0;
  });

  _cache = {
    tenders,
    companies: Array.from(companyMap.values()),
    directory,
    summary: { totalTenders: tenders.length, totalAgencies: agencies.size, totalWinners: winners.size, totalContractValue },
    lastUpdated: new Date().toISOString(),
    ingestionStatus: 'completed',
    ingestionError: null
  };
  return _cache;
}

export function getStore() { return loadSeed(); }
