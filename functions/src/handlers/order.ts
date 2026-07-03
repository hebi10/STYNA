import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import type { Response } from "express";
import {
  calculateCouponDiscount,
  calculateDeliveryFee,
  calculateDiscountedUnitPrice,
  mapCartTotal,
  normalizeDeliveryOption,
  normalizeItems,
  normalizePaymentMethod,
  parseDate,
  parseDeliveryAddress,
  parseItems,
  toNonNegativeInteger,
  toNumber,
  toStringValue,
  toTodayString,
} from "../domain/orderDomain";
import { AuthContext, AuthError, verifyAuthContext } from "../utils/auth";
import { SENSITIVE_FUNCTION_CORS } from "../utils/http";

interface RawCreateOrderRequest {
  action?: unknown;
  clientOrderId?: unknown;
  items?: unknown;
  deliveryAddress?: unknown;
  paymentMethod?: unknown;
  deliveryOption?: unknown;
  selectedCoupon?: unknown;
  requestedPointAmount?: unknown;
}

interface RawUpdateOrderStatusRequest {
  action?: unknown;
  orderId?: unknown;
  status?: unknown;
  reason?: unknown;
}

interface RawCancelOrderRequest {
  action?: unknown;
  orderId?: unknown;
  reason?: unknown;
}

interface ResolvedOrderItem {
  productId: string;
  productName: string;
  productImage: string;
  size: string;
  color: string;
  quantity: number;
  price: number;
  discountAmount: number;
  brand: string;
}

interface ProductRef {
  ref: admin.firestore.DocumentReference;
  data: admin.firestore.DocumentData;
}

interface CancellationRestorationRefs {
  productChanges: Array<{
    ref: admin.firestore.DocumentReference;
    quantity: number;
  }>;
  userRef: admin.firestore.DocumentReference | null;
  userData: admin.firestore.DocumentData | null;
  userCouponRef: admin.firestore.DocumentReference | null;
  userCouponData: admin.firestore.DocumentData | null;
}

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

const USER_COUPON_AVAILABLE_STATUSES = ["사용가능", "available", "ACTIVE"];
const USER_COUPON_USED_STATUSES = ["사용완료", "used"];
const USER_COUPON_EXPIRED_STATUSES = ["기간만료", "expired", "만료됨"];

const VALID_ORDER_STATUSES = new Set([
  "pending",
  "confirmed",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
  "exchanged",
]);

const ALLOWED_ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "shipped", "cancelled"],
  preparing: ["shipped", "cancelled"],
  shipped: ["delivered", "returned", "exchanged"],
  delivered: ["returned", "exchanged"],
  cancelled: [],
  returned: [],
  exchanged: [],
};

const CUSTOMER_CANCELLABLE_STATUSES = new Set(["pending", "confirmed"]);

function normalizeClientOrderId(value: unknown): string {
  return toStringValue(value).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}

function mapOrderResponse(
  orderId: string,
  orderData: admin.firestore.DocumentData,
  fallbackCreatedAt: Date = new Date()
) {
  const products = Array.isArray(orderData.products) ? orderData.products : [];
  const createdAt = orderData.createdAt?.toDate?.() instanceof Date
    ? orderData.createdAt.toDate()
    : fallbackCreatedAt;

  return {
    orderId,
    orderNumber: toStringValue(orderData.orderNumber),
    totalAmount: toNumber(orderData.totalAmount, 0),
    discountAmount: toNumber(orderData.discountAmount, 0),
    deliveryFee: toNumber(orderData.deliveryFee, 0),
    finalAmount: toNumber(orderData.finalAmount, 0),
    pointUsed: toNumber(orderData.pointUsed, 0),
    paymentMethod: toStringValue(orderData.paymentMethod),
    status: toStringValue(orderData.status) || "pending",
    createdAt: createdAt.toISOString(),
    products,
    shippingAddress: orderData.shippingAddress || orderData.deliveryAddress,
    deliveryAddress: orderData.deliveryAddress || orderData.shippingAddress,
  };
}

