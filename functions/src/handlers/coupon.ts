import { onRequest } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import type { Response } from "express";
import {
  couponHasExpired,
  isAvailableUserCouponStatus,
  normalizeCouponCode,
} from "../domain/couponDomain";
import { CouponIssuanceError, issueUserCouponInTransaction } from "../domain/couponIssuance";
import { parseCouponExpiryDay, toKstDayKey } from "../domain/kstDate";
import { verifyAuth, requireAdmin, AuthError } from "../utils/auth";
import { applyNoStoreHeaders } from "../utils/http";

function getDb() {
  return getFirestore();
}

export const coupon = onRequest(
  {
    cors: true,
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  async (req, res) => {
    applyNoStoreHeaders(res);

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ success: false, error: "Method not allowed" });
      return;
    }

    try {
      const { action, ...payload } = req.body;

      switch (action) {
        case "register": {
          const userId = await verifyAuth(req.headers.authorization);
          await handleRegister(userId, payload, res);
          return;
        }
        case "issue": {
          const adminContext = await requireAdmin(req.headers.authorization);
          const targetUid = ensureString(payload.targetUid) || adminContext.uid;
          await handleIssue(targetUid, payload, res);
          return;
        }
        case "use": {
          const userId = await verifyAuth(req.headers.authorization);
          await handleUse(userId, payload, res);
          return;
        }
        case "cleanup":
          await requireAdmin(req.headers.authorization);
          await handleCleanup(res);
          return;
        case "adminCreate":
          await requireAdmin(req.headers.authorization);
          await handleAdminCreate(payload, res);
          return;
        case "adminUpdate":
          await requireAdmin(req.headers.authorization);
          await handleAdminUpdate(payload, res);
          return;
        case "adminArchive":
          await requireAdmin(req.headers.authorization);
          await handleAdminArchive(payload, res);
          return;
        default:
          res.status(400).json({ success: false, error: `Unsupported action: ${action}` });
      }
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ success: false, error: error.message });
        return;
      }

      console.error("Coupon API error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }
);

