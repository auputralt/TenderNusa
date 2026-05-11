/**
 * Data completeness reporter.
 * Generates smart messages about what was captured vs what's missing.
 */

import { formatSchemaPreview } from './response-capture.js';

export function generateReport(session) {
  const { requests, userEvents, domMutations } = session;
  const messages = [];
  const findings = {};

  const trpcRequests = requests.filter(r => r.classification?.type === 'trpc_batch_api');
  const rscRequests = requests.filter(r => r.classification?.type === 'rsc_navigation_or_payload');
  const authRequests = requests.filter(r => r.classification?.type === 'auth');

  if (trpcRequests.length > 0) {
    findings.hasTrpc = true;
    findings.trpcProcedures = new Set();

    for (const req of trpcRequests) {
      if (req.trpcParse?.procedures) {
        for (const proc of req.trpcParse.procedures) {
          findings.trpcProcedures.add(proc.name);
        }
      }
    }

    const procList = [...findings.trpcProcedures].join(', ');
    messages.push({
      level: 'success',
      text: `Detected tRPC endpoint(s): ${procList}`,
    });

    for (const req of trpcRequests) {
      if (req.trpcParse?.procedures) {
        for (const proc of req.trpcParse.procedures) {
          if (proc.role === 'table_data' && proc.params) {
            const paramKeys = Object.keys(proc.params).filter(k => proc.params[k] != null);
            messages.push({
              level: 'success',
              text: `Primary table candidate: ${proc.name} (${paramKeys.join(', ')})`,
            });
            break;
          }
        }
      }
      break;
    }
  }

  if (trpcRequests.length > 0) {
    const withResponse = trpcRequests.filter(r => r.response?.rawJson);
    if (withResponse.length === 0) {
      messages.push({
        level: 'warning',
        text: 'tRPC endpoints detected but response bodies not captured (update capture to store JSON body for schema analysis).',
      });
    } else {
      for (const req of withResponse) {
        if (req.response?.schemaPreview?.length > 0) {
          const procNames = req.trpcParse?.procedures?.map(p => p.name).join(', ');
          messages.push({
            level: 'success',
            text: `Response fields detected for ${procNames}:\n${formatSchemaPreview(req.response.schemaPreview)}`,
          });
        }
      }
    }
  }

  if (rscRequests.length > 0) {
    findings.hasRsc = true;
    messages.push({
      level: 'info',
      text: `Detected ${rscRequests.length} RSC navigation/payload request(s).`,
    });
  }

  if (authRequests.length > 0) {
    findings.hasAuth = true;
    messages.push({
      level: 'info',
      text: `Auth/session request detected: ${authRequests.length} request(s).`,
    });
  }

  if (domMutations.length > 0) {
    findings.hasDomChanges = true;
    messages.push({
      level: 'info',
      text: `Detected ${domMutations.length} DOM mutation(s) (table rows changed).`,
    });
  }

  const correlated = requests.filter(r => r.correlation);
  if (correlated.length > 0) {
    findings.hasCorrelation = true;
    messages.push({
      level: 'success',
      text: `Correlated ${correlated.length} request(s) to user interactions.`,
    });
  }

  if (requests.length === 0) {
    messages.push({
      level: 'warning',
      text: 'No network requests captured. Navigate to https://indotender.com/tender/table and try again.',
    });
  }

  if (trpcRequests.length === 0 && rscRequests.length === 0 && requests.length > 0) {
    messages.push({
      level: 'warning',
      text: 'Network requests captured but no tRPC or RSC endpoints detected. Ensure you are on the tender/table page.',
    });
  }

  if (findings.hasTrpc && !findings.hasCorrelation && userEvents.length === 0) {
    messages.push({
      level: 'info',
      text: 'tRPC endpoints detected. Interact with the page (pagination, filters) to see request correlations.',
    });
  }

  return { messages, findings };
}
