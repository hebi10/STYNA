const CHAT_SESSION_STORAGE_KEY = 'styna.chat.session-id';
const CHAT_SESSION_PATTERN = /^[A-Za-z0-9._-]{20,128}$/;

let memorySessionId: string | undefined;

export function isValidChatSessionId(value: unknown): value is string {
  return typeof value === 'string' && CHAT_SESSION_PATTERN.test(value);
}

export function getChatSessionId(): string {
  if (memorySessionId) {
    return memorySessionId;
  }

  const storage = getBrowserStorage();
  if (storage) {
    try {
      const storedId = storage.getItem(CHAT_SESSION_STORAGE_KEY);
      if (isValidChatSessionId(storedId)) {
        memorySessionId = storedId;
        return storedId;
      }
    } catch {
      // Storage access can be blocked by privacy settings; memory fallback stays available.
    }
  }

  memorySessionId = createSessionId();
  if (storage) {
    try {
      storage.setItem(CHAT_SESSION_STORAGE_KEY, memorySessionId);
    } catch {
      // A stable in-memory value is enough for the current page lifetime.
    }
  }

  return memorySessionId;
}

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function createSessionId(): string {
  try {
    const generatedId = globalThis.crypto?.randomUUID();
    if (isValidChatSessionId(generatedId)) {
      return generatedId;
    }
  } catch {
    // Continue with a header-safe in-memory fallback.
  }

  const fallbackEntropy = [
    Date.now().toString(36),
    Math.random().toString(36).slice(2),
    Math.random().toString(36).slice(2),
  ].join('-');

  return `fallback-${fallbackEntropy}`.slice(0, 128).padEnd(32, '0');
}
