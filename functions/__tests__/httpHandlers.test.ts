jest.mock("firebase-functions/v2/https", () => ({
  onRequest: (_options: unknown, handler: unknown) => handler,
}));

jest.mock("firebase-functions/params", () => ({
  defineSecret: jest.fn(() => ({
    value: jest.fn(() => "test-secret"),
  })),
}));

jest.mock("../src/utils/auth", () => ({
  verifyAuthContext: jest.fn(),
  verifyAuth: jest.fn(),
  requireAdmin: jest.fn(),
  AuthError: class AuthError extends Error {
    constructor(public statusCode: number, message: string) {
      super(message);
    }
  },
}));

jest.mock("firebase-admin", () => {
  const firestore = jest.fn();
  Object.assign(firestore, {
    FieldValue: {
      serverTimestamp: jest.fn(() => "server-time"),
      increment: jest.fn((value: number) => ({ increment: value })),
    },
  });

  return {
    firestore,
    auth: jest.fn(),
  };
});

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: jest.fn(),
  FieldValue: {
    serverTimestamp: jest.fn(() => "server-time"),
    increment: jest.fn((value: number) => ({ increment: value })),
  },
}));

import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { points } from "../src/handlers/points";
import { coupon } from "../src/handlers/coupon";
import { chat } from "../src/handlers/chat";
import { adminUsers } from "../src/handlers/adminUsers";
import { verifyAuthContext, verifyAuth, requireAdmin } from "../src/utils/auth";

type Handler = (req: {
  method: string;
  body?: Record<string, unknown>;
  headers: Record<string, string | undefined>;
}, res: MockResponse) => Promise<void>;

interface MockResponse {
  set: jest.Mock;
  status: jest.Mock;
  json: jest.Mock;
  send: jest.Mock;
}

function createResponse(): MockResponse {
  const response: MockResponse = {
    set: jest.fn(),
    status: jest.fn(),
    json: jest.fn(),
    send: jest.fn(),
  };
  response.status.mockReturnValue(response);
  return response;
}

describe("sensitive function cache headers", () => {
  test.each([
    ["points", points as unknown as Handler],
    ["coupon", coupon as unknown as Handler],
    ["chat", chat as unknown as Handler],
    ["adminUsers", adminUsers as unknown as Handler],
  ])("%s sets no-store headers before returning", async (_name, handler) => {
    const response = createResponse();

    await handler({ method: "OPTIONS", headers: {} }, response);

    expect(response.set).toHaveBeenCalledWith("Cache-Control", "no-store, max-age=0");
    expect(response.set).toHaveBeenCalledWith("Pragma", "no-cache");
    expect(response.set).toHaveBeenCalledWith("Expires", "0");
  });
});

describe("chat AI guard", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [{ message: { content: "AI response" } }],
      }),
    }) as never;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("rate limits repeated AI requests from the same client", async () => {
    const requests = Array.from({ length: 21 }, () => createResponse());

    for (const response of requests) {
      await (chat as unknown as Handler)({
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.10" } as never,
        body: { message: "배송 문의", useAI: true },
      }, response);
    }

    expect(requests[20].status).toHaveBeenCalledWith(429);
  });
});

describe("points signup bonus", () => {
  beforeEach(() => {
    jest.mocked(verifyAuthContext).mockResolvedValue({
      uid: "user-1",
      token: {} as never,
      isAdmin: false,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("grants signup bonus once through a transaction", async () => {
    const response = createResponse();
    const historyDocRef = {};
    const userRef = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => historyDocRef),
      })),
    };
    const transaction = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({ pointBalance: 0 }),
      }),
      update: jest.fn(),
      set: jest.fn(),
    };
    const db = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => userRef),
      })),
      runTransaction: jest.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction)),
    };
    jest.mocked(admin.firestore).mockReturnValue(db as never);

    await (points as unknown as Handler)({
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      body: { action: "signupBonus" },
    }, response);

    expect(db.runTransaction).toHaveBeenCalledTimes(1);
    expect(transaction.update).toHaveBeenCalledWith(userRef, expect.objectContaining({
      pointBalance: 5000,
      signupBonusGrantedAt: "server-time",
    }));
    expect(transaction.set).toHaveBeenCalledWith(historyDocRef, expect.objectContaining({
      type: "earn",
      amount: 5000,
      description: "신규 회원가입 적립",
      balanceAfter: 5000,
    }));
  });
});

describe("coupon issuance", () => {
  beforeEach(() => {
    jest.mocked(verifyAuth).mockResolvedValue("user-1");
    jest.mocked(requireAdmin).mockResolvedValue({
      uid: "admin-1",
      token: {} as never,
      isAdmin: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test.each([
    ["issue", { couponId: "coupon-1" }],
    ["register", { couponCode: "WELCOME" }],
  ])("%s runs duplicate check and usedCount update in a transaction", async (action, payload) => {
    const response = createResponse();
    const couponRef = { id: "coupon-1" };
    const userCouponRef = { id: "user-coupon-1" };
    const couponsCollection: { doc: jest.Mock; where: jest.Mock } = {
      doc: jest.fn(() => couponRef),
      where: jest.fn(),
    };
    couponsCollection.where.mockReturnValue(couponsCollection);
    const userCouponsCollection: { doc: jest.Mock; where: jest.Mock } = {
      doc: jest.fn(() => userCouponRef),
      where: jest.fn(),
    };
    userCouponsCollection.where.mockReturnValue(userCouponsCollection);
    const db = {
      collection: jest.fn((name: string) => (name === "coupons" ? couponsCollection : userCouponsCollection)),
      runTransaction: jest.fn(async (callback: (tx: {
        get: jest.Mock;
        set: jest.Mock;
        update: jest.Mock;
      }) => unknown) => callback({
        get: jest
          .fn()
          .mockResolvedValueOnce(action === "register"
            ? {
                empty: false,
                docs: [{ id: "coupon-1", ref: couponRef, data: () => ({
                  name: "Welcome",
                  couponCode: "WELCOME",
                  isActive: true,
                  isDirectAssign: false,
                  expiryDate: "2099-01-01",
                  usedCount: 0,
                  usageLimit: 10,
                }) }],
              }
            : {
                exists: true,
                ref: couponRef,
                data: () => ({
                  name: "Welcome",
                  isActive: true,
                  isDirectAssign: true,
                  expiryDate: "2099-01-01",
                  usedCount: 0,
                  usageLimit: 10,
                }),
              })
          .mockResolvedValueOnce({ empty: true }),
        set: jest.fn(),
        update: jest.fn(),
      })),
    };
    jest.mocked(getFirestore).mockReturnValue(db as never);

    await (coupon as unknown as Handler)({
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      body: { action, ...payload },
    }, response);

    expect(db.runTransaction).toHaveBeenCalledTimes(1);
    expect(response.status).toHaveBeenCalledWith(200);
  });
});
