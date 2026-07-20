const FORMULA_PREFIX_PATTERN = /^(?:[\t\r\n]|\s*[=+\-@])/u;
const RFC_4180_QUOTE_PATTERN = /[",\r\n]/u;

function serializeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  }

  return String(value);
}

export function escapeCsvCell(value: unknown): string {
  const serializedValue = serializeCsvValue(value);
  const neutralizedValue = FORMULA_PREFIX_PATTERN.test(serializedValue)
    ? `'${serializedValue}`
    : serializedValue;

  if (!RFC_4180_QUOTE_PATTERN.test(neutralizedValue)) {
    return neutralizedValue;
  }

  return `"${neutralizedValue.replace(/"/gu, '""')}"`;
}

export function createCsv(rows: ReadonlyArray<ReadonlyArray<unknown>>): string {
  return rows.map(row => row.map(escapeCsvCell).join(',')).join('\r\n');
}
