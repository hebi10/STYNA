export function isFirestorePermissionDenied(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  return code === 'permission-denied' || code === 'firestore/permission-denied';
}
