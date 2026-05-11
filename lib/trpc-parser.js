/**
 * Parses tRPC batch URLs into structured procedure info.
 *
 * Input: full URL like
 *   /api/trpc/lpse.lpseDirectoryKeys,lpse.listWithPagination?batch=1&input=...
 *
 * Output:
 * {
 *   procedures: [
 *     { name: "lpse.lpseDirectoryKeys", role: "filter_metadata", params: null },
 *     { name: "lpse.listWithPagination", role: "table_data", params: { page: 1, ... } }
 *   ]
 * }
 */

const TABLE_DATA_PROCEDURES = new Set([
  'lpse.listWithPagination',
  'lpse.list',
  'tender.list',
  'tender.listWithPagination',
]);

const FILTER_METADATA_PROCEDURES = new Set([
  'lpse.lpseDirectoryKeys',
  'lpse.directoryKeys',
  'tender.filterOptions',
]);

export function parseTrpcUrl(fullUrl) {
  try {
    const url = new URL(fullUrl);
    const pathAfterTrpc = url.pathname.replace(/^\/api\/trpc\//, '');

    if (!pathAfterTrpc) return null;

    const procedureNames = pathAfterTrpc.split(',').map(s => s.trim()).filter(Boolean);
    const rawInput = url.searchParams.get('input');
    const batch = url.searchParams.get('batch');

    let parsedInput = null;
    if (rawInput) {
      try {
        const decoded = decodeURIComponent(rawInput);
        parsedInput = JSON.parse(decoded);
      } catch {
        parsedInput = null;
      }
    }

    const procedures = procedureNames.map((name, index) => {
      const key = String(index);
      let params = null;

      if (parsedInput && typeof parsedInput === 'object') {
        const item = parsedInput[key];
        if (item && typeof item === 'object') {
          params = item.json ?? item;
        } else if (Array.isArray(parsedInput) && parsedInput[index]) {
          params = parsedInput[index];
        }
      }

      let role = 'unknown';
      if (TABLE_DATA_PROCEDURES.has(name)) role = 'table_data';
      else if (FILTER_METADATA_PROCEDURES.has(name)) role = 'filter_metadata';
      else if (name.includes('directory') || name.includes('keys') || name.includes('filter')) role = 'filter_metadata';
      else if (name.includes('list') || name.includes('pagination') || name.includes('search')) role = 'table_data';
      else if (name.includes('detail') || name.includes('get') || name.includes('byId')) role = 'detail_data';

      return { name, role, params };
    });

    return {
      isBatch: procedureNames.length > 1 || batch === '1',
      procedures,
      rawInput: parsedInput,
    };
  } catch {
    return null;
  }
}
