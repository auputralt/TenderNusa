/**
 * TenderNusa — Modern Client-Side App
 */

// ==============================
// STATE MANAGEMENT
// ==============================
const state = {
  tenders: [],
  tenderTotal: 0,
  tenderPage: 0,
  tenderPageSize: 25,
  companies: [],
  directory: [],
  summary: null,
  filters: { search: '', agency: '', year: '', winner: '', unit: '' },
  lastUpdated: null,
  theme: localStorage.getItem('tendernusa-theme') || null,
  yearOptions: new Set()
};

// ==============================
// DOM UTILITIES & CACHE
// ==============================
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const dom = {
  globalSearch: $('#global-search'),
  globalSearchForm: $('#global-search-form'),
  themeToggle: $('#theme-toggle'),
  refreshBtn: $('#refresh-btn'),
  refreshLabel: $('#refresh-label'),
  lastUpdated: $('#last-updated'),
  ingestionDot: $('#ingestion-dot'),
  ingestionStatus: $('#ingestion-status'),
  kpiTenders: $('#kpi-tenders'),
  kpiAgencies: $('#kpi-agencies'),
  kpiWinners: $('#kpi-winners'),
  kpiValue: $('#kpi-value'),
  filters: {
    agency: $('#filter-agency'),
    year: $('#filter-year'),
    winner: $('#filter-winner'),
    unit: $('#filter-unit'),
    search: $('#filter-search'),
    chips: $('#filter-chips'),
    clearBtn: $('#filters-clear')
  },
  tendersContent: $('#tenders-content'),
  tenderCount: $('#tender-count'),
  tenderPagination: $('#tender-pagination'),
  directoryContent: $('#directory-content'),
  directoryCount: $('#directory-count'),
  companiesContent: $('#companies-content'),
  companiesCount: $('#companies-count'),
  modal: {
    overlay: $('#detail-modal'),
    title: $('#modal-title'),
    badge: $('#modal-status-badge'),
    body: $('#modal-body'),
    close: $('#modal-close')
  },
  toastContainer: $('#toast-container')
};

// ==============================
// INITIALIZATION
// ==============================
function init() {
  initTheme();
  bindEvents();
  renderSkeletons();
  loadData();
}

function initTheme() {
  if (!state.theme) {
    state.theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', state.theme);
}

// ==============================
// EVENT LISTENERS
// ==============================
function bindEvents() {
  dom.themeToggle.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
    localStorage.setItem('tendernusa-theme', state.theme);
  });

  dom.refreshBtn.addEventListener('click', triggerRefresh);

  dom.globalSearchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    state.filters.search = dom.globalSearch.value.trim();
    dom.filters.search.value = state.filters.search;
    state.tenderPage = 0;
    fetchTenders();
    $('#section-tenders').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      dom.globalSearch.focus();
    }
    if (e.key === 'Escape' && !dom.modal.overlay.hidden) closeModal();
  });

  const debouncedFilter = debounce(() => {
    state.filters = {
      agency: dom.filters.agency.value.trim(),
      year: dom.filters.year.value,
      winner: dom.filters.winner.value.trim(),
      unit: dom.filters.unit.value.trim(),
      search: dom.filters.search.value.trim()
    };
    dom.globalSearch.value = state.filters.search;
    state.tenderPage = 0;
    fetchTenders();
    renderFilterChips();
  }, 350);

  ['agency', 'winner', 'unit', 'search'].forEach(key =>
    dom.filters[key].addEventListener('input', debouncedFilter)
  );
  dom.filters.year.addEventListener('change', debouncedFilter);

  dom.filters.clearBtn.addEventListener('click', () => {
    Object.keys(state.filters).forEach(k => { state.filters[k] = ''; dom.filters[k].value = ''; });
    dom.globalSearch.value = '';
    state.tenderPage = 0;
    fetchTenders();
    renderFilterChips();
  });

  dom.modal.close.addEventListener('click', closeModal);
  dom.modal.overlay.addEventListener('click', (e) => e.target === dom.modal.overlay && closeModal());
}

// ==============================
// DATA FETCHING
// ==============================
async function loadData() {
  await Promise.all([fetchSummary(), fetchTenders(), fetchDirectory(), fetchCompanies()]);
}

async function fetchSummary() {
  try {
    const res = await fetch('/api/summary');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    state.summary = data;
    if (data.lastUpdated) {
      state.lastUpdated = data.lastUpdated;
      dom.lastUpdated.textContent = `Diperbarui ${formatRelativeTime(new Date(data.lastUpdated))}`;
    }

    renderKPIs();
    updateIngestionStatus(data.ingestionStatus, data.ingestionError);
  } catch (err) {
    showToast(`Gagal memuat ringkasan: ${err.message}`, 'error');
  }
}

