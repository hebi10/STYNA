export function getSafeRedirectTarget(
  candidate: string | null | undefined,
  origin: string,
  fallback = '/mypage',
): string {
  if (!candidate || candidate.includes('\\')) {
    return fallback;
  }

  try {
    const expectedOrigin = new URL(origin).origin;
    const parsed = new URL(candidate, expectedOrigin);

    if (parsed.origin !== expectedOrigin) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