function applyNoStoreHeaders(response: Response): void {
  Object.entries(NO_STORE_HEADERS).forEach(([key, value]) => {
    response.set(key, value);
  });
}

function normalizeOrderStatus(value: unknown): string {
  const status = toStringValue(value);
  if (!VALID_ORDER_STATUSES.has(status)) {
    throw new Error("Invalid order status.");
  }
  return status;
}

async function findProductSnapshot(
  transaction: admin.firestore.Transaction,
  productId: string
): Promise<ProductRef | null> {
  const topLevelRef = admin.firestore().collection("products").doc(productId);
  const topLevelSnap = await transaction.get(topLevelRef);
  if (topLevelSnap.exists) {
    return { ref: topLevelRef, data: topLevelSnap.data() || {} };
  }

  return null;
}

function getOrderProducts(data: admin.firestore.DocumentData): Array<Record<string, unknown>> {
  return Array.isArray(data.products) ? data.products.filter((item) => item && typeof item === "object") : [];
}

function getOrderUserCouponId(data: admin.firestore.DocumentData): string {
  return toStringValue(data.userCouponId) || toStringValue(data.appliedUserCouponId);
}

async function readCancellationRestorationRefs(
  transaction: admin.firestore.Transaction,
  orderId: string,
  orderData: admin.firestore.DocumentData
): Promise<CancellationRestorationRefs> {
  const productChanges: CancellationRestorationRefs["productChanges"] = [];

  for (const item of getOrderProducts(orderData)) {
    const productId = toStringValue(item.productId);
    const quantity = toNonNegativeInteger(item.quantity);
    if (!productId || quantity <= 0) {
      continue;
    }

    const productSnapshot = await findProductSnapshot(transaction, productId);
    if (productSnapshot) {
      productChanges.push({
        ref: productSnapshot.ref,
        quantity,
      });
    } else {
      console.warn(`Cancellation stock restore skipped. Product not found: ${productId}`);
    }
  }

  const pointUsed = toNonNegativeInteger(orderData.pointUsed);
  const orderUserId = toStringValue(orderData.userId);
  const userRef = pointUsed > 0 && orderUserId
    ? admin.firestore().collection("users").doc(orderUserId)
    : null;
  const userSnap = userRef ? await transaction.get(userRef) : null;

  const userCouponId = getOrderUserCouponId(orderData);
  const userCouponRef = userCouponId ? admin.firestore().collection("user_coupons").doc(userCouponId) : null;
  const userCouponSnap = userCouponRef ? await transaction.get(userCouponRef) : null;

  return {
    productChanges,
    userRef,
    userData: userSnap?.exists ? userSnap.data() || {} : null,
    userCouponRef,
    userCouponData: userCouponSnap?.exists ? userCouponSnap.data() || {} : null,
  };
}

function ensureCancellationAllowed(
  orderId: string,
  orderData: admin.firestore.DocumentData,
  authContext: AuthContext,
  actor: "customer" | "admin"
): string {
  const orderUserId = toStringValue(orderData.userId);
  if (!authContext.isAdmin && orderUserId !== authContext.uid) {
    throw new AuthError(403, "You can only cancel your own order.");
  }

  const currentStatus = toStringValue(orderData.status) || "pending";
  if (currentStatus === "cancelled") {
    return currentStatus;
  }

  if (actor === "customer" && !CUSTOMER_CANCELLABLE_STATUSES.has(currentStatus)) {
    throw new Error("This order can no longer be cancelled by the customer.");
  }

  if (actor === "admin" && !ALLOWED_ORDER_STATUS_TRANSITIONS[currentStatus]?.includes("cancelled")) {
    throw new Error(`Invalid status transition: ${currentStatus} -> cancelled`);
  }

  if (!orderId) {
    throw new Error("orderId is required.");
  }

  return currentStatus;
}

