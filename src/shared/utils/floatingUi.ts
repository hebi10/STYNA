export interface FloatingUiPolicy {
  hideChat: boolean;
  hideGuide: boolean;
  suppressChatOnMobile: boolean;
  suppressGuideOnMobile: boolean;
}

const PUBLIC_FLOATING_UI_POLICY: FloatingUiPolicy = {
  hideChat: false,
  hideGuide: false,
  suppressChatOnMobile: false,
  suppressGuideOnMobile: false,
};

function normalizePathname(pathname: string | null): string | null {
  if (!pathname) {
    return null;
  }

  const normalized = pathname.replace(/\/+$/, '');
  return normalized || '/';
}

function matchesRouteSegment(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function getFloatingUiPolicy(pathname: string | null): FloatingUiPolicy {
  const normalizedPathname = normalizePathname(pathname);

  if (!normalizedPathname) {
    return PUBLIC_FLOATING_UI_POLICY;
  }

  if (
    matchesRouteSegment(normalizedPathname, '/auth') ||
    matchesRouteSegment(normalizedPathname, '/orders')
  ) {
    return {
      ...PUBLIC_FLOATING_UI_POLICY,
      hideChat: true,
      hideGuide: true,
    };
  }

  if (
    matchesRouteSegment(normalizedPathname, '/products') ||
    matchesRouteSegment(normalizedPathname, '/events')
  ) {
    return {
      ...PUBLIC_FLOATING_UI_POLICY,
      hideGuide: true,
      suppressChatOnMobile: true,
    };
  }

  return PUBLIC_FLOATING_UI_POLICY;
}