async function fetchTenders() {
  renderTendersSkeleton();
  try {
    const params = new URLSearchParams({ ...state.filters, limit: state.tenderPageSize, offset: state.tenderPage * state.tenderPageSize });

    const res = await fetch(`/api/tenders?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    state.tenders = data.data || [];
    state.tenderTotal = data.total || 0;

    populateYearFilter();
    renderTenders();
    renderPagination();
  } catch (err) {
    dom.tendersContent.textContent = '';
    const errDiv = document.createElement('div');
    errDiv.className = 'state-error';
    const p = document.createElement('p');
    p.textContent = `Gagal memuat tender: ${err.message}`;
    errDiv.appendChild(p);
    dom.tendersContent.appendChild(errDiv);
  }
}

async function fetchDirectory() {
  try {
    const res = await fetch('/api/directory');
    const data = await res.json();
    state.directory = data.data || [];
    renderDirectory();
  } catch (err) {
    dom.directoryContent.textContent = '';
    const errDiv = document.createElement('div');
    errDiv.className = 'state-error';
    const p = document.createElement('p');
    p.textContent = 'Gagal memuat direktori';
    errDiv.appendChild(p);
    dom.directoryContent.appendChild(errDiv);
  }
}

async function fetchCompanies() {
  try {
    const res = await fetch('/api/companies?limit=50');
    const data = await res.json();
    state.companies = data.data || [];
    renderCompanies();
  } catch (err) {
    dom.companiesContent.textContent = '';
    const errDiv = document.createElement('div');
    errDiv.className = 'state-error';
    const p = document.createElement('p');
    p.textContent = 'Gagal memuat perusahaan';
    errDiv.appendChild(p);
    dom.companiesContent.appendChild(errDiv);
  }
}

async function fetchTenderDetail(id) {
  try {
    const res = await fetch(`/api/tenders/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error('Not Found');
    openModal(await res.json());
  } catch (err) {
    const cached = state.tenders.find(t => t.tender_id === id);
    cached ? openModal(cached) : showToast('Gagal memuat detail tender', 'error');
  }
}

// ==============================
// REFRESH & POLLING LOGIC
// ==============================
async function triggerRefresh() {
  dom.refreshBtn.classList.add('is-spinning');
  try {
    const res = await fetch('/api/refresh', { method: 'POST' });
    if (res.status === 409 || res.ok) {
      showToast('Ingestion dimulai. Data akan diperbarui otomatis.', 'info');
      pollRefreshStatus();
    } else throw new Error('Gagal memulai ingestion');
  } catch (err) {
    dom.refreshBtn.classList.remove('is-spinning');
    showToast(err.message, 'error');
  }
}

function pollRefreshStatus() {
  const interval = setInterval(async () => {
    try {
      const res = await fetch('/api/summary');
      const data = await res.json();
      updateIngestionStatus(data.ingestionStatus, data.ingestionError);

      if (data.ingestionStatus !== 'running') {
        clearInterval(interval);
        dom.refreshBtn.classList.remove('is-spinning');
        loadData();
        showToast('Data berhasil diperbarui!', 'success');
      }
    } catch (e) { /* ignore polling errors */ }
  }, 3000);
}

function updateIngestionStatus(status, error) {
  dom.ingestionDot.className = `ingestion-dot ${status === 'running' ? 'is-running' : status === 'completed' ? 'is-done' : 'is-error'}`;
  dom.ingestionStatus.textContent = status === 'running' ? 'Mengambil data...' : status === 'completed' ? 'Data siap' : `Gagal: ${error}`;
}

// ==============================
// RENDERERS
// ==============================
function renderKPIs() {
  if (!state.summary) return;
  animateCounter(dom.kpiTenders, state.summary.totalTenders);
  animateCounter(dom.kpiAgencies, state.summary.totalAgencies);
  animateCounter(dom.kpiWinners, state.summary.totalWinners);
  animateCounter(dom.kpiValue, state.summary.totalContractValue, true);
}

function createBadge(status) {
  const s = (status || '').toLowerCase();
  const color = (s.includes('selesai') || s.includes('kontrak')) ? 'green'
              : (s.includes('batal') || s.includes('gagal')) ? 'red'
              : s.includes('proses') ? 'teal' : 'neutral';
  const span = document.createElement('span');
  span.className = `badge badge--${color}`;
  span.textContent = status || '-';
  return span;
}

function renderTenders() {
  dom.tenderCount.textContent = `${formatNumber(state.tenderTotal)} tender`;
  if (!state.tenders.length) {
    dom.tendersContent.textContent = '';
    const empty = document.createElement('div');
    empty.className = 'state-empty';
    const p = document.createElement('p');
    p.textContent = 'Tidak ada data tender ditemukan.';
    empty.appendChild(p);
    dom.tendersContent.appendChild(empty);
    dom.tenderPagination.hidden = true;
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';
  const table = document.createElement('table');
  table.className = 'table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['Kode', 'Nama Tender', 'Instansi', 'Metode', 'Tahun', 'HPS', 'Status', 'Aksi'].forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const t of state.tenders) {
    const tr = document.createElement('tr');

    const cells = [
      { text: t.tender_id, cls: 'col-code', label: 'Kode' },
      { text: t.tender_name, cls: 'col-name', label: 'Nama Tender' },
      { text: t.agency_name, label: 'Instansi' },
      { text: t.procurement_method, label: 'Metode' },
      { text: t.fiscal_year, label: 'Tahun' },
      { text: formatRupiah(t.hps_value), cls: 'col-value', label: 'HPS' }
    ];

    for (const c of cells) {
      const td = document.createElement('td');
      td.setAttribute('data-label', c.label);
      if (c.cls) td.className = c.cls;
      td.textContent = c.text || '';
      tr.appendChild(td);
    }

    const statusTd = document.createElement('td');
    statusTd.setAttribute('data-label', 'Status');
    statusTd.appendChild(createBadge(t.tender_status));
    tr.appendChild(statusTd);

    const actionTd = document.createElement('td');
    actionTd.className = 'col-action';
    const btn = document.createElement('button');
    btn.className = 'btn btn--sm';
    btn.textContent = 'Detail';
    const tenderId = t.tender_id;
    btn.addEventListener('click', () => fetchTenderDetail(tenderId));
    actionTd.appendChild(btn);
    tr.appendChild(actionTd);

    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);

  dom.tendersContent.textContent = '';
  dom.tendersContent.appendChild(wrap);
}

function renderDirectory() {
  dom.directoryCount.textContent = `${formatNumber(state.directory.length)} portal`;
  const grid = document.createElement('div');
  grid.className = 'directory-grid';

  for (const d of state.directory) {
    const card = document.createElement('article');
    card.className = 'directory-card';

    const name = document.createElement('h3');
    name.className = 'directory-card__name';
    name.textContent = d.lpse_directory_name;

    const region = document.createElement('p');
    region.className = 'directory-card__region';
    region.textContent = d.lpse_directory_region;

    const link = document.createElement('a');
    link.className = 'directory-card__link';
    link.href = d.lpse_directory_url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = d.lpse_directory_url;

    card.append(name, region, link);
    grid.appendChild(card);
  }

  dom.directoryContent.textContent = '';
  dom.directoryContent.appendChild(grid);
}

function renderCompanies() {
  dom.companiesCount.textContent = `${formatNumber(state.companies.length)} perusahaan`;
  const grid = document.createElement('div');
  grid.className = 'company-grid';

  state.companies.forEach((c, i) => {
    const card = document.createElement('article');
    card.className = 'company-card';

    const rank = document.createElement('div');
    rank.className = `company-card__rank ${i < 3 ? 'company-card__rank--top' : ''}`;
    rank.textContent = i + 1;

    const info = document.createElement('div');
    info.className = 'company-card__info';

    const name = document.createElement('p');
    name.className = 'company-card__name';
    name.textContent = c.company_name;

    const stats = document.createElement('div');
    stats.className = 'company-card__stats';

    const winStat = document.createElement('span');
    winStat.className = 'company-card__stat';
    const winStrong = document.createElement('strong');
    winStrong.textContent = formatNumber(c.company_win_count);
    winStat.append(winStrong, ' menang');

    const valStat = document.createElement('span');
    valStat.className = 'company-card__stat';
    const valStrong = document.createElement('strong');
    valStrong.textContent = formatRupiah(c.company_total_contract_value);
    valStat.appendChild(valStrong);

    stats.append(winStat, valStat);
    info.append(name, stats);
    card.append(rank, info);
    grid.appendChild(card);
  });

  dom.companiesContent.textContent = '';
  dom.companiesContent.appendChild(grid);
}

function openModal(tender) {
  dom.modal.title.textContent = tender.tender_name || 'Detail Tender';
  dom.modal.badge.textContent = '';
  dom.modal.badge.appendChild(createBadge(tender.tender_status));

  const fields = [
    { label: 'Instansi', val: tender.agency_name },
    { label: 'HPS', val: formatRupiah(tender.hps_value) },
    { label: 'Pemenang', val: tender.winner_name },
    { label: 'Nilai Kontrak', val: formatRupiah(tender.contract_value) },
    { label: 'Portal LPSE', val: tender.lpse_portal_name }
  ];

  dom.modal.body.textContent = '';
  const detailGrid = document.createElement('div');
  detailGrid.className = 'detail-grid';

  for (const f of fields) {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'detail-field';
    const label = document.createElement('span');
    label.className = 'detail-field__label';
    label.textContent = f.label;
    const value = document.createElement('span');
    value.className = 'detail-field__value';
    value.textContent = f.val || '-';
    fieldDiv.append(label, value);
    detailGrid.appendChild(fieldDiv);
  }
  dom.modal.body.appendChild(detailGrid);

  if (tender.source_url) {
    const linkDiv = document.createElement('div');
    linkDiv.className = 'detail-link';
    const a = document.createElement('a');
    a.href = tender.source_url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'btn btn--primary';
    a.textContent = 'Buka di LPSE';
    linkDiv.appendChild(a);
    dom.modal.body.appendChild(linkDiv);
  }

  dom.modal.overlay.hidden = false;
  requestAnimationFrame(() => dom.modal.overlay.classList.add('is-visible'));
}

function closeModal() {
  dom.modal.overlay.classList.remove('is-visible');
  setTimeout(() => dom.modal.overlay.hidden = true, 300);
}

// ==============================
// UTILITIES
// ==============================
function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn.apply(this, args), ms); };
}

