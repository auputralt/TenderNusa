/**
 * Popup script.
 * Renders session data: completeness report, request log, user events, DOM mutations.
 * Uses textContent / DOM methods only (no innerHTML) to prevent XSS.
 */

import { generateReport } from '../lib/data-completeness.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

let currentFilter = 'all';
let sessionData = null;

async function loadSession() {
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'GET_SESSION' });
    if (resp?.session) {
      sessionData = resp.session;
      render();
    }
  } catch {
    $('#status-text').textContent = 'Error loading session';
  }
}

function render() {
  if (!sessionData) return;

  const { requests, userEvents, domMutations } = sessionData;

  const indicator = $('#status-indicator');
  const statusText = $('#status-text');
  if (sessionData.active) {
    indicator.className = 'status-dot active';
    statusText.textContent = `Capturing — ${requests.length} requests`;
  } else {
    indicator.className = 'status-dot inactive';
    statusText.textContent = 'Inactive';
  }

  const report = generateReport(sessionData);
  renderMessages(report.messages);

  $('#request-count').textContent = requests.length;
  renderRequests(requests);

  $('#event-count').textContent = userEvents.length;
  renderEvents(userEvents);

  $('#mutation-count').textContent = domMutations.length;
  renderMutations(domMutations);
}

function renderMessages(messages) {
  const container = $('#messages');
  container.textContent = '';
  for (const m of messages) {
    const div = document.createElement('div');
    div.className = `msg msg-${m.level}`;
    div.textContent = m.text;
    div.style.whiteSpace = 'pre-wrap';
    container.appendChild(div);
  }
}

function renderRequests(requests) {
  const list = $('#request-list');
  list.textContent = '';

  const filtered = currentFilter === 'all'
    ? requests
    : requests.filter(r => r.classification?.type === currentFilter);

  if (filtered.length === 0) {
    list.appendChild(createEmpty('No matching requests.'));
    return;
  }

  for (const req of filtered) {
    const item = createRequestItem(req);
    list.appendChild(item);
  }
}

function createRequestItem(req) {
  const cls = req.classification?.type ?? 'other';
  const label = req.classification?.label ?? 'Unknown';
  const method = req.method ?? 'GET';
  const status = req.statusCode ?? '—';

  const details = document.createElement('details');
  details.className = `request-item type-${cls}`;

  const summary = document.createElement('summary');

  const methodSpan = document.createElement('span');
  methodSpan.className = 'req-method';
  methodSpan.textContent = method;

  const labelSpan = document.createElement('span');
  labelSpan.className = 'req-label';
  labelSpan.textContent = label;

  const statusSpan = document.createElement('span');
  statusSpan.className = `req-status ${status >= 200 && status < 300 ? 'status-ok' : 'status-err'}`;
  statusSpan.textContent = String(status);

  summary.appendChild(methodSpan);
  summary.appendChild(labelSpan);
  summary.appendChild(statusSpan);
  details.appendChild(summary);

  const urlDiv = document.createElement('div');
  urlDiv.className = 'req-url';
  urlDiv.textContent = truncate(req.url, 120);
  details.appendChild(urlDiv);

  if (req.trpcParse?.procedures) {
    const detailDiv = document.createElement('div');
    detailDiv.className = 'req-detail';
    for (const proc of req.trpcParse.procedures) {
      const line = document.createElement('div');

      const nameSpan = document.createElement('span');
      nameSpan.className = 'proc-name';
      nameSpan.textContent = proc.name;

      line.appendChild(nameSpan);

      if (proc.role !== 'unknown') {
        const roleSpan = document.createElement('span');
        roleSpan.className = 'proc-role';
        roleSpan.textContent = proc.role;
        line.appendChild(document.createTextNode(' '));
        line.appendChild(roleSpan);
      }

      if (proc.params) {
        const activeParams = Object.entries(proc.params)
          .filter(([, v]) => v != null)
          .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
          .join(', ');
        if (activeParams) {
          const paramsSpan = document.createElement('span');
          paramsSpan.className = 'proc-params';
          paramsSpan.textContent = activeParams;
          const br = document.createElement('br');
          line.appendChild(br);
          line.appendChild(paramsSpan);
        }
      }

      detailDiv.appendChild(line);
    }
    details.appendChild(detailDiv);
  }

  if (req.correlation) {
    const c = req.correlation;
    const corrDiv = document.createElement('div');
    corrDiv.className = 'correlation';
    corrDiv.textContent = `Triggered by: ${c.correlationType} — ${c.triggeredBy.targetText ?? c.triggeredBy.eventType}`;
    details.appendChild(corrDiv);
  }

  if (req.response) {
    const respDiv = document.createElement('div');
    respDiv.className = 'response-info';
    if (req.response.parseError) {
      respDiv.textContent = `Response: ${req.response.size} bytes (parse error)`;
    } else if (req.response.rawJson) {
      respDiv.textContent = `Response: ${req.response.size} bytes, JSON captured`;
    } else {
      respDiv.textContent = `Response: ${req.response.size} bytes`;
    }
    details.appendChild(respDiv);
  }

  return details;
}

function renderEvents(events) {
  const list = $('#event-list');
  list.textContent = '';
  if (events.length === 0) {
    list.appendChild(createEmpty('No user interactions recorded.'));
    return;
  }

  const recent = events.slice(-20).reverse();
  for (const e of recent) {
    const div = document.createElement('div');
    div.className = 'event-item';

    div.appendChild(createSpan('event-type', e.eventType));
    div.appendChild(createSpan('event-target', e.targetSelector ?? ''));
    div.appendChild(createSpan('event-text', e.targetText ?? ''));
    div.appendChild(createSpan('event-time', formatTime(e.timestamp)));

    list.appendChild(div);
  }
}

function renderMutations(mutations) {
  const list = $('#mutation-list');
  list.textContent = '';
  if (mutations.length === 0) {
    list.appendChild(createEmpty('No DOM changes recorded.'));
    return;
  }

  const recent = mutations.slice(-20).reverse();
  for (const m of recent) {
    const div = document.createElement('div');
    div.className = 'mutation-item';

    div.appendChild(createSpan('mut-type', m.mutationType));
    if (m.addedRows != null) {
      div.appendChild(createSpan('mut-detail', `+${m.addedRows} rows (total: ${m.totalRows})`));
    }
    if (m.text) {
      div.appendChild(createSpan('mut-text', m.text));
    }
    div.appendChild(createSpan('mut-time', formatTime(m.timestamp)));

    list.appendChild(div);
  }
}

function createSpan(className, text) {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  return span;
}

function createEmpty(text) {
  const div = document.createElement('div');
  div.className = 'empty';
  div.textContent = text;
  return div;
}

function truncate(str, len) {
  return str.length > len ? str.substring(0, len) + '...' : str;
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

$('#btn-reset').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'RESET_SESSION' });
  sessionData = { startTime: Date.now(), requests: [], userEvents: [], domMutations: [], active: true };
  render();
});

$$('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    if (sessionData) renderRequests(sessionData.requests);
  });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SESSION_UPDATE') {
    loadSession();
  }
});

loadSession();
