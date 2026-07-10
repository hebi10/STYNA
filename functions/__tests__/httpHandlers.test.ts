jest.mock("firebase-functions/v2/https", () => ({
  onRequest: (_options: unknown, handler: unknown) => handler,
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
      delete: jest.fn(() => "deleted"),
      arrayUnion: jest.fn((value: unknown) => ({ arrayUnion: value })),
    },
    Timestamp: { now: jest.fn(() => "timestamp") },
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
    delete: jest.fn(() => "deleted"),
    arrayUnion: jest.fn((value: unknown) => ({ arrayUnion: value })),
  },
}));

import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { points } from "../src/handlers/points";
import { coupon } from "../src/handlers/coupon";
import { adminUsers } from "../src/handlers/adminUsers";
import { order } from "../src/handlers/order";
import { qna } from "../src/handlers/qna";
import { event } from "../src/handlers/event";
import { AuthError, verifyAuthContext, verifyAuth, requireAdmin } from "../src/utils/auth";

type Handler = (req: {
  method: string;
  body?: Record<string, unknown>;
  headers: { authorization?: string };
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
    ["adminUsers", adminUsers as unknown as Handler],
  ])("%s sets no-store headers before returning", async (_name, handler) => {
    const response = createResponse();

    await handler({ method: "OPTIONS", headers: {} }, response);

    expect(response.set).toHaveBeenCalledWith("Cache-Control", "no-store, max-age=0");
    expect(response.set).toHaveBeenCalledWith("Pragma", "no-cache");
    expect(response.set).toHaveBeenCalledWith("Expires", "0");
  });
});