function formatNumber(n) { return new Intl.NumberFormat('id-ID').format(n || 0); }
function formatRupiah(n) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0); }

function formatRelativeTime(date) {
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 60) return `${diff} detik lalu`;
  if (diff < 3600) return `${Math.floor(diff/60)} menit lalu`;
  return date.toLocaleDateString('id-ID');
}

function showToast(msg, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  const span = document.createElement('span');
  span.textContent = msg;
  toast.appendChild(span);
  dom.toastContainer.appendChild(toast);
  setTimeout(() => { toast.classList.add('is-leaving'); setTimeout(() => toast.remove(), 300); }, 3000);
}

function animateCounter(el, target, isCurrency = false) {
  let start = 0;
  const duration = 1000;
  const startTime = performance.now();

  const tick = (now) => {
    const progress = Math.min((now - startTime) / duration, 1);
    const easeOutCubic = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(start + (target - start) * easeOutCubic);
    el.textContent = isCurrency ? formatRupiah(current) : formatNumber(current);
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function renderSkeletons() {
  dom.tendersContent.textContent = '';
  const container = document.createElement('div');
  container.className = 'skeleton-table';
  for (let i = 0; i < 5; i++) {
    const row = document.createElement('div');
    row.className = 'skeleton-row';
    const bar = document.createElement('div');
    bar.className = 'skeleton skeleton-bar';
    bar.style.width = `${70 + Math.random() * 30}%`;
    bar.style.height = '20px';
    row.appendChild(bar);
    container.appendChild(row);
  }
  dom.tendersContent.appendChild(container);
}

function renderTendersSkeleton() {
  renderSkeletons();
}

function populateYearFilter() {
  state.tenders.forEach(t => t.fiscal_year && state.yearOptions.add(t.fiscal_year));
  const current = dom.filters.year.value;
  dom.filters.year.textContent = '';
  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = 'Semua Tahun';
  dom.filters.year.appendChild(defaultOpt);
  for (const y of Array.from(state.yearOptions).sort((a,b) => b-a)) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    dom.filters.year.appendChild(opt);
  }
  dom.filters.year.value = current;
}

function renderPagination() {
  dom.tenderPagination.textContent = '';
  const totalPages = Math.ceil(state.tenderTotal / state.tenderPageSize);
  if (totalPages <= 1) { dom.tenderPagination.hidden = true; return; }
  dom.tenderPagination.hidden = false;

  for (let i = 0; i < totalPages && i < 10; i++) {
    const btn = document.createElement('button');
    btn.className = `btn btn--sm ${i === state.tenderPage ? 'btn--active' : ''}`;
    btn.textContent = i + 1;
    const page = i;
    btn.addEventListener('click', () => { state.tenderPage = page; fetchTenders(); });
    dom.tenderPagination.appendChild(btn);
  }
}

function renderFilterChips() {
  const container = dom.filters.chips;
  container.textContent = '';
  const active = Object.entries(state.filters).filter(([, v]) => v);
  if (!active.length) { container.hidden = true; dom.filters.clearBtn.hidden = true; return; }
  container.hidden = false;
  dom.filters.clearBtn.hidden = false;

  for (const [key, val] of active) {
    const chip = document.createElement('span');
    chip.className = 'filter-chip';
    chip.textContent = `${key}: ${val}`;
    container.appendChild(chip);
  }
}

// Scroll progress
window.addEventListener('scroll', () => {
  const bar = document.querySelector('.scroll-progress__bar');
  if (!bar) return;
  const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
  const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
  bar.style.width = scrollHeight > 0 ? `${(scrollTop / scrollHeight) * 100}%` : '0%';
});

// Boot App
document.addEventListener('DOMContentLoaded', init);
