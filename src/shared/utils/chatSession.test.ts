/** @jest-environment node */

const VALID_STORED_ID = "123e4567-e89b-12d3-a456-426614174000";

interface StorageDouble {
  getItem: jest.Mock;
  setItem: jest.Mock;
}

function installWindow(storage: StorageDouble): void {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: storage },
  });
}

function installCrypto(randomUUID: () => string): void {
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: { randomUUID },
  });
}

async function loadChatSessionModule() {
  jest.resetModules();
  return import("./chatSession");
}

describe("chat session id", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "crypto");
    jest.restoreAllMocks();
  });

  test("reuses a valid browser session id from localStorage", async () => {
    const storage = {
      getItem: jest.fn(() => VALID_STORED_ID),
      setItem: jest.fn(),
    };
    installWindow(storage);
    installCrypto(jest.fn(() => "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"));
    const { getChatSessionId } = await loadChatSessionModule();

    expect(getChatSessionId()).toBe(VALID_STORED_ID);
    expect(getChatSessionId()).toBe(VALID_STORED_ID);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  test("creates one header-safe id and persists it for later calls", async () => {
    const storage = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(),
    };
    const generatedId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    installWindow(storage);
    installCrypto(jest.fn(() => generatedId));
    const { getChatSessionId, isValidChatSessionId } = await loadChatSessionModule();

    expect(getChatSessionId()).toBe(generatedId);
    expect(getChatSessionId()).toBe(generatedId);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(storage.setItem).toHaveBeenCalledWith("styna.chat.session-id", generatedId);
    expect(isValidChatSessionId(generatedId)).toBe(true);
  });

  test("replaces a stored value that is unsafe for an HTTP header", async () => {
    const storage = {
      getItem: jest.fn(() => "raw\r\nInjected: header"),
      setItem: jest.fn(),
    };
    const generatedId = "ffffffff-eeee-4ddd-8ccc-bbbbbbbbbbbb";
    installWindow(storage);
    installCrypto(jest.fn(() => generatedId));
    const { getChatSessionId } = await loadChatSessionModule();

    expect(getChatSessionId()).toBe(generatedId);
    expect(storage.setItem).toHaveBeenCalledWith("styna.chat.session-id", generatedId);
  });

  test("keeps an in-memory id stable when SSR has no browser storage", async () => {
    installCrypto(jest.fn(() => VALID_STORED_ID));
    const { getChatSessionId } = await loadChatSessionModule();

    expect(getChatSessionId()).toBe(VALID_STORED_ID);
    expect(getChatSessionId()).toBe(VALID_STORED_ID);
  });

  test("falls back safely when storage and crypto both throw", async () => {
    const storage = {
      getItem: jest.fn(() => { throw new Error("storage blocked"); }),
      setItem: jest.fn(() => { throw new Error("storage blocked"); }),
    };
    installWindow(storage);
    installCrypto(jest.fn(() => { throw new Error("crypto blocked"); }));
    const { getChatSessionId, isValidChatSessionId } = await loadChatSessionModule();

    const first = getChatSessionId();
    const second = getChatSessionId();

    expect(second).toBe(first);
    expect(isValidChatSessionId(first)).toBe(true);
    expect(first.length).toBeGreaterThanOrEqual(20);
    expect(first.length).toBeLessThanOrEqual(128);
  });

  test.each([
    ["too-short", false],
    ["a".repeat(129), false],
    ["valid_session-id.1234567890", true],
    ["invalid session id 123456", false],
    ["invalid/session/id/123456", false],
  ])("validates header-safe characters and length for %s", async (value, expected) => {
    const { isValidChatSessionId } = await loadChatSessionModule();

    expect(isValidChatSessionId(value)).toBe(expected);
  });
});
