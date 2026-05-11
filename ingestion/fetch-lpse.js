import * as cheerio from 'cheerio';

const CONFIG = {
  TENDER_ENDPOINT: '/eproc4/dt/tender',
  DIRECTORY_ENDPOINT: '/eproc4/dt/portal',
  PAGE_SIZE: 25,
  MAX_PAGES: 40,
  REQUEST_DELAY_MS: 1500,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 3000,
  TIMEOUT_MS: 30000
};

const LPSE_TENDER_COLUMNS = [
  { data: 0, name: 'R', searchable: false, orderable: false },
  { data: 1, name: 'Kode Tender', searchable: true, orderable: true },
  { data: 2, name: 'Nama Tender', searchable: true, orderable: true },
  { data: 3, name: 'Kode RUP', searchable: true, orderable: true },
  { data: 4, name: 'Nama Paket', searchable: true, orderable: true },
  { data: 5, name: 'KLPD', searchable: true, orderable: true },
  { data: 6, name: 'Instansi', searchable: true, orderable: true },
  { data: 7, name: 'Satuan Kerja', searchable: true, orderable: true },
  { data: 8, name: 'Komponen', searchable: true, orderable: true },
  { data: 9, name: 'Metode Pengadaan', searchable: true, orderable: true },
  { data: 10, name: 'Tahun', searchable: true, orderable: true },
  { data: 11, name: 'Nilai HPS', searchable: false, orderable: true },
  { data: 12, name: 'Status', searchable: true, orderable: true }
];

const cookieJar = new Map();
const BASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8',
  'X-Requested-With': 'XMLHttpRequest'
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

function captureCookies(headers) {
  const raw = headers.get('set-cookie');
  if (!raw) return;
  raw.split(/,(?=\s*\w+=)/).forEach(cookie => {
    const [nv] = cookie.split(';');
    const eq = nv.indexOf('=');
    if (eq > 0) cookieJar.set(nv.substring(0, eq).trim(), nv.substring(eq + 1).trim());
  });
}

const getCookieString = () => Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');

function buildDataTablesBody(draw, start, length) {
  const p = new URLSearchParams({ draw, start, length, 'search[value]': '', 'search[regex]': 'false', 'order[0][column]': '1', 'order[0][dir]': 'asc' });
  LPSE_TENDER_COLUMNS.forEach((col, i) => {
    p.append(`columns[${i}][data]`, col.data);
    p.append(`columns[${i}][name]`, col.name);
    p.append(`columns[${i}][searchable]`, col.searchable);
    p.append(`columns[${i}][orderable]`, col.orderable);
    p.append(`columns[${i}][search][value]`, '');
    p.append(`columns[${i}][search][regex]`, 'false');
  });
  return p.toString();
}

async function fetchWithRetry(url, options = {}, attempt = 1) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);
  const headers = { ...BASE_HEADERS, ...options.headers };
  const cookieStr = getCookieString();
  if (cookieStr) headers.Cookie = cookieStr;

  try {
    const response = await fetch(url, { ...options, headers, signal: controller.signal });
    clearTimeout(timeoutId);
    captureCookies(response.headers);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    if (attempt < CONFIG.RETRY_ATTEMPTS) {
      await sleep(CONFIG.RETRY_DELAY_MS * attempt);
      return fetchWithRetry(url, options, attempt + 1);
    }
    throw new Error(`Gagal fetch ${url} setelah ${CONFIG.RETRY_ATTEMPTS} percobaan: ${err.message}`);
  }
}

async function initSession(baseUrl) {
  try {
    await fetchWithRetry(baseUrl, { method: 'GET', headers: { Accept: 'text/html' } });
  } catch (err) {
    console.warn(`[Fetch] Inisialisasi sesi gagal: ${err.message}`);
  }
}

export async function fetchTenders(baseUrl) {
  await initSession(baseUrl);
  const endpoint = new URL(CONFIG.TENDER_ENDPOINT, baseUrl).toString();
  const allRecords = [];
  let page = 0, totalAvailable = Infinity, draw = 1;

  while (page < CONFIG.MAX_PAGES && page * CONFIG.PAGE_SIZE < totalAvailable) {
    const start = page * CONFIG.PAGE_SIZE;
    try {
      const res = await fetchWithRetry(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: buildDataTablesBody(draw, start, CONFIG.PAGE_SIZE)
      });
      const json = await res.json();

      if (!json?.data) throw new Error('Format DataTables tidak valid');
      if (page === 0) totalAvailable = json.recordsTotal ?? json.data.length;
      if (json.data.length === 0) break;

      const records = json.data.map(row =>
        Array.isArray(row) ? Object.fromEntries(LPSE_TENDER_COLUMNS.map((col, i) => [col.name, row[i] ?? null])) : row
      );

      allRecords.push(...records);
      draw++; page++;
      if (page * CONFIG.PAGE_SIZE < totalAvailable) await sleep(CONFIG.REQUEST_DELAY_MS);
    } catch (err) {
      console.error(`[Fetch] Gagal halaman ${page + 1}:`, err.message);
      break;
    }
  }
  return allRecords;
}

export async function fetchDirectory(baseUrl) {
  const endpoint = new URL(CONFIG.DIRECTORY_ENDPOINT, baseUrl).toString();
  try {
    const body = new URLSearchParams({ draw: 1, start: 0, length: 500, 'columns[0][data]': 0, 'columns[0][searchable]': true, 'columns[0][orderable]': true }).toString();
    const res = await fetchWithRetry(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const json = await res.json();

    if (json?.data) {
      return json.data.map(row => {
        const vals = Array.isArray(row) ? row : Object.values(row);
        return { name: vals[0] || '', url: vals[1] || '', region: vals[2] || '' };
      }).filter(r => r.name);
    }
  } catch (err) {
    console.warn(`[Fetch] DataTables direktori gagal, fallback ke HTML...`);
  }

  // Fallback HTML Scrape
  try {
    const htmlEndpoint = new URL('/eproc4/umumkan/portal', baseUrl).toString();
    const res = await fetchWithRetry(htmlEndpoint, { method: 'GET', headers: { Accept: 'text/html' } });
    const $ = cheerio.load(await res.text());

    return $('table tbody tr').map((_, el) => {
      const cells = $(el).find('td');
      if (cells.length < 2) return null;
      return {
        name: $(cells[0]).text().trim(),
        url: $(cells[1]).find('a').attr('href') || $(cells[1]).text().trim(),
        region: cells.length >= 3 ? $(cells[2]).text().trim() : ''
      };
    }).get().filter(r => r?.name);
  } catch (err) {
    console.error(`[Fetch] Gagal mengambil direktori HTML:`, err.message);
    return [];
  }
}
