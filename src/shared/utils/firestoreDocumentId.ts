const RESERVED_DOCUMENT_ID_PATTERN = /^__.*__$/;

function getUtf8ByteLength(value: string): number {
  try {
    return encodeURIComponent(value).replace(/%[0-9A-F]{2}|./gi, 'x').length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function isValidFirestoreDocumentId(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    return false;
  }

  return value !== '.'
    && value !== '..'
    && !value.includes('/')
    && !RESERVED_DOCUMENT_ID_PATTERN.test(value)
    && getUtf8ByteLength(value) <= 1500;
}
