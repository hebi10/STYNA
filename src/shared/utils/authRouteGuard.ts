interface AuthGuardInput {
  loading: boolean;
  hasUser: boolean;
  pathname: string;
}

export function getAuthGuardRedirect({
  loading,
  hasUser,
  pathname,
}: AuthGuardInput): '/auth/login' | null {
  if (loading || hasUser) {
    return null;
  }

  const isMypageRoute = pathname === '/mypage' || pathname.startsWith('/mypage/');
  return isMypageRoute ? '/auth/login' : null;
}
