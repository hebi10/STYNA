/** @jest-environment node */

import { createHmac } from "node:crypto";
import {
  createChatRateLimitSubject,
  consumeChatRateLimit,
  type ChatRateLimitSubject,
} from "../src/domain/chatRateLimit";

type CounterData = Record<string, unknown>;

interface FakeDocumentReference {
  id: string;
  path: string;
}

class FakeFirestore {
  readonly documents = new Map<string, CounterData>();
  readonly operations: string[] = [];

  collection(name: string) {
    return {
      doc: (id: string): FakeDocumentReference => ({ id, path: `${name}/${id}` }),
    };
  }

  async runTransaction<T>(
    callback: (transaction: {
      getAll: (...references: FakeDocumentReference[]) => Promise<Array<{
        exists: boolean;
        data: () => CounterData | undefined;
      }>>;
      set: (reference: FakeDocumentReference, data: CounterData) => void;
    }) => Promise<T>,
  ): Promise<T> {
    const pendingWrites: Array<{ reference: FakeDocumentReference; data: CounterData }> = [];
    const result = await callback({
      getAll: async (...references) => {
        references.forEach(reference => this.operations.push(`get:${reference.id}`));
        return references.map(reference => {
          const data = this.documents.get(reference.path);
          return {
            exists: data !== undefined,
            data: () => data,
          };
        });
      },
      set: (reference, data) => {
        this.operations.push(`set:${reference.id}`);
        pendingWrites.push({ reference, data });
      },
    });

    pendingWrites.forEach(({ reference, data }) => {
      this.documents.set(reference.path, structuredClone(data));
    });
    return result;
  }
}

const SALT = "test-rate-limit-salt";
const DAY_START = Date.UTC(2026, 0, 1);
const DAY_MS = 24 * 60 * 60_000;

function createSubject(
  principal: { uid?: string; sessionId?: string },
  network = "203.0.113.10",
): ChatRateLimitSubject {
  return createChatRateLimitSubject({
    salt: SALT,
    ...principal,
    network,
  });
}

describe("chat rate-limit subject", () => {
  test("uses deterministic HMAC-SHA256 hashes without returning raw identifiers", () => {
    const subject = createSubject({ uid: "raw-user-123" }, "198.51.100.24");
    const expectedPrincipal = createHmac("sha256", SALT)
      .update("principal:user:raw-user-123")
      .digest("hex");
    const expectedNetwork = createHmac("sha256", SALT)
      .update("network:198.51.100.24")
      .digest("hex");

    expect(subject).toEqual({
      principalHash: expectedPrincipal,
      networkHash: expectedNetwork,
    });
    expect(JSON.stringify(subject)).not.toContain("raw-user-123");
    expect(JSON.stringify(subject)).not.toContain("198.51.100.24");
  });

  test("separates authenticated users from anonymous sessions", () => {
    const authenticated = createSubject({ uid: "same-value" });
    const anonymous = createSubject({ sessionId: "same-value" });

    expect(authenticated.principalHash).not.toBe(anonymous.principalHash);
  });

  test("rejects missing or ambiguous principal input", () => {
    expect(() => createChatRateLimitSubject({ salt: SALT, network: "unknown" }))
      .toThrow("principal");
    expect(() => createChatRateLimitSubject({
      salt: SALT,
      uid: "user-1",
      sessionId: "session-1",
      network: "unknown",
    })).toThrow("principal");
  });
});