describe("points signup bonus", () => {
  beforeEach(() => {
    jest.mocked(verifyAuthContext).mockResolvedValue({
      uid: "user-1",
      token: {} as never,
      isAdmin: false,
    });
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
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

  test("rejects direct coupon issue by an authenticated non-admin user", async () => {
    const response = createResponse();
    jest.mocked(requireAdmin).mockRejectedValue(new AuthError(403, "Admin privileges are required."));

    await (coupon as unknown as Handler)({
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      body: { action: "issue", couponId: "coupon-1" },
    }, response);

    expect(requireAdmin).toHaveBeenCalledWith("Bearer user-token");
    expect(response.status).toHaveBeenCalledWith(403);
  });
});

describe("order inventory integrity", () => {
  beforeEach(() => {
    jest.mocked(verifyAuthContext).mockResolvedValue({
      uid: "user-1",
      token: {} as never,
      isAdmin: false,
    });
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  async function submitOrderWithProduct(
    productData: Record<string, unknown>,
    items = [{ productId: "product-1", size: "M", color: "black", quantity: 1 }]
  ) {
    const response = createResponse();
    const userRef = { id: "user-1", collection: jest.fn(() => ({ doc: jest.fn(() => ({ id: "history-1" })) })) };
    const productRef = { id: "product-1" };
    const users = { doc: jest.fn(() => userRef) };
    const products = { doc: jest.fn(() => productRef) };
    const orders = { doc: jest.fn(() => ({ id: "order-1" })) };
    const transaction = {
      get: jest.fn(async (ref: unknown) => {
        if (ref === userRef) {
          return { exists: true, data: () => ({ pointBalance: 0 }) };
        }
        if (ref === productRef) {
          return { exists: true, data: () => productData };
        }
        return { exists: false, data: () => ({}) };
      }),
      set: jest.fn(),
      update: jest.fn(),
    };
    const db = {
      collection: jest.fn((name: string) => ({ users, products, orders }[name] || { doc: jest.fn() })),
      runTransaction: jest.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction)),
    };
    jest.mocked(admin.firestore).mockReturnValue(db as never);

    await (order as unknown as Handler)({
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      body: {
        items,
        deliveryAddress: {
          id: "address-1",
          name: "집",
          recipient: "사용자",
          phone: "010-0000-0000",
          address: "서울시",
          detailAddress: "101호",
          zipCode: "12345",
          isDefault: true,
        },
        paymentMethod: "card",
        deliveryOption: "standard",
      },
    }, response);

    return { response, transaction };
  }

  test("deducts combined quantities for different options of one product once", async () => {
    const response = createResponse();
    const userRef = { id: "user-1", collection: jest.fn(() => ({ doc: jest.fn(() => ({ id: "history-1" })) })) };
    const productRef = { id: "product-1" };
    const orderRef = { id: "order-1" };
    const users = { doc: jest.fn(() => userRef) };
    const products = { doc: jest.fn(() => productRef) };
    const orders = { doc: jest.fn(() => orderRef) };
    const carts = { doc: jest.fn() };
    const transaction = {
      get: jest.fn(async (ref: unknown) => {
        if (ref === userRef) {
          return { exists: true, data: () => ({ pointBalance: 0 }) };
        }
        if (ref === productRef) {
          return {
            exists: true,
            data: () => ({
              name: "테스트 상품",
              stock: 10,
              price: 10000,
              status: "active",
              sizes: ["M", "L"],
              colors: ["black"],
            }),
          };
        }
        return { exists: false, data: () => ({}) };
      }),
      set: jest.fn(),
      update: jest.fn(),
    };
    const db = {
      collection: jest.fn((name: string) => ({ users, products, orders, carts }[name] || { doc: jest.fn() })),
      runTransaction: jest.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction)),
    };
    jest.mocked(admin.firestore).mockReturnValue(db as never);

    await (order as unknown as Handler)({
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      body: {
        items: [
          { productId: "product-1", size: "M", color: "black", quantity: 2 },
          { productId: "product-1", size: "L", color: "black", quantity: 3 },
        ],
        deliveryAddress: {
          id: "address-1",
          name: "집",
          recipient: "사용자",
          phone: "010-0000-0000",
          address: "서울시",
          detailAddress: "101호",
          zipCode: "12345",
          isDefault: true,
        },
        paymentMethod: "card",
        deliveryOption: "standard",
      },
    }, response);

    const productStockUpdates = transaction.update.mock.calls.filter(([ref]) => ref === productRef);
    expect(productStockUpdates).toHaveLength(1);
    expect(productStockUpdates[0][1]).toEqual(expect.objectContaining({ stock: 5 }));
    expect(response.status).toHaveBeenCalledWith(200);
  });

  test("restores combined quantities for different options of one product once", async () => {
    const response = createResponse();
    const orderRef = { id: "order-1" };
    const productRef = { id: "product-1" };
    const orders = { doc: jest.fn(() => orderRef) };
    const products = { doc: jest.fn(() => productRef) };
    const transaction = {
      get: jest.fn(async (ref: unknown) => {
        if (ref === orderRef) {
          return {
            exists: true,
            data: () => ({
              userId: "user-1",
              status: "pending",
              pointUsed: 0,
              products: [
                { productId: "product-1", size: "M", color: "black", quantity: 2 },
                { productId: "product-1", size: "L", color: "black", quantity: 3 },
              ],
            }),
          };
        }
        if (ref === productRef) {
          return { exists: true, data: () => ({ stock: 5 }) };
        }
        return { exists: false, data: () => ({}) };
      }),
      set: jest.fn(),
      update: jest.fn(),
    };
    const db = {
      collection: jest.fn((name: string) => ({ orders, products }[name] || { doc: jest.fn() })),
      runTransaction: jest.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction)),
    };
    jest.mocked(admin.firestore).mockReturnValue(db as never);

    await (order as unknown as Handler)({
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      body: { action: "cancel", orderId: "order-1" },
    }, response);

    const productRestores = transaction.update.mock.calls.filter(([ref]) => ref === productRef);
    expect(productRestores).toHaveLength(1);
    expect(productRestores[0][1]).toEqual(expect.objectContaining({
      stock: { increment: 5 },
    }));
    expect(response.status).toHaveBeenCalledWith(200);
  });

  test("rejects a combined quantity that exceeds the product stock before writing an order", async () => {
    const { response, transaction } = await submitOrderWithProduct(
      { name: "테스트 상품", stock: 4, price: 10000, status: "active", sizes: ["M", "L"], colors: ["black"] },
      [
        { productId: "product-1", size: "M", color: "black", quantity: 2 },
        { productId: "product-1", size: "L", color: "black", quantity: 3 },
      ]
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(transaction.update).not.toHaveBeenCalled();
    expect(transaction.set).not.toHaveBeenCalled();
  });

  test.each([
    ["inactive status", { name: "테스트 상품", stock: 10, price: 10000, status: "inactive", sizes: ["M"], colors: ["black"] }],
    ["undeclared size", { name: "테스트 상품", stock: 10, price: 10000, status: "active", sizes: ["S"], colors: ["black"] }],
    ["undeclared color", { name: "테스트 상품", stock: 10, price: 10000, status: "active", sizes: ["M"], colors: ["white"] }],
  ])("rejects an order with %s before writing an order", async (_caseName, productData) => {
    const { response, transaction } = await submitOrderWithProduct(productData);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(transaction.update).not.toHaveBeenCalled();
    expect(transaction.set).not.toHaveBeenCalled();
  });

  test("accepts a legacy product with no status or option declarations", async () => {
    const { response, transaction } = await submitOrderWithProduct({
      name: "기존 상품",
      stock: 10,
      price: 10000,
    });

    expect(response.status).toHaveBeenCalledWith(200);
    expect(transaction.set).toHaveBeenCalledTimes(1);
  });
});