async function cancelOrderInTransaction(
  transaction: admin.firestore.Transaction,
  orderId: string,
  authContext: AuthContext,
  reason: string,
  actor: "customer" | "admin"
): Promise<{
  orderId: string;
  previousStatus: string;
  status: string;
  restored: boolean;
}> {
  const orderRef = admin.firestore().collection("orders").doc(orderId);
  const orderSnap = await transaction.get(orderRef);

  if (!orderSnap.exists) {
    throw new Error("Order not found.");
  }

  const orderData = orderSnap.data() || {};
  const currentStatus = ensureCancellationAllowed(orderId, orderData, authContext, actor);
  if (currentStatus === "cancelled") {
    return {
      orderId,
      previousStatus: currentStatus,
      status: "cancelled",
      restored: false,
    };
  }

  const alreadyRestored = Boolean(orderData.cancellationRestoredAt);
  const restorationRefs = alreadyRestored
    ? {
        productChanges: [],
        userRef: null,
        userData: null,
        userCouponRef: null,
        userCouponData: null,
      }
    : await readCancellationRestorationRefs(transaction, orderId, orderData);

  const now = admin.firestore.FieldValue.serverTimestamp();
  const statusHistoryEntry = {
    from: currentStatus,
    to: "cancelled",
    reason,
    changedBy: authContext.uid,
    actor,
    changedAt: admin.firestore.Timestamp.now(),
  };

  for (const change of restorationRefs.productChanges) {
    transaction.update(change.ref, {
      stock: admin.firestore.FieldValue.increment(change.quantity),
      updatedAt: now,
    });
  }

  const pointUsed = toNonNegativeInteger(orderData.pointUsed);
  const orderUserId = toStringValue(orderData.userId);
  if (pointUsed > 0 && restorationRefs.userRef && restorationRefs.userData) {
    const currentPointBalance = toNumber(restorationRefs.userData.pointBalance, 0);
    const nextPointBalance = currentPointBalance + pointUsed;
    transaction.update(restorationRefs.userRef, {
      pointBalance: nextPointBalance,
      updatedAt: now,
    });
    transaction.set(restorationRefs.userRef.collection("pointHistory").doc(), {
      type: "refund",
      amount: pointUsed,
      description: "주문 취소 포인트 복원",
      orderId,
      date: now,
      balanceAfter: nextPointBalance,
      expired: false,
    });
  }

  if (restorationRefs.userCouponRef && restorationRefs.userCouponData) {
    const couponUid = toStringValue(restorationRefs.userCouponData.uid);
    const couponOrderId = toStringValue(restorationRefs.userCouponData.orderId);
    if (couponUid === orderUserId && couponOrderId === orderId) {
      transaction.update(restorationRefs.userCouponRef, {
        status: USER_COUPON_AVAILABLE_STATUSES[0],
        usedDate: admin.firestore.FieldValue.delete(),
        orderId: admin.firestore.FieldValue.delete(),
        updatedAt: now,
      });
    }
  }

  transaction.update(orderRef, {
    status: "cancelled",
    cancelReason: reason || (actor === "customer" ? "고객 직접 취소" : "관리자 상태 변경"),
    cancelledAt: now,
    cancellationRestoredAt: alreadyRestored ? orderData.cancellationRestoredAt : now,
    updatedAt: now,
    statusHistory: admin.firestore.FieldValue.arrayUnion(statusHistoryEntry),
  });

  return {
    orderId,
    previousStatus: currentStatus,
    status: "cancelled",
    restored: !alreadyRestored,
  };
}

