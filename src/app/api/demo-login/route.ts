import { NextRequest, NextResponse } from 'next/server';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function POST(request: NextRequest) {
  const upstreamUrl = getUpstreamDemoLoginApiUrl(request);
  if (!upstreamUrl) {
    return NextResponse.json(
      { success: false, error: 'Demo login API upstream URL is not configured.' },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }

  const body = await request.text();
  const upstreamResponse = await fetch(upstreamUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
    cache: 'no-store',
  });

  const upstreamBody = await upstreamResponse.json().catch(() => null);
  if (!upstreamBody) {
    return NextResponse.json(
      { success: false, error: 'Demo login API upstream returned a non-JSON response.' },
      { status: upstreamResponse.status || 502, headers: NO_STORE_HEADERS },
    );
  }

  return NextResponse.json(upstreamBody, {
    status: upstreamResponse.status,
    headers: NO_STORE_HEADERS,
  });
}

function getUpstreamDemoLoginApiUrl(request: NextRequest): string | null {
  const configuredUrl = (process.env.DEMO_LOGIN_FUNCTION_URL || '').trim();

  if (configuredUrl) {
    try {
      const upstreamUrl = new URL(configuredUrl);
      const requestUrl = new URL(request.url);
      if (upstreamUrl.origin === requestUrl.origin && upstreamUrl.pathname === requestUrl.pathname) {
        return null;
      }
      return upstreamUrl.toString();
    } catch {
      return null;
    }
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  if (!projectId) {
    return null;
  }

  return `https://us-central1-${projectId}.cloudfunctions.net/demoLogin`;
}
