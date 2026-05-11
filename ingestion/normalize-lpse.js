const COLUMN_MAP = {
  'Kode Tender': 'tender_id', 'Nama Tender': 'tender_name', 'Instansi': 'agency_name',
  'KLPD': 'klpd_name', 'Metode Pengadaan': 'procurement_method', 'Tahun': 'fiscal_year',
  'Satuan Kerja': 'work_unit', 'Nama Paket': 'category', 'Nilai HPS': 'hps_value',
  'Status': 'tender_status', 'Nama Pemenang': 'winner_name', 'NPWP Pemenang': 'winner_npwp',
  'Nilai Kontrak': 'contract_value', 'Tanggal Pengumuman': 'announcement_date',
  'Batas Akhir Penawaran': 'submission_deadline', 'Tanggal Evaluasi': 'evaluation_date',
  'Tanggal Kontrak': 'contract_date'
};

const CURRENCY_FIELDS = new Set(['hps_value', 'contract_value']);
const INTEGER_FIELDS = new Set(['fiscal_year']);
const DATE_FIELDS = new Set(['announcement_date', 'submission_deadline', 'evaluation_date', 'contract_date']);

const cleanHtml = v => (Array.isArray(v) ? v.join(' ') : String(v ?? '')).replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();

export function parseRupiah(str) {
  if (!str) return 0;
  let s = cleanHtml(str).replace(/[Rr][Pp]|IDR/gi, '').replace(/[^\d,.\-]/g, '');
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = s.split(',').at(-1).length <= 2 ? s.replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes('.') && s.split('.').at(-1).length > 2) s = s.replace(/\./g, '');

  const num = parseFloat(s);
  return isNaN(num) ? 0 : Math.round(num);
}

export function parseDate(str) {
  const s = cleanHtml(str);
  if (!s || s === '-') return null;

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];

  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;

  const indMonths = { jan: '01', feb: '02', mar: '03', apr: '04', mei: '05', jun: '06', jul: '07', agu: '08', sep: '09', okt: '10', nov: '11', des: '12' };
  const txt = s.toLowerCase().match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
  if (txt) {
    const month = Object.keys(indMonths).find(k => txt[2].startsWith(k)) || '01';
    return `${txt[3]}-${indMonths[month]}-${txt[1].padStart(2, '0')}`;
  }

  const parsed = new Date(s);
  return !isNaN(parsed) ? parsed.toISOString().substring(0, 10) : null;
}

export function normalizeTenders(rawData, baseUrl) {
  if (!Array.isArray(rawData)) return [];
  const base = baseUrl.replace(/\/$/, '');

  return rawData.reduce((acc, raw) => {
    try {
      const record = Object.fromEntries(Object.values(COLUMN_MAP).map(k => [k, null]));

      for (const [rawKey, schemaKey] of Object.entries(COLUMN_MAP)) {
        if (raw[rawKey] !== undefined) {
          let v = raw[rawKey];
          if (CURRENCY_FIELDS.has(schemaKey)) v = parseRupiah(v);
          else if (INTEGER_FIELDS.has(schemaKey)) v = parseInt(cleanHtml(v), 10) || null;
          else if (DATE_FIELDS.has(schemaKey)) v = parseDate(v);
          else v = cleanHtml(v);
          record[schemaKey] = v;
        }
      }

      record.tender_id ??= cleanHtml(raw['Kode']);
      record.tender_name = record.tender_name || cleanHtml(raw['Nama Paket']) || record.category || record.tender_id;
      record.agency_name ??= cleanHtml(raw['Nama Instansi']);
      record.lpse_portal_name = base.replace(/^https?:\/\//, '');
      record.source_url = record.tender_id ? `${base}/eproc4/lelang/${record.tender_id}/pengumumanlelang` : base;

      if (record.tender_id) acc.push(record);
    } catch (e) { /* Skip invalid records gracefully */ }
    return acc;
  }, []);
}

export function normalizeDirectory(rawData) {
  return (Array.isArray(rawData) ? rawData : [])
    .filter(e => e?.name)
    .map(e => ({
      lpse_directory_name: cleanHtml(e.name),
      lpse_directory_url: cleanHtml(e.url),
      lpse_directory_region: cleanHtml(e.region) || 'Tidak diketahui'
    }));
}

export function deriveCompanies(tenders) {
  const map = new Map();
  tenders.forEach(({ winner_name, contract_value }) => {
    if (!winner_name) return;
    const existing = map.get(winner_name) || { company_name: winner_name, company_win_count: 0, company_total_contract_value: 0 };
    existing.company_win_count++;
    existing.company_total_contract_value += (contract_value || 0);
    map.set(winner_name, existing);
  });
  return Array.from(map.values());
}

export function deriveSummary(tenders) {
  const agencies = new Set(), winners = new Set();
  let totalContractValue = 0;

  tenders.forEach(t => {
    if (t.agency_name) agencies.add(t.agency_name);
    if (t.winner_name) winners.add(t.winner_name);
    totalContractValue += t.contract_value || 0;
  });

  return { totalTenders: tenders.length, totalAgencies: agencies.size, totalWinners: winners.size, totalContractValue };
}
