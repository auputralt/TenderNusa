/**
 * Correlation engine: links network requests to user interactions.
 * Matches requests within a time window (default 5s) after a user event.
 */

const DEFAULT_WINDOW_MS = 5000;

export function correlateRequestToEvent(request, userEvents, windowMs = DEFAULT_WINDOW_MS) {
  const reqTime = request.timestamp;

  for (let i = userEvents.length - 1; i >= 0; i--) {
    const event = userEvents[i];
    const diff = reqTime - event.timestamp;

    if (diff < 0) continue;
    if (diff > windowMs) break;

    if (isRelevantEvent(event, request)) {
      return {
        triggeredBy: event,
        correlationType: guessCorrelationType(event, request),
      };
    }
  }

  return null;
}

function isRelevantEvent(event, request) {
  const { classification, trpcParse } = request;

  if (event.eventType === 'click') {
    if (classification?.type === 'rsc_navigation_or_payload') return true;
    if (classification?.type === 'trpc_batch_api') return true;
    if (event.targetText?.match(/next|prev|page|halaman/i)) return true;
    if (event.targetText?.match(/rows?\s*(per\s*)?page|tampilkan/i)) return true;
  }

  if (event.eventType === 'change') {
    if (event.targetText?.match(/lpse|year|tahun|winner|work\s*unit|sort/i)) return true;
    if (classification?.type === 'trpc_batch_api') return true;
  }

  if (event.eventType === 'submit') return true;

  return false;
}

function guessCorrelationType(event, request) {
  const text = event.targetText?.toLowerCase() ?? '';
  const { trpcParse } = request;

  if (text.match(/next|halaman\s*(berikutnya|>\s*$)/)) return 'pagination_next';
  if (text.match(/prev|halaman\s*(sebelumnya|<\s*$)/)) return 'pagination_prev';
  if (text.match(/rows?\s*(per\s*)?page|tampilkan/i)) return 'page_size_change';
  if (text.match(/sort|urutkan/i)) return 'sort_change';
  if (text.match(/lpse|provinsi|kabupaten/i)) return 'filter_lpse';
  if (text.match(/year|tahun/i)) return 'filter_year';
  if (text.match(/winner|pemenang/i)) return 'filter_winner';
  if (text.match(/work\s*unit|unit\s*kerja|satker/i)) return 'filter_work_unit';
  if (text.match(/search|cari/i)) return 'search';
  if (event.eventType === 'submit') return 'form_submit';
  if (event.eventType === 'click') return 'navigation_click';

  return 'user_interaction';
}
