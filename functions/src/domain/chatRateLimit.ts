import { createHmac } from "node:crypto";
import type {
  DocumentSnapshot,
  Firestore,
} from "firebase-admin/firestore";

const CHAT_RATE_LIMIT_COLLECTION = "chatRateLimits";
const MINUTE_WINDOW_MS = 60_000;
const DAY_WINDOW_MS = 24 * 60 * 60_000;
const MINUTE_LIMIT = 10;
const DAY_LIMIT = 100;
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;
const COUNTER_FIELDS = new Set([
  "minuteWindowStartMs",
  "minuteCount",
  "dayWindowStartMs",
  "dayCount",
  "updatedAtMs",
]);

export interface ChatRateLimitSubject {
  principalHash: string;
  networkHash: string;
}

export interface ChatRateLimitDecision {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export interface CreateChatRateLimitSubjectInput {
  salt: string;
  uid?: string;
  sessionId?: string;
  network: string;
}

interface ChatRateLimitCounter {
  minuteWindowStartMs: number;
  minuteCount: number;
  dayWindowStartMs: number;
  dayCount: number;
  updatedAtMs: number;
}

export function createChatRateLimitSubject(
  input: CreateChatRateLimitSubjectInput,
): ChatRateLimitSubject {
  const salt = input.salt.trim();
  const uid = input.uid?.trim();
  const sessionId = input.sessionId?.trim();
  const network = input.network.trim();

  if (!salt) {
    throw new Error("Chat rate-limit salt is required.");
  }
  if ((!uid && !sessionId) || (uid && sessionId)) {
    throw new Error("Exactly one chat rate-limit principal is required.");
  }
  if (!network) {
    throw new Error("Chat rate-limit network is required.");
  }

  const principalValue = uid
    ? `principal:user:${uid}`
    : `principal:session:${sessionId}`;

  return {
    principalHash: hashIdentifier(salt, principalValue),
    networkHash: hashIdentifier(salt, `network:${network}`),
  };
}

export async function consumeChatRateLimit(
  firestore: Firestore,
  subject: ChatRateLimitSubject,
  nowMs = Date.now(),
): Promise<ChatRateLimitDecision> {
  assertHash(subject.principalHash);
  assertHash(subject.networkHash);

  const minuteWindowStartMs = windowStart(nowMs, MINUTE_WINDOW_MS);
  const dayWindowStartMs = windowStart(nowMs, DAY_WINDOW_MS);
  const collection = firestore.collection(CHAT_RATE_LIMIT_COLLECTION);
  const principalReference = collection.doc(`principal-${subject.principalHash}`);
  const networkReference = collection.doc(`network-${subject.networkHash}`);

  return firestore.runTransaction(async transaction => {
    const [principalSnapshot, networkSnapshot] = await transaction.getAll(
      principalReference,
      networkReference,
    );
    const principalCounter = readCounter(
      principalSnapshot,
      minuteWindowStartMs,
      dayWindowStartMs,
      nowMs,
    );
    const networkCounter = readCounter(
      networkSnapshot,
      minuteWindowStartMs,
      dayWindowStartMs,
      nowMs,
    );
    const retryAfterSeconds = getRetryAfterSeconds(
      [principalCounter, networkCounter],
      nowMs,
    );

    if (retryAfterSeconds !== undefined) {
      return { allowed: false, retryAfterSeconds };
    }

    transaction.set(principalReference, incrementCounter(principalCounter, nowMs));
    transaction.set(networkReference, incrementCounter(networkCounter, nowMs));
    return { allowed: true };
  });
}

function hashIdentifier(salt: string, value: string): string {
  return createHmac("sha256", salt).update(value).digest("hex");
}

function assertHash(value: string): void {
  if (!SHA256_HEX_PATTERN.test(value)) {
    throw new Error("Invalid chat rate-limit hash.");
  }
}

function windowStart(nowMs: number, durationMs: number): number {
  return Math.floor(nowMs / durationMs) * durationMs;
}

function readCounter(
  snapshot: DocumentSnapshot,
  minuteWindowStartMs: number,
  dayWindowStartMs: number,
  nowMs: number,
): ChatRateLimitCounter {
  if (!snapshot.exists) {
    return {
      minuteWindowStartMs,
      minuteCount: 0,
      dayWindowStartMs,
      dayCount: 0,
      updatedAtMs: 0,
    };
  }

  const data = snapshot.data();
  if (!isValidStoredCounter(data, minuteWindowStartMs, dayWindowStartMs, nowMs)) {
    throw new Error("Invalid chat rate-limit counter document.");
  }
  const sameMinute = data.minuteWindowStartMs === minuteWindowStartMs;
  const sameDay = data.dayWindowStartMs === dayWindowStartMs;

  return {
    minuteWindowStartMs,
    minuteCount: sameMinute ? data.minuteCount : 0,
    dayWindowStartMs,
    dayCount: sameDay ? data.dayCount : 0,
    updatedAtMs: data.updatedAtMs,
  };
}

function isValidStoredCounter(
  value: unknown,
  currentMinuteWindowStartMs: number,
  currentDayWindowStartMs: number,
  nowMs: number,
): value is ChatRateLimitCounter {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const fields = Object.keys(value);
  if (fields.length !== COUNTER_FIELDS.size || fields.some(field => !COUNTER_FIELDS.has(field))) {
    return false;
  }

  const counter = value as Partial<ChatRateLimitCounter>;
  if (!(isPositiveSafeInteger(counter.minuteWindowStartMs) &&
    isPositiveSafeInteger(counter.minuteCount) &&
    isPositiveSafeInteger(counter.dayWindowStartMs) &&
    isPositiveSafeInteger(counter.dayCount) &&
    isPositiveSafeInteger(counter.updatedAtMs))) {
    return false;
  }

  return counter.minuteCount > 0 &&
    counter.dayCount >= counter.minuteCount &&
    counter.minuteWindowStartMs % MINUTE_WINDOW_MS === 0 &&
    counter.dayWindowStartMs % DAY_WINDOW_MS === 0 &&
    counter.minuteWindowStartMs >= counter.dayWindowStartMs &&
    counter.minuteWindowStartMs < counter.dayWindowStartMs + DAY_WINDOW_MS &&
    counter.minuteWindowStartMs <= currentMinuteWindowStartMs &&
    counter.dayWindowStartMs <= currentDayWindowStartMs &&
    counter.updatedAtMs >= counter.minuteWindowStartMs &&
    counter.updatedAtMs < counter.minuteWindowStartMs + MINUTE_WINDOW_MS &&
    counter.updatedAtMs >= counter.dayWindowStartMs &&
    counter.updatedAtMs < counter.dayWindowStartMs + DAY_WINDOW_MS &&
    counter.updatedAtMs <= nowMs;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function incrementCounter(
  counter: ChatRateLimitCounter,
  nowMs: number,
): ChatRateLimitCounter {
  return {
    ...counter,
    minuteCount: counter.minuteCount + 1,
    dayCount: counter.dayCount + 1,
    updatedAtMs: nowMs,
  };
}

function getRetryAfterSeconds(
  counters: ChatRateLimitCounter[],
  nowMs: number,
): number | undefined {
  const violatedWindowEndTimes: number[] = [];

  counters.forEach(counter => {
    if (counter.minuteCount >= MINUTE_LIMIT) {
      violatedWindowEndTimes.push(counter.minuteWindowStartMs + MINUTE_WINDOW_MS);
    }
    if (counter.dayCount >= DAY_LIMIT) {
      violatedWindowEndTimes.push(counter.dayWindowStartMs + DAY_WINDOW_MS);
    }
  });

  if (violatedWindowEndTimes.length === 0) {
    return undefined;
  }

  const latestWindowEndMs = Math.max(...violatedWindowEndTimes);
  return Math.max(1, Math.ceil((latestWindowEndMs - nowMs) / 1000));
}