export const order = onRequest(
  {
    cors: SENSITIVE_FUNCTION_CORS,
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 120,
  },
  async (req, res) => {
    applyNoStoreHeaders(res);

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ success: false, error: "Method not allowed." });
      return;
    }

    try {
      const action = toStringValue((req.body as RawCreateOrderRequest).action);

      if (action === "updateStatus") {
        await handleAdminOrderStatusUpdate(req.body as RawUpdateOrderStatusRequest, req.headers.authorization, res);
        return;
      }

      if (action === "cancel") {
        await handleOrderCancellation(req.body as RawCancelOrderRequest, req.headers.authorization, res);
        return;
      }

      const authContext = await verifyAuthContext(req.headers.authorization);
      const payload = req.body as RawCreateOrderRequest;

      const items = normalizeItems(parseItems(payload.items));
      if (items.length === 0) {
        res.status(400).json({ success: false, error: "items is required." });
        return;
      }

      const deliveryAddress = parseDeliveryAddress(payload.deliveryAddress);
      const paymentMethod = normalizePaymentMethod(payload.paymentMethod);
      const deliveryOption = normalizeDeliveryOption(payload.deliveryOption);
      const selectedCoupon = toStringValue(payload.selectedCoupon);
      const requestedPointAmount = toNonNegativeInteger(payload.requestedPointAmount);

      const result = await admin.firestore().runTransaction(async (transaction) => {
        const usersRef = admin.firestore().collection("users");
        const ordersRef = admin.firestore().collection("orders");
        const now = admin.firestore.FieldValue.serverTimestamp();
        const nowDate = new Date();
        const clientOrderId = normalizeClientOrderId(payload.clientOrderId);
        const orderRef = clientOrderId
          ? ordersRef.doc(`${authContext.uid}_${clientOrderId}`)
          : ordersRef.doc();

        if (clientOrderId) {
          const existingOrderSnap = await transaction.get(orderRef);
          if (existingOrderSnap.exists) {
            return mapOrderResponse(orderRef.id, existingOrderSnap.data() || {}, nowDate);
          }
        }

        const userRef = usersRef.doc(authContext.uid);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists) {
          throw new Error("User document was not found.");
        }

        const userData = userSnap.data() || {};
        let subtotal = 0;
        const resolvedItems: ResolvedOrderItem[] = [];
        const cartItemIdsToRemove = new Set<string>();
        const productStockDeltas: Array<{ ref: admin.firestore.DocumentReference; nextStock: number }> = [];

        for (const item of items) {
          const productSnapshot = await findProductSnapshot(transaction, item.productId);
          if (!productSnapshot) {
            throw new Error(`Product not found: ${item.productId}`);
          }

          const productData = productSnapshot.data;
          const unitPrice = calculateDiscountedUnitPrice(productData);
          const stock = toNonNegativeInteger(productData.stock);
          if (stock < item.quantity) {
            throw new Error(`Insufficient stock for productId: ${item.productId}`);
          }

          for (const cartItemId of item.cartItemIds) {
            if (cartItemId) {
              cartItemIdsToRemove.add(cartItemId);
            }
          }

          const productImage = toStringValue(productData.mainImage) || toStringValue(productData.images?.[0]);
          resolvedItems.push({
            productId: item.productId,
            productName: toStringValue(productData.name),
            productImage,
            size: item.size,
            color: item.color,
            quantity: item.quantity,
            price: unitPrice,
            discountAmount: Math.max(0, toNumber(productData.price, 0) - unitPrice),
            brand: toStringValue(productData.brand),
          });

          subtotal += unitPrice * item.quantity;
          productStockDeltas.push({
            ref: productSnapshot.ref,
            nextStock: Math.max(0, stock - item.quantity),
          });
        }

        let couponDiscount = 0;
        let couponApplied = false;
        let couponFreeShipping = false;
        let userCouponRef: admin.firestore.DocumentReference | null = null;
        let appliedUserCouponId = "";
        let appliedCouponId = "";

        if (selectedCoupon) {
          userCouponRef = admin.firestore().collection("user_coupons").doc(selectedCoupon);
          const userCouponSnap = await transaction.get(userCouponRef);
          if (!userCouponSnap.exists) {
            throw new Error("Coupon not found.");
          }

          const userCoupon = userCouponSnap.data() || {};
          if (userCoupon.uid !== authContext.uid) {
            throw new Error("Cannot use coupon of another user.");
          }
          appliedUserCouponId = selectedCoupon;
          appliedCouponId = toStringValue(userCoupon.couponId);
          if (!appliedCouponId) {
            throw new Error("Coupon master data not found.");
          }

          const couponCurrentStatus = toStringValue(userCoupon.status);
          if (!USER_COUPON_AVAILABLE_STATUSES.includes(couponCurrentStatus)) {
            throw new Error("Coupon is not available.");
          }

          const couponRef = admin.firestore().collection("coupons").doc(appliedCouponId);
          const couponSnap = await transaction.get(couponRef);
          if (!couponSnap.exists) {
            throw new Error("Coupon master data not found.");
          }

          const couponData = couponSnap.data() || {};
          if (couponData.isActive !== true) {
            throw new Error("Coupon is inactive.");
          }

          const expiryDate = parseDate(couponData.expiryDate);
          if (!expiryDate || expiryDate < nowDate) {
            transaction.update(userCouponRef, {
              status: USER_COUPON_EXPIRED_STATUSES[0],
              expiredDate: toTodayString(nowDate),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            throw new Error("Coupon has expired.");
          }

          const minimumOrderAmount = Math.max(0, toNumber(couponData.minOrderAmount, 0));
          if (minimumOrderAmount > 0 && subtotal < minimumOrderAmount) {
            throw new Error("Coupon minimum order amount is not satisfied.");
          }

          const couponDiscountData = calculateCouponDiscount(subtotal, couponData);
          couponDiscount = couponDiscountData.discount;
          couponFreeShipping = couponDiscountData.freeShipping;
          couponApplied = true;
        }

        const totalAfterCoupon = Math.max(0, subtotal - couponDiscount);
        const deliveryFee = calculateDeliveryFee(totalAfterCoupon, deliveryOption, couponFreeShipping);

        const pointBalance = toNumber(userData.pointBalance, 0);
        if (requestedPointAmount > pointBalance) {
          throw new Error("Insufficient point balance.");
        }

        const payableAmount = Math.max(0, totalAfterCoupon + deliveryFee);
        if (requestedPointAmount > payableAmount) {
          throw new Error("Requested point amount is too high.");
        }

        const cartRef = admin.firestore().collection("carts").doc(authContext.uid);
        const cartSnap = cartItemIdsToRemove.size > 0 ? await transaction.get(cartRef) : null;

        const orderId = orderRef.id;
        const orderData = {
          userId: authContext.uid,
          ...(clientOrderId ? { clientOrderId } : {}),
          orderNumber: `ORD-${toTodayString(nowDate).replace(/-/g, "")}-${orderId.slice(0, 6).toUpperCase()}`,
          products: resolvedItems,
          totalAmount: subtotal,
          discountAmount: couponDiscount,
          deliveryFee,
          finalAmount: Math.max(0, payableAmount - requestedPointAmount),
          pointUsed: requestedPointAmount,
          ...(appliedUserCouponId ? { userCouponId: appliedUserCouponId, couponId: appliedCouponId } : {}),
          status: "pending",
          paymentMethod,
          shippingAddress: deliveryAddress,
          deliveryAddress,
          createdAt: now,
          updatedAt: now,
        };

        transaction.set(orderRef, orderData);

        for (const change of productStockDeltas) {
          transaction.update(change.ref, { stock: change.nextStock, updatedAt: now });
        }

        if (couponApplied && userCouponRef) {
          transaction.update(userCouponRef, {
            status: USER_COUPON_USED_STATUSES[0],
            usedDate: toTodayString(nowDate),
            orderId,
            updatedAt: now,
          });
        }

        if (requestedPointAmount > 0) {
          const nextPointBalance = pointBalance - requestedPointAmount;
          transaction.update(userRef, {
            pointBalance: nextPointBalance,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          transaction.set(userRef.collection("pointHistory").doc(), {
            type: "use",
            amount: requestedPointAmount,
            description: "주문 포인트 사용",
            orderId,
            date: now,
            balanceAfter: nextPointBalance,
            expired: false,
          });
        }

        if (cartSnap?.exists && cartItemIdsToRemove.size > 0) {
          const cartData = cartSnap.data() || {};
          const cartItems = Array.isArray(cartData.items) ? cartData.items : [];
          const nextItems = cartItems.filter((item: unknown) => {
            const cartId = toStringValue((item as Record<string, unknown>)?.id);
            return !cartId || !cartItemIdsToRemove.has(cartId);
          });

          if (nextItems.length !== cartItems.length) {
            const cartSummary = mapCartTotal(nextItems);
            transaction.update(cartRef, {
              items: nextItems,
              totalAmount: cartSummary.totalAmount,
              totalItems: cartSummary.totalItems,
              updatedAt: now,
            });
          }
        }

        return {
          orderId,
          orderNumber: orderData.orderNumber,
          totalAmount: orderData.totalAmount,
          discountAmount: orderData.discountAmount,
          deliveryFee: orderData.deliveryFee,
          finalAmount: orderData.finalAmount,
          pointUsed: orderData.pointUsed,
          paymentMethod: orderData.paymentMethod,
          status: orderData.status,
          createdAt: nowDate.toISOString(),
          products: resolvedItems,
          shippingAddress: orderData.shippingAddress,
          deliveryAddress: orderData.deliveryAddress,
        };
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ success: false, error: error.message });
        return;
      }

      console.error("Order API error:", error);
      res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Internal server error" });
    }
  }
);

