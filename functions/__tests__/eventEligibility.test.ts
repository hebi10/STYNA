import {
  buildReviewDocumentId,
  getOrderProducts,
  isDeliveredOrderStatus,
  orderHasTargetProduct,
} from "../src/domain/purchaseEvidence";
import {
  assertEventEligibility,
} from "../src/domain/eventEligibility";

type DocumentData = Record<string, unknown>;

interface OrderFixture {
  id: string;
  data: DocumentData;
}

function createEligibilityHarness(
  orders: OrderFixture[],
  reviews: Record<string, DocumentData> = {},
) {
  const orderQuery = { kind: "orders-query" };
  const ordersCollection = {
    where: jest.fn(() => orderQuery),
  };
  const reviewsCollection = {
    doc: jest.fn((id: string) => ({ kind: "review", id })),
  };
  const transaction = {
    get: jest.fn(async (target: { kind?: string; id?: string }) => {
      if (target === orderQuery) {
        return {
          docs: orders.map((order) => ({
            id: order.id,
            data: () => order.data,
          })),
        };
      }

      if (target?.kind === "review" && target.id && reviews[target.id]) {
        return {
          exists: true,
          id: target.id,
          data: () => reviews[target.id as string],
        };
      }

      return { exists: false, id: target?.id, data: () => ({}) };
    }),
  };
  const db = {
    collection: jest.fn((name: string) => {
      if (name === "orders") return ordersCollection;
      if (name === "reviews") return reviewsCollection;
      throw new Error(`Unexpected collection: ${name}`);
    }),
  };

  return { db, orderQuery, ordersCollection, reviewsCollection, transaction };
}

const purchasedProduct = {
  productId: "target-1",
  size: "M",
  color: "black",
  quantity: 1,
};

describe("purchase evidence helpers", () => {
  test.each(["delivered", "배송완료", "purchase_confirmed", "구매확정"])(
    "accepts delivered status %s",
    (status) => expect(isDeliveredOrderStatus(status)).toBe(true),
  );

  test.each(["pending", "shipped", "cancelled", "반품", undefined])(
    "rejects non-delivered status %s",
    (status) => expect(isDeliveredOrderStatus(status)).toBe(false),
  );

  test("normalizes order products and matches only a positive-quantity target", () => {
    const order = {
      products: [
        null,
        { productId: " target-1 ", quantity: 1 },
        { productId: "target-2", quantity: 0 },
        "invalid",
      ],
    };

    expect(getOrderProducts(order)).toHaveLength(2);
    expect(orderHasTargetProduct(order, [" target-1 ", "target-1", ""])).toBe(true);
    expect(orderHasTargetProduct(order, ["target-2"])).toBe(false);
  });

  test("preserves the existing deterministic review document id", () => {
    const input = {
      orderId: "order-1",
      productId: "product-1",
      size: "M",
      color: "black",
    };

    expect(buildReviewDocumentId(input)).toBe(
      Buffer.from(JSON.stringify(["order-1", "product-1", "M", "black"]), "utf8")
        .toString("base64url"),
    );
  });
});

