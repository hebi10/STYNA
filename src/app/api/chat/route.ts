import { NextRequest, NextResponse } from 'next/server';
import { getMenuResponse, getAIFallbackResponse } from '@/shared/utils/chatResponses';

interface ChatRequest {
  message: string;
  useAI?: boolean;
  conversationHistory?: Array<{ role: string; content: unknown }>;
}

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

const MAX_MESSAGE_LENGTH = 1200;
const MAX_HISTORY_ITEMS = 10;
const MAX_HISTORY_CONTENT_LENGTH = 800;

export async function POST(request: NextRequest) {
  try {
    const payload: ChatRequest = await request.json();
    const { message, useAI = false, conversationHistory = [] } = payload;

    if (typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { error: 'Message is required.' },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: 'Message is too long.' },
        { status: 413, headers: NO_STORE_HEADERS },
      );
    }

    const upstreamUrl = getUpstreamChatApiUrl(request);
    if (upstreamUrl) {
      const upstreamResult = await requestUpstream(
        upstreamUrl,
        request,
        {
          message,
          useAI,
          conversationHistory: sanitizeConversationHistory(conversationHistory),
        },
      );
      if (upstreamResult) {
        return upstreamResult;
      }
    }

    return createFallbackResponse(message, useAI);
  } catch {
    return NextResponse.json(
      {
        error: 'Internal error.',
        response: 'Please try again or contact support.',
      },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

async function requestUpstream(
  upstreamUrl: string,
  request: NextRequest,
  payload: {
    message: string;
    useAI: boolean;
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  },
): Promise<NextResponse | null> {
  try {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    copyHeaderIfPresent(request.headers, headers, 'authorization');
    copyHeaderIfPresent(request.headers, headers, 'x-chat-session-id');

    const upstreamResponse = await fetch(upstreamUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    const upstreamText = await upstreamResponse.text();

    if (upstreamResponse.status === 429) {
      return createRateLimitResponse(upstreamResponse, upstreamText);
    }

    if (!upstreamResponse.ok) {
      return null;
    }

    const upstreamBody = parseJson(upstreamText);
    if (upstreamBody === null) {
      return null;
    }

    return NextResponse.json(upstreamBody, {
      status: upstreamResponse.status,
      headers: NO_STORE_HEADERS,
    });
  } catch {
    return null;
  }
}

function createRateLimitResponse(upstreamResponse: Response, body: string): NextResponse {
  const headers = new Headers(NO_STORE_HEADERS);
  const retryAfter = upstreamResponse.headers.get('retry-after');
  const contentType = upstreamResponse.headers.get('content-type');

  if (retryAfter) {
    headers.set('Retry-After', retryAfter);
  }
  if (contentType) {
    headers.set('Content-Type', contentType);
  }

  return new NextResponse(body, { status: 429, headers });
}

function copyHeaderIfPresent(source: Headers, destination: Headers, name: string): void {
  const value = source.get(name);
  if (value) {
    destination.set(name, value);
  }
}

function parseJson(value: string): unknown | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function createFallbackResponse(message: string, useAI: boolean): NextResponse {
  const response = useAI
    ? getAIFallbackResponse(message)
    : getMenuResponse(message);

  return NextResponse.json({ response }, { headers: NO_STORE_HEADERS });
}

function getUpstreamChatApiUrl(request: NextRequest): string | null {
  const configuredUrl = (
    process.env.CHAT_API_URL ||
    process.env.NEXT_PUBLIC_CHAT_API_URL ||
    ''
  ).trim();

  if (!configuredUrl || configuredUrl === '/api/chat') return null;

  try {
    const upstreamUrl = new URL(configuredUrl);
    const requestUrl = new URL(request.url);

    if (
      upstreamUrl.origin === requestUrl.origin &&
      normalizePathname(upstreamUrl.pathname) === normalizePathname(requestUrl.pathname)
    ) {
      return null;
    }

    return upstreamUrl.toString();
  } catch {
    return null;
  }
}

function normalizePathname(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, '');
  return normalized || '/';
}

function sanitizeConversationHistory(
  conversationHistory: ChatRequest['conversationHistory'] = [],
): Array<{ role: 'user' | 'assistant'; content: string }> {
  if (!Array.isArray(conversationHistory)) {
    return [];
  }

  return conversationHistory
    .filter((item): item is { role: 'user' | 'assistant'; content: string } =>
      (item?.role === 'user' || item?.role === 'assistant') &&
      typeof item.content === 'string' &&
      item.content.trim().length > 0,
    )
    .map(item => ({
      role: item.role,
      content: item.content.slice(0, MAX_HISTORY_CONTENT_LENGTH),
    }))
    .slice(-MAX_HISTORY_ITEMS);
}