async function handleOrderCancellation(
  payload: RawCancelOrderRequest,
  authorization: string | undefined,
  res: Response
): Promise<void> {
  const authContext = await verifyAuthContext(authorization);
  const orderId = toStringValue(payload.orderId);
  const reason = toStringValue(payload.reason) || "고객 직접 취소";

  if (!orderId) {
    res.status(400).json({ success: false, error: "orderId is required." });
    return;
  }

  const result = await admin.firestore().runTransaction((transaction) =>
    cancelOrderInTransaction(transaction, orderId, authContext, reason, authContext.isAdmin ? "admin" : "customer")
  );

  res.status(200).json({ success: true, data: result });
}

async function handleAdminOrderStatusUpdate(
  payload: RawUpdateOrderStatusRequest,
  authorization: string | undefined,
  res: Response
): Promise<void> {
  const authContext = await verifyAuthContext(authorization);
  if (!authContext.isAdmin) {
    throw new AuthError(403, "Admin privileges are required.");
  }

  const orderId = toStringValue(payload.orderId);
  const nextStatus = normalizeOrderStatus(payload.status);
  const reason = toStringValue(payload.reason);

  if (!orderId) {
    res.status(400).json({ success: false, error: "orderId is required." });
    return;
  }

  const result = await admin.firestore().runTransaction(async (transaction) => {
    const orderRef = admin.firestore().collection("orders").doc(orderId);
    const orderSnap = await transaction.get(orderRef);

    if (!orderSnap.exists) {
      throw new Error("Order not found.");
    }

    const orderData = orderSnap.data() || {};
    const currentStatus = toStringValue(orderData.status) || "pending";
    const allowedNextStatuses = ALLOWED_ORDER_STATUS_TRANSITIONS[currentStatus] || [];

    if (currentStatus !== nextStatus && !allowedNextStatuses.includes(nextStatus)) {
      throw new Error(`Invalid status transition: ${currentStatus} -> ${nextStatus}`);
    }

    if (nextStatus === "cancelled" && currentStatus !== "cancelled") {
      return cancelOrderInTransaction(transaction, orderId, authContext, reason || "관리자 상태 변경", "admin");
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const statusHistoryEntry = {
      from: currentStatus,
      to: nextStatus,
      reason,
      changedBy: authContext.uid,
      changedAt: admin.firestore.Timestamp.now(),
    };

    const updateData: Record<string, unknown> = {
      status: nextStatus,
      updatedAt: now,
      statusHistory: admin.firestore.FieldValue.arrayUnion(statusHistoryEntry),
    };

    if (nextStatus === "cancelled") {
      updateData.cancelReason = reason || "관리자 상태 변경";
      updateData.cancelledAt = now;
    }

    transaction.update(orderRef, updateData);

    return {
      orderId,
      previousStatus: currentStatus,
      status: nextStatus,
    };
  });

  res.status(200).json({ success: true, data: result });
}