describe("chat rate-limit transaction", () => {
  test("rejects malformed hashes before building Firestore document paths", async () => {
    const firestore = new FakeFirestore();

    await expect(consumeChatRateLimit(firestore as never, {
      principalHash: "../raw-user",
      networkHash: "not-a-hash",
    }, DAY_START)).rejects.toThrow("hash");
    expect(firestore.operations).toEqual([]);
  });

  test("rejects the eleventh request in one minute and does not increment either counter", async () => {
    const firestore = new FakeFirestore();
    const subject = createSubject({ uid: "user-minute" });

    for (let index = 0; index < 10; index += 1) {
      await expect(consumeChatRateLimit(firestore as never, subject, DAY_START + index))
        .resolves.toEqual({ allowed: true });
    }

    const beforeDeniedRequest = structuredClone([...firestore.documents.entries()]);
    await expect(consumeChatRateLimit(firestore as never, subject, DAY_START + 10))
      .resolves.toEqual({ allowed: false, retryAfterSeconds: 60 });
    expect([...firestore.documents.entries()]).toEqual(beforeDeniedRequest);
  });

  test("rejects the 101st request in one day across separate minute windows", async () => {
    const firestore = new FakeFirestore();
    const subject = createSubject({ uid: "user-day" });

    for (let index = 0; index < 100; index += 1) {
      await expect(consumeChatRateLimit(
        firestore as never,
        subject,
        DAY_START + index * 60_000,
      )).resolves.toEqual({ allowed: true });
    }

    await expect(consumeChatRateLimit(
      firestore as never,
      subject,
      DAY_START + 100 * 60_000,
    )).resolves.toEqual({ allowed: false, retryAfterSeconds: 80_400 });
  });

  test("a user cannot evade the principal limit by changing networks", async () => {
    const firestore = new FakeFirestore();
    const firstNetwork = createSubject({ uid: "user-network-rotation" }, "203.0.113.1");
    const secondNetwork = createSubject({ uid: "user-network-rotation" }, "203.0.113.2");

    for (let index = 0; index < 10; index += 1) {
      await consumeChatRateLimit(firestore as never, firstNetwork, DAY_START + index);
    }

    await expect(consumeChatRateLimit(firestore as never, secondNetwork, DAY_START + 10))
      .resolves.toEqual({ allowed: false, retryAfterSeconds: 60 });
    expect(firestore.documents.has(`chatRateLimits/network-${secondNetwork.networkHash}`)).toBe(false);
  });

  test("anonymous users cannot evade the network limit by rotating sessions", async () => {
    const firestore = new FakeFirestore();
    const network = "192.0.2.44";

    for (let index = 0; index < 10; index += 1) {
      const subject = createSubject({ sessionId: `session-${index}-abcdefghijk` }, network);
      await consumeChatRateLimit(firestore as never, subject, DAY_START + index);
    }

    const rotated = createSubject({ sessionId: "session-rotated-abcdefgh" }, network);
    await expect(consumeChatRateLimit(firestore as never, rotated, DAY_START + 10))
      .resolves.toEqual({ allowed: false, retryAfterSeconds: 60 });
    expect(firestore.documents.has(`chatRateLimits/principal-${rotated.principalHash}`)).toBe(false);
  });

  test("reads both counters before writing either and stores hashes or aggregates only", async () => {
    const firestore = new FakeFirestore();
    const subject = createSubject({ sessionId: "session-storage-check-123" }, "198.51.100.99");

    await consumeChatRateLimit(firestore as never, subject, DAY_START);

    expect(firestore.operations).toEqual([
      `get:principal-${subject.principalHash}`,
      `get:network-${subject.networkHash}`,
      `set:principal-${subject.principalHash}`,
      `set:network-${subject.networkHash}`,
    ]);

    const serializedDocuments = JSON.stringify([...firestore.documents.entries()]);
    expect(serializedDocuments).not.toContain("session-storage-check-123");
    expect(serializedDocuments).not.toContain("198.51.100.99");
    expect(serializedDocuments).toContain(subject.principalHash);
    expect(serializedDocuments).toContain(subject.networkHash);
  });

  test("uses the longest violated window for Retry-After", async () => {
    const firestore = new FakeFirestore();
    const subject = createSubject({ uid: "user-combined-window" });
    const now = DAY_START + 60_000;
    const principalPath = `chatRateLimits/principal-${subject.principalHash}`;
    const networkPath = `chatRateLimits/network-${subject.networkHash}`;
    const saturatedCounter = {
      minuteWindowStartMs: now,
      minuteCount: 10,
      dayWindowStartMs: DAY_START,
      dayCount: 100,
      updatedAtMs: now,
    };
    firestore.documents.set(principalPath, saturatedCounter);
    firestore.documents.set(networkPath, saturatedCounter);

    await expect(consumeChatRateLimit(firestore as never, subject, now))
      .resolves.toEqual({ allowed: false, retryAfterSeconds: 86_340 });
  });

  test("fails closed without writes when an existing counter document is malformed", async () => {
    const firestore = new FakeFirestore();
    const subject = createSubject({ uid: "user-corrupted-counter" });
    const principalPath = `chatRateLimits/principal-${subject.principalHash}`;
    const networkPath = `chatRateLimits/network-${subject.networkHash}`;
    const validCounter = {
      minuteWindowStartMs: DAY_START,
      minuteCount: 1,
      dayWindowStartMs: DAY_START,
      dayCount: 1,
      updatedAtMs: DAY_START,
    };
    firestore.documents.set(principalPath, {
      ...validCounter,
      minuteCount: "corrupted",
    });
    firestore.documents.set(networkPath, validCounter);
    const beforeRequest = structuredClone([...firestore.documents.entries()]);

    await expect(consumeChatRateLimit(firestore as never, subject, DAY_START + 1_000))
      .rejects.toThrow("counter");
    expect([...firestore.documents.entries()]).toEqual(beforeRequest);
    expect(firestore.operations.every(operation => operation.startsWith("get:"))).toBe(true);
  });

  test.each([
    ["future", {
      minuteWindowStartMs: DAY_START + 60_000,
      minuteCount: 1,
      dayWindowStartMs: DAY_START,
      dayCount: 1,
      updatedAtMs: DAY_START + 60_000,
    }],
    ["misaligned", {
      minuteWindowStartMs: DAY_START + 1,
      minuteCount: 1,
      dayWindowStartMs: DAY_START,
      dayCount: 1,
      updatedAtMs: DAY_START + 1,
    }],
    ["unexpected-field", {
      minuteWindowStartMs: DAY_START,
      minuteCount: 1,
      dayWindowStartMs: DAY_START,
      dayCount: 1,
      updatedAtMs: DAY_START,
      rawIdentifier: "must-not-be-stored",
    }],
  ])("fails closed for a semantically invalid %s counter window", async (_name, invalidCounter) => {
    const firestore = new FakeFirestore();
    const subject = createSubject({ uid: `user-${_name}-counter` });
    firestore.documents.set(
      `chatRateLimits/principal-${subject.principalHash}`,
      invalidCounter,
    );
    firestore.documents.set(
      `chatRateLimits/network-${subject.networkHash}`,
      invalidCounter,
    );
    const beforeRequest = structuredClone([...firestore.documents.entries()]);

    await expect(consumeChatRateLimit(firestore as never, subject, DAY_START + 1_000))
      .rejects.toThrow("counter");
    expect([...firestore.documents.entries()]).toEqual(beforeRequest);
    expect(firestore.operations.every(operation => operation.startsWith("get:"))).toBe(true);
  });

  test("allows a valid past minute window to roll over while preserving the daily count", async () => {
    const firestore = new FakeFirestore();
    const subject = createSubject({ uid: "user-valid-rollover" });
    const previousMinuteStart = DAY_START + 60_000;
    const validPastCounter = {
      minuteWindowStartMs: previousMinuteStart,
      minuteCount: 10,
      dayWindowStartMs: DAY_START,
      dayCount: 20,
      updatedAtMs: previousMinuteStart + 30_000,
    };
    firestore.documents.set(
      `chatRateLimits/principal-${subject.principalHash}`,
      validPastCounter,
    );
    firestore.documents.set(
      `chatRateLimits/network-${subject.networkHash}`,
      validPastCounter,
    );

    await expect(consumeChatRateLimit(
      firestore as never,
      subject,
      DAY_START + 2 * 60_000,
    )).resolves.toEqual({ allowed: true });

    expect(firestore.documents.get(`chatRateLimits/principal-${subject.principalHash}`))
      .toEqual({
        minuteWindowStartMs: DAY_START + 2 * 60_000,
        minuteCount: 1,
        dayWindowStartMs: DAY_START,
        dayCount: 21,
        updatedAtMs: DAY_START + 2 * 60_000,
      });
  });

  test.each([
    ["zero timestamps", {
      minuteWindowStartMs: 0,
      minuteCount: 10,
      dayWindowStartMs: 0,
      dayCount: 100,
      updatedAtMs: 0,
    }],
    ["zero counts", {
      minuteWindowStartMs: DAY_START,
      minuteCount: 0,
      dayWindowStartMs: DAY_START,
      dayCount: 0,
      updatedAtMs: DAY_START,
    }],
    ["daily count below minute count", {
      minuteWindowStartMs: DAY_START,
      minuteCount: 5,
      dayWindowStartMs: DAY_START,
      dayCount: 4,
      updatedAtMs: DAY_START,
    }],
    ["minute outside its recorded day", {
      minuteWindowStartMs: DAY_START,
      minuteCount: 1,
      dayWindowStartMs: DAY_START - DAY_MS,
      dayCount: 1,
      updatedAtMs: DAY_START,
    }],
    ["zero updated time for a current window", {
      minuteWindowStartMs: DAY_START,
      minuteCount: 1,
      dayWindowStartMs: DAY_START,
      dayCount: 1,
      updatedAtMs: 0,
    }],
    ["updated time outside its minute", {
      minuteWindowStartMs: DAY_START,
      minuteCount: 1,
      dayWindowStartMs: DAY_START,
      dayCount: 1,
      updatedAtMs: DAY_START + 60_000,
    }],
  ])("fails closed for impossible counter relation: %s", async (_name, invalidCounter) => {
    const firestore = new FakeFirestore();
    const subject = createSubject({ uid: `user-impossible-${_name}` });
    firestore.documents.set(
      `chatRateLimits/principal-${subject.principalHash}`,
      invalidCounter,
    );
    firestore.documents.set(
      `chatRateLimits/network-${subject.networkHash}`,
      invalidCounter,
    );

    await expect(consumeChatRateLimit(
      firestore as never,
      subject,
      DAY_START + 2 * 60_000,
    )).rejects.toThrow("counter");
    expect(firestore.operations.every(operation => operation.startsWith("get:"))).toBe(true);
  });

  test("allows a valid past day window to roll over both counters", async () => {
    const firestore = new FakeFirestore();
    const subject = createSubject({ uid: "user-valid-day-rollover" });
    const previousDayStart = DAY_START - DAY_MS;
    const previousMinuteStart = DAY_START - 60_000;
    const validPastCounter = {
      minuteWindowStartMs: previousMinuteStart,
      minuteCount: 10,
      dayWindowStartMs: previousDayStart,
      dayCount: 100,
      updatedAtMs: previousMinuteStart + 30_000,
    };
    firestore.documents.set(
      `chatRateLimits/principal-${subject.principalHash}`,
      validPastCounter,
    );
    firestore.documents.set(
      `chatRateLimits/network-${subject.networkHash}`,
      validPastCounter,
    );

    await expect(consumeChatRateLimit(
      firestore as never,
      subject,
      DAY_START,
    )).resolves.toEqual({ allowed: true });
    expect(firestore.documents.get(`chatRateLimits/principal-${subject.principalHash}`))
      .toEqual({
        minuteWindowStartMs: DAY_START,
        minuteCount: 1,
        dayWindowStartMs: DAY_START,
        dayCount: 1,
        updatedAtMs: DAY_START,
      });
  });
});