function ensureString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function ensureNumber(value: unknown, fallback = 0): number {
  const nextValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function ensureBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeCouponType(value: unknown): "할인금액" | "할인율" | "무료배송" {
  if (value === "할인율" || value === "무료배송") {
    return value;
  }
  return "할인금액";
}

function buildCouponAdminData(data: Record<string, unknown>, partial = false): Record<string, unknown> {
  const nextData: Record<string, unknown> = {};

  const name = ensureString(data.name);
  if (name || !partial) {
    if (!name) throw new Error("coupon name is required.");
    nextData.name = name;
  }

  if (data.type !== undefined || !partial) {
    nextData.type = normalizeCouponType(data.type);
  }

  if (data.value !== undefined || !partial) {
    const value = Math.max(0, ensureNumber(data.value));
    if (nextData.type === "할인율" && value > 100) {
      throw new Error("discount rate cannot exceed 100.");
    }
    nextData.value = value;
  }

  if (data.minOrderAmount !== undefined || !partial) {
    nextData.minOrderAmount = Math.max(0, ensureNumber(data.minOrderAmount));
  }

  const expiryDate = ensureString(data.expiryDate);
  if (expiryDate || !partial) {
    const expiryDay = parseCouponExpiryDay(expiryDate);
    if (!expiryDay) {
      throw new Error("valid expiryDate is required.");
    }
    nextData.expiryDate = expiryDay;
  }

  if (data.description !== undefined || !partial) {
    nextData.description = ensureString(data.description);
  }

  if (data.isActive !== undefined || !partial) {
    nextData.isActive = ensureBoolean(data.isActive, true);
  }

  if (data.isDirectAssign !== undefined || !partial) {
    nextData.isDirectAssign = ensureBoolean(data.isDirectAssign, false);
  }

  const isDirectAssign = ensureBoolean(nextData.isDirectAssign ?? data.isDirectAssign, false);
  const couponCode = normalizeCouponCode(data.couponCode);
  if (!isDirectAssign && (couponCode || !partial)) {
    if (!couponCode) throw new Error("couponCode is required for code coupons.");
    nextData.couponCode = couponCode;
  }
  if (isDirectAssign) {
    nextData.couponCode = "";
  }

  if (data.usageLimit !== undefined || !partial) {
    nextData.usageLimit = Math.max(1, Math.floor(ensureNumber(data.usageLimit, 1)));
  }

  if (data.usedCount !== undefined) {
    nextData.usedCount = Math.max(0, Math.floor(ensureNumber(data.usedCount)));
  } else if (!partial) {
    nextData.usedCount = 0;
  }

  return nextData;
}

async function handleAdminCreate(data: Record<string, unknown>, res: Response): Promise<void> {
  const db = getDb();
  const couponData = buildCouponAdminData(data, false);
  const docRef = await db.collection("coupons").add({
    ...couponData,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  res.status(200).json({
    success: true,
    data: { couponId: docRef.id },
  });
}

async function handleAdminUpdate(data: Record<string, unknown>, res: Response): Promise<void> {
  const couponId = ensureString(data.couponId);
  if (!couponId) {
    res.status(400).json({ success: false, error: "couponId is required." });
    return;
  }

  const updateData = buildCouponAdminData(data, true);
  await getDb().collection("coupons").doc(couponId).update({
    ...updateData,
    updatedAt: FieldValue.serverTimestamp(),
  });

  res.status(200).json({
    success: true,
    data: { couponId },
  });
}

async function handleAdminArchive(data: Record<string, unknown>, res: Response): Promise<void> {
  const couponId = ensureString(data.couponId);
  if (!couponId) {
    res.status(400).json({ success: false, error: "couponId is required." });
    return;
  }

  await getDb().collection("coupons").doc(couponId).update({
    isActive: false,
    archivedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  res.status(200).json({
    success: true,
    data: { couponId, archived: true },
  });
}

async function handleRegister(
  userId: string,
  data: { couponCode?: string },
  res: Response
): Promise<void> {
  const couponCode = normalizeCouponCode(data.couponCode);

  if (!couponCode) {
    res.status(400).json({ success: false, error: "couponCode is required." });
    return;
  }

  const db = getDb();
  const couponQuery = db
    .collection("coupons")
    .where("couponCode", "==", couponCode)
    .where("isActive", "==", true)
    .where("isDirectAssign", "==", false);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const couponSnapshot = await transaction.get(couponQuery);
      if (couponSnapshot.empty) {
        throw new CouponIssuanceError(404, "Coupon code was not found.");
      }

      const couponDoc = couponSnapshot.docs[0];
      const couponData = couponDoc.data();
      const couponId = couponDoc.id;

      if (couponData.usageLimit && couponData.usedCount >= couponData.usageLimit) {
        throw new CouponIssuanceError(409, "Coupon usage limit has been reached.");
      }

      if (couponHasExpired(couponData.expiryDate)) {
        throw new CouponIssuanceError(410, "Coupon has expired.");
      }

      const existingQuery = db
        .collection("user_coupons")
        .where("uid", "==", userId)
        .where("couponId", "==", couponId);
      const existing = await transaction.get(existingQuery);
      if (!existing.empty) {
        throw new CouponIssuanceError(409, "Coupon already registered for this user.");
      }

      const today = toKstDayKey(new Date());
      const userCouponRef = db.collection("user_coupons").doc();
      transaction.set(userCouponRef, {
        uid: userId,
        couponId,
        status: "사용가능",
        issuedDate: today,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(couponDoc.ref, {
        usedCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return {
        userCouponId: userCouponRef.id,
        couponName: couponData?.name,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        message: "Coupon registered successfully.",
        ...result,
        couponCode,
      },
    });
  } catch (error) {
    if (error instanceof CouponIssuanceError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }

    throw error;
  }
}

async function handleIssue(
  userId: string,
  data: { couponId?: string },
  res: Response
): Promise<void> {
  const { couponId } = data;

  if (!couponId) {
    res.status(400).json({ success: false, error: "couponId is required." });
    return;
  }

  const db = getDb();
  try {
    const result = await db.runTransaction((transaction) =>
      issueUserCouponInTransaction(transaction, db, { userId, couponId })
    );

    res.status(200).json({
      success: true,
      data: {
        message: "Coupon issued successfully.",
        ...result,
      },
    });
  } catch (error) {
    if (error instanceof CouponIssuanceError) {
      res.status(error.statusCode).json({ success: false, error: error.message });
      return;
    }

    throw error;
  }
}

async function handleUse(
  userId: string,
  data: { userCouponId?: string; orderId?: string },
  res: Response
): Promise<void> {
  const { userCouponId, orderId } = data;

  if (!userCouponId || !orderId) {
    res.status(400).json({ success: false, error: "userCouponId and orderId are required." });
    return;
  }

  const db = getDb();
  const userCouponDoc = await db.collection("user_coupons").doc(userCouponId).get();

  if (!userCouponDoc.exists) {
    res.status(404).json({ success: false, error: "User coupon does not exist." });
    return;
  }

  const userCoupon = userCouponDoc.data();
  if (userCoupon?.uid !== userId) {
    res.status(403).json({ success: false, error: "You can only use your own coupons." });
    return;
  }

  if (!isAvailableUserCouponStatus(userCoupon?.status)) {
    res.status(409).json({ success: false, error: "Coupon is not available." });
    return;
  }

  const couponDoc = await db.collection("coupons").doc(userCoupon.couponId).get();
  if (!couponDoc.exists) {
    res.status(404).json({ success: false, error: "Coupon master document does not exist." });
    return;
  }

  const couponData = couponDoc.data();
  const today = new Date();

  if (couponHasExpired(couponData?.expiryDate, today)) {
    await db.collection("user_coupons").doc(userCouponId).update({
      status: "기간만료",
      expiredDate: toKstDayKey(today),
      updatedAt: FieldValue.serverTimestamp(),
    });
    res.status(410).json({ success: false, error: "Coupon has expired." });
    return;
  }

  const usedDate = toKstDayKey(today);
  await db.collection("user_coupons").doc(userCouponId).update({
    status: "사용완료",
    usedDate,
    orderId,
    updatedAt: FieldValue.serverTimestamp(),
  });

  res.status(200).json({
    success: true,
    data: {
      message: "Coupon used successfully.",
      userCouponId,
      couponName: couponData?.name,
      usedDate,
      orderId,
    },
  });
}

async function handleCleanup(res: Response): Promise<void> {
  const db = getDb();
  const today = new Date();
  const todayStr = toKstDayKey(today);
  const expiredUserCoupons = await db.collection("user_coupons").where("status", "==", "사용가능").get();
  const batch = db.batch();
  let updateCount = 0;

  for (const userCouponDoc of expiredUserCoupons.docs) {
    const userCoupon = userCouponDoc.data();
    const couponDoc = await db.collection("coupons").doc(userCoupon.couponId).get();

    if (!couponDoc.exists) {
      continue;
    }

    const couponData = couponDoc.data();
    if (couponHasExpired(couponData?.expiryDate, today)) {
      batch.update(userCouponDoc.ref, {
        status: "기간만료",
        expiredDate: todayStr,
        updatedAt: FieldValue.serverTimestamp(),
      });
      updateCount += 1;
    }
  }

  if (updateCount > 0) {
    await batch.commit();
  }

  res.status(200).json({
    success: true,
    data: { message: `${updateCount} expired coupons were updated.` },
  });
}
