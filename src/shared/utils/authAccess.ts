export const AUTH_ACCESS_CHANGED_EVENT = 'hebimall:auth-access-changed';

type AuthClaims = Record<string, unknown> | null | undefined;
type UserAccessData = Record<string, unknown> | null | undefined;

export function hasActiveAccount(userData: UserAccessData): boolean {
  return userData?.status === 'active';
}

export function hasStrictAdminAccess(
  claims: AuthClaims,
  userData: UserAccessData
): boolean {
  const hasAdminClaim = claims?.admin === true || claims?.role === 'admin';

  return hasAdminClaim
    && userData?.role === 'admin'
    && hasActiveAccount(userData);
}

export function notifyAuthAccessChanged(userId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(AUTH_ACCESS_CHANGED_EVENT, {
    detail: { userId },
  }));
}