describe("event eligibility", () => {
  test("allows none without reading orders", async () => {
    const { db, transaction } = createEligibilityHarness([]);

    await expect(assertEventEligibility(transaction as never, db as never, {
      userId: "user-1",
      eligibilityType: "none",
      targetProducts: undefined,
    })).resolves.toEqual({ type: "none" });
    expect(transaction.get).not.toHaveBeenCalled();
  });

  test.each([
    [undefined, undefined],
    ["invalid", ["target-1"]],
    ["purchase", undefined],
    ["delivered", []],
    ["review", [" "]],
    ["none", null],
    ["none", []],
    ["none", ["target-1"]],
  ])(
    "fails closed for eligibility configuration %p with targets %p",
    async (eligibilityType, targetProducts) => {
      const { db, transaction } = createEligibilityHarness([]);

      await expect(assertEventEligibility(transaction as never, db as never, {
        userId: "user-1",
        eligibilityType,
        targetProducts,
      })).rejects.toMatchObject({ code: "event_misconfigured" });
      expect(transaction.get).not.toHaveBeenCalled();
    },
  );

  test("accepts a non-cancelled personal purchase containing a target product", async () => {
    const { db, ordersCollection, transaction } = createEligibilityHarness([
      {
        id: "order-1",
        data: { userId: "user-1", status: "pending", products: [purchasedProduct] },
      },
    ]);

    await expect(assertEventEligibility(transaction as never, db as never, {
      userId: "user-1",
      eligibilityType: "purchase",
      targetProducts: ["target-1"],
    })).resolves.toMatchObject({
      type: "purchase",
      orderId: "order-1",
      productId: "target-1",
      size: "M",
      color: "black",
    });
    expect(ordersCollection.where).toHaveBeenCalledWith("userId", "==", "user-1");
  });

  test.each([
    ["another user", { userId: "user-2", status: "pending", products: [purchasedProduct] }],
    ["a cancelled order", { userId: "user-1", status: "cancelled", products: [purchasedProduct] }],
    ["a returned order", { userId: "user-1", status: "반품", products: [purchasedProduct] }],
    ["the wrong product", {
      userId: "user-1",
      status: "pending",
      products: [{ ...purchasedProduct, productId: "other-1" }],
    }],
  ])("rejects purchase evidence from %s", async (_caseName, orderData) => {
    const { db, transaction } = createEligibilityHarness([{ id: "order-1", data: orderData }]);

    await expect(assertEventEligibility(transaction as never, db as never, {
      userId: "user-1",
      eligibilityType: "purchase",
      targetProducts: ["target-1"],
    })).rejects.toMatchObject({ code: "ineligible_purchase" });
  });

  test.each(["delivered", "배송완료", "purchase_confirmed", "구매확정"])(
    "accepts delivered evidence with status %s",
    async (status) => {
      const { db, transaction } = createEligibilityHarness([
        {
          id: "order-1",
          data: { userId: "user-1", status, products: [purchasedProduct] },
        },
      ]);

      await expect(assertEventEligibility(transaction as never, db as never, {
        userId: "user-1",
        eligibilityType: "delivered",
        targetProducts: ["target-1"],
      })).resolves.toMatchObject({ type: "delivered", orderId: "order-1" });
    },
  );

  test.each([
    ["another user", { userId: "user-2", status: "delivered", products: [purchasedProduct] }],
    ["an undelivered order", { userId: "user-1", status: "shipped", products: [purchasedProduct] }],
    ["the wrong target", {
      userId: "user-1",
      status: "delivered",
      products: [{ ...purchasedProduct, productId: "other-1" }],
    }],
  ])("rejects delivered evidence from %s", async (_caseName, orderData) => {
    const { db, transaction } = createEligibilityHarness([{ id: "order-1", data: orderData }]);

    await expect(assertEventEligibility(transaction as never, db as never, {
      userId: "user-1",
      eligibilityType: "delivered",
      targetProducts: ["target-1"],
    })).rejects.toMatchObject({ code: "ineligible_delivered" });
  });

  test("accepts a verified review for the same delivered order product and option", async () => {
    const reviewId = buildReviewDocumentId({
      orderId: "order-1",
      productId: "target-1",
      size: "M",
      color: "black",
    });
    const { db, transaction } = createEligibilityHarness([
      {
        id: "order-1",
        data: { userId: "user-1", status: "delivered", products: [purchasedProduct] },
      },
    ], {
      [reviewId]: {
        orderId: "order-1",
        productId: "target-1",
        userId: "user-1",
        size: "M",
        color: "black",
        verifiedPurchase: true,
      },
    });

    await expect(assertEventEligibility(transaction as never, db as never, {
      userId: "user-1",
      eligibilityType: "review",
      targetProducts: ["target-1"],
    })).resolves.toMatchObject({
      type: "review",
      orderId: "order-1",
      productId: "target-1",
      reviewId,
    });
  });

  test.each([
    ["another user", { userId: "user-2" }],
    ["another order", { orderId: "order-2" }],
    ["another product", { productId: "other-1" }],
    ["another size", { size: "L" }],
    ["another color", { color: "white" }],
    ["an unverified purchase", { verifiedPurchase: false }],
  ])("rejects a review from %s", async (_caseName, reviewOverride) => {
    const reviewId = buildReviewDocumentId({
      orderId: "order-1",
      productId: "target-1",
      size: "M",
      color: "black",
    });
    const { db, transaction } = createEligibilityHarness([
      {
        id: "order-1",
        data: { userId: "user-1", status: "delivered", products: [purchasedProduct] },
      },
    ], {
      [reviewId]: {
        orderId: "order-1",
        productId: "target-1",
        userId: "user-1",
        size: "M",
        color: "black",
        verifiedPurchase: true,
        ...reviewOverride,
      },
    });

    await expect(assertEventEligibility(transaction as never, db as never, {
      userId: "user-1",
      eligibilityType: "review",
      targetProducts: ["target-1"],
    })).rejects.toMatchObject({ code: "ineligible_review" });
  });
});