describe("QnA secret access", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("does not accept a secret QnA password without owner or admin authentication", async () => {
    const response = createResponse();
    const qnaRef = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          userId: "owner-1",
          isSecret: true,
          password: "1234",
        }),
      }),
      update: jest.fn(),
    };
    const db = {
      collection: jest.fn(() => ({ doc: jest.fn(() => qnaRef) })),
    };
    jest.mocked(admin.firestore).mockReturnValue(db as never);

    await (qna as unknown as Handler)({
      method: "POST",
      headers: {},
      body: { qnaId: "qna-1", password: "1234" },
    }, response);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(qnaRef.update).not.toHaveBeenCalled();
  });
});

describe("event participation", () => {
  beforeEach(() => {
    jest.mocked(verifyAuth).mockResolvedValue("user-1");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("creates one participant, increments once, and issues the configured reward coupon", async () => {
    const response = createResponse();
    const eventRef = { id: "event-1" };
    const participantRef = { id: "event-1_user-1" };
    const couponRef = { id: "coupon-1" };
    const userCouponRef = { id: "user-coupon-1" };
    const events = { doc: jest.fn(() => eventRef) };
    const participants = { doc: jest.fn(() => participantRef) };
    const coupons = { doc: jest.fn(() => couponRef) };
    const userCoupons = {
      doc: jest.fn(() => userCouponRef),
      where: jest.fn(),
    };
    userCoupons.where.mockReturnValue(userCoupons);
    let hasParticipant = false;
    const transaction = {
      get: jest.fn(async (target: unknown) => {
        if (target === eventRef) {
          return {
            exists: true,
            data: () => ({
              isActive: true,
              startDate: new Date(Date.now() - 60_000),
              endDate: new Date(Date.now() + 60_000),
              participantCount: 0,
              eventType: "coupon",
              couponType: "auto",
              rewardCouponId: "coupon-1",
            }),
          };
        }
        if (target === participantRef) {
          return {
            exists: hasParticipant,
            data: () => ({ rewardCouponId: "coupon-1" }),
          };
        }
        if (target === couponRef) {
          return {
            exists: true,
            data: () => ({
              name: "이벤트 쿠폰",
              isActive: true,
              isDirectAssign: true,
              expiryDate: "2099-01-01",
              usedCount: 0,
              usageLimit: 10,
            }),
          };
        }
        return { empty: true, docs: [] };
      }),
      set: jest.fn((target: unknown) => {
        if (target === participantRef) {
          hasParticipant = true;
        }
      }),
      update: jest.fn(),
    };
    const db = {
      collection: jest.fn((name: string) => ({
        events,
        eventParticipants: participants,
        coupons,
        user_coupons: userCoupons,
      }[name] || { doc: jest.fn() })),
      runTransaction: jest.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction)),
    };
    jest.mocked(getFirestore).mockReturnValue(db as never);

    await (event as unknown as Handler)({
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      body: { eventId: "event-1" },
    }, response);

    expect(transaction.set).toHaveBeenCalledWith(participantRef, expect.objectContaining({
      eventId: "event-1",
      userId: "user-1",
    }));
    expect(transaction.update).toHaveBeenCalledWith(eventRef, expect.objectContaining({
      participantCount: { increment: 1 },
    }));
    expect(transaction.set).toHaveBeenCalledWith(userCouponRef, expect.objectContaining({
      uid: "user-1",
      couponId: "coupon-1",
    }));
    expect(response.status).toHaveBeenCalledWith(200);

    const repeatedResponse = createResponse();
    await (event as unknown as Handler)({
      method: "POST",
      headers: { authorization: "Bearer user-token" },
      body: { eventId: "event-1" },
    }, repeatedResponse);

    expect(transaction.set).toHaveBeenCalledTimes(2);
    expect(transaction.update).toHaveBeenCalledTimes(2);
    expect(repeatedResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ alreadyParticipated: true }),
    }));
  });
});
