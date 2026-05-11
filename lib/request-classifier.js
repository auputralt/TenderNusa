/**
 * Classifies network requests by URL pattern.
 * Returns { type, label } for each request.
 */

const URL_PATTERNS = [
  { regex: /_rsc=/, type: 'rsc_navigation_or_payload', label: 'RSC / App Router' },
  { regex: /\/api\/trpc\//, type: 'trpc_batch_api', label: 'tRPC API' },
  { regex: /\/api\/auth\/get-session/, type: 'auth', label: 'Auth / Session' },
  { regex: /\/_next\/static\//, type: 'asset', label: 'Static Asset' },
];

export function classifyRequest(url) {
  const lower = url.toLowerCase();

  for (const { regex, type, label } of URL_PATTERNS) {
    if (regex.test(lower)) {
      return { type, label };
    }
  }

  if (/\.(html?)($|\?)/.test(lower) || lower === 'https://indotender.com/' || lower.startsWith('https://indotender.com/tender')) {
    return { type: 'document', label: 'Page / Document' };
  }

  return { type: 'other', label: 'Other' };
}
