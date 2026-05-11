/**
 * Captures and summarizes response JSON bodies.
 * Stores raw JSON + schema preview (top-level field list).
 */

export function captureResponse(bodyText, statusCode) {
  if (!bodyText || statusCode < 200 || statusCode >= 300) return null;

  try {
    const parsed = JSON.parse(bodyText);

    return {
      rawJson: parsed,
      size: new Blob([bodyText]).size,
      schemaPreview: buildSchemaPreview(parsed),
    };
  } catch {
    return {
      rawJson: null,
      size: bodyText.length,
      schemaPreview: null,
      parseError: true,
    };
  }
}

function buildSchemaPreview(data, prefix = 'data', depth = 0) {
  if (depth > 2 || data == null || typeof data !== 'object') return [];

  const fields = [];

  if (Array.isArray(data)) {
    if (data.length > 0 && typeof data[0] === 'object') {
      const itemFields = buildSchemaPreview(data[0], `${prefix}[]`, depth + 1);
      fields.push(...itemFields);
    } else {
      fields.push({ path: prefix, type: 'array' });
    }
  } else {
    for (const [key, value] of Object.entries(data)) {
      const path = `${prefix}.${key}`;
      if (Array.isArray(value)) {
        fields.push({ path, type: 'array' });
        if (value.length > 0 && typeof value[0] === 'object') {
          fields.push(...buildSchemaPreview(value[0], `${path}[]`, depth + 1));
        }
      } else if (typeof value === 'object' && value !== null) {
        fields.push({ path, type: 'object' });
        fields.push(...buildSchemaPreview(value, path, depth + 1));
      } else {
        fields.push({ path, type: typeof value, sample: value });
      }
    }
  }

  return fields;
}

export function formatSchemaPreview(schemaPreview) {
  if (!schemaPreview || schemaPreview.length === 0) return 'No fields detected';
  return schemaPreview
    .filter(f => f.type !== 'object')
    .map(f => {
      let line = f.path;
      if (f.sample !== undefined) line += ` (${typeof f.sample}: ${JSON.stringify(f.sample)})`;
      return line;
    })
    .join('\n');
}
