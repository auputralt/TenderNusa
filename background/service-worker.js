/**
 * Background service worker.
 * Captures network requests on indotender.com via webNavigation + webRequest.
 * Classifies, parses tRPC, stores responses, correlates with user events.
 */

import { classifyRequest } from '../lib/request-classifier.js';
import { parseTrpcUrl } from '../lib/trpc-parser.js';
import { captureResponse } from '../lib/response-capture.js';
import { correlateRequestToEvent } from '../lib/correlation-engine.js';

const TARGET_DOMAIN = 'indotender.com';
let session = {
  startTime: null,
  requests: [],
  userEvents: [],
  domMutations: [],
  active: false,
};
let capturingTabId = null;

function resetSession() {
  session = {
    startTime: Date.now(),
    requests: [],
    userEvents: [],
    domMutations: [],
    active: true,
  };
}

function logRequest(details) {
  const classification = classifyRequest(details.url);
  let trpcParse = null;

  if (classification.type === 'trpc_batch_api') {
    trpcParse = parseTrpcUrl(details.url);
  }

  const entry = {
    id: details.requestId,
    url: details.url,
    method: details.method,
    classification,
    trpcParse,
    timestamp: details.timeStamp ? details.timeStamp * 1000 : Date.now(),
    tabId: details.tabId,
    type: details.type,
    statusCode: null,
    response: null,
    correlation: null,
  };

  session.requests.push(entry);

  if (entry.id) {
    pendingResponses.set(entry.id, entry);
  }

  broadcastUpdate();
}

const pendingResponses = new Map();

function handleResponse(details) {
  const entry = pendingResponses.get(details.requestId);
  if (!entry) return;

  entry.statusCode = details.statusCode;

  if (entry.classification.type === 'trpc_batch_api' && details.statusCode >= 200 && details.statusCode < 300) {
    try {
      const filter = chrome.webRequest.filterResponseData || null;
      if (filter) {
        const decoder = new TextDecoder();
        const chunks = [];

        const streamFilter = filter(details.requestId);
        streamFilter.ondata = (event) => {
          chunks.push(new Uint8Array(event.data));
          streamFilter.write(event.data);
        };
        streamFilter.onstop = () => {
          const body = chunks.map(c => decoder.decode(c, { stream: true })).join('');
          entry.response = captureResponse(body, details.statusCode);
          pendingResponses.delete(details.requestId);
          broadcastUpdate();
          streamFilter.disconnect();
        };
      }
    } catch {
      pendingResponses.delete(details.requestId);
    }
  } else {
    pendingResponses.delete(details.requestId);
  }
}

chrome.webNavigation.onCommitted.addListener((details) => {
  if (!details.url.includes(TARGET_DOMAIN)) return;

  if (details.url.includes('/tender/table')) {
    capturingTabId = details.tabId;
    resetSession();
  }
});

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!session.active && details.tabId !== capturingTabId) return;
    if (!details.url.includes(TARGET_DOMAIN)) return;
    logRequest(details);
  },
  { urls: [`https://${TARGET_DOMAIN}/*`] }
);

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (!session.active && details.tabId !== capturingTabId) return;
    handleResponse(details);
  },
  { urls: [`https://${TARGET_DOMAIN}/*`] }
);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'USER_EVENT') {
    session.userEvents.push({
      ...message.event,
      timestamp: Date.now(),
      tabId: sender.tab?.id,
    });
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'DOM_MUTATION') {
    session.domMutations.push({
      ...message.mutation,
      timestamp: Date.now(),
    });
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'GET_SESSION') {
    correlateAll();
    sendResponse({ session: structuredClone(session) });
    return false;
  }

  if (message.type === 'RESET_SESSION') {
    resetSession();
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'PING') {
    sendResponse({ active: session.active });
    return false;
  }

  return false;
});

function correlateAll() {
  for (const req of session.requests) {
    if (req.correlation) continue;
    req.correlation = correlateRequestToEvent(req, session.userEvents);
  }
}

function broadcastUpdate() {
  chrome.runtime.sendMessage({ type: 'SESSION_UPDATE', requestCount: session.requests.length }).catch(() => {});
}
