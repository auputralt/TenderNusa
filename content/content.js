/**
 * Content script injected at document_start on indotender.com.
 * Captures user interactions (click, change, input, submit)
 * and observes DOM mutations on the tender table.
 */

(function () {
  'use strict';

  function sendEvent(eventType, targetSelector, targetText, extra = {}) {
    try {
      chrome.runtime.sendMessage({
        type: 'USER_EVENT',
        event: {
          eventType,
          targetSelector,
          targetText: targetText?.substring(0, 200),
          ...extra,
        },
      });
    } catch {
      // Extension context may be invalidated
    }
  }

  function sendDomMutation(mutationType, detail) {
    try {
      chrome.runtime.sendMessage({
        type: 'DOM_MUTATION',
        mutation: { mutationType, ...detail },
      });
    } catch {
      // Extension context may be invalidated
    }
  }

  function getSelector(el) {
    if (!el || el === document) return 'document';
    if (el.id) return `#${el.id}`;
    const tag = el.tagName?.toLowerCase() ?? 'unknown';
    const cls = el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).join('.')}` : '';
    return `${tag}${cls}`;
  }

  function getVisibleText(el) {
    return (el.innerText ?? el.textContent ?? el.value ?? '').trim().substring(0, 200);
  }

  // --- User interaction listeners ---

  document.addEventListener('click', (e) => {
    sendEvent('click', getSelector(e.target), getVisibleText(e.target), {
      href: e.target.closest('a')?.href ?? null,
    });
  }, true);

  document.addEventListener('change', (e) => {
    sendEvent('change', getSelector(e.target), getVisibleText(e.target), {
      value: e.target.value ?? null,
    });
  }, true);

  document.addEventListener('input', (e) => {
    // Debounce: only send if it looks like a search/filter input
    if (e.target.matches?.('input[type="text"], input[type="search"], input:not([type])')) {
      clearTimeout(e.target._tnDebounce);
      e.target._tnDebounce = setTimeout(() => {
        sendEvent('input', getSelector(e.target), getVisibleText(e.target), {
          value: e.target.value ?? null,
        });
      }, 500);
    }
  }, true);

  document.addEventListener('submit', (e) => {
    sendEvent('submit', getSelector(e.target), getVisibleText(e.target));
  }, true);

  // --- DOM MutationObserver for tender table ---

  function setupTableObserver() {
    const tbody = document.querySelector('table tbody, .tender-table tbody, [class*="table"] tbody');
    if (!tbody) return;

    const observer = new MutationObserver((mutations) => {
      let addedRows = 0;
      for (const m of mutations) {
        addedRows += m.addedNodes?.length ?? 0;
      }
      if (addedRows > 0) {
        sendDomMutation('table_rows_changed', {
          addedRows,
          totalRows: tbody.querySelectorAll('tr').length,
          selector: getSelector(tbody),
        });
      }
    });

    observer.observe(tbody, { childList: true, subtree: false });

    // Also observe pagination / total records elements
    const paginationSelectors = [
      '.pagination', '[class*="pagination"]',
      '[class*="total"]', '[class*="records"]',
      '[class*="page-info"]', '[class*="pager"]',
    ];

    for (const sel of paginationSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const pgObserver = new MutationObserver(() => {
          sendDomMutation('pagination_changed', {
            text: getVisibleText(el),
            selector: getSelector(el),
          });
        });
        pgObserver.observe(el, { childList: true, subtree: true, characterData: true });
      }
    }
  }

  // Try to set up immediately, then retry after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(setupTableObserver, 1000));
  } else {
    setTimeout(setupTableObserver, 1000);
  }

  // Retry table observer periodically (in case table loads late)
  let retries = 0;
  const retryInterval = setInterval(() => {
    setupTableObserver();
    retries++;
    if (retries > 10) clearInterval(retryInterval);
  }, 2000);

  // Notify background that content script is alive
  try {
    chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY', url: location.href });
  } catch {
    // Ignore
  }
})();
