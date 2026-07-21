import { FieldValue } from "firebase-admin/firestore";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { isCouponIssuableByAction } from "./couponDomain";
import { toKstDayKey } from "./kstDate";

export class CouponIssuanceError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "CouponIssuanceError";
  }
}

export interface CouponIssuanceResult {
  userCouponId: string;
  couponName: string;
}

export async function issueUserCouponInTransaction(
  transaction: Transaction,
  db: Firestore,
  input: { userId: string; couponId: string }
): Promise<CouponIssuanceResult> {
  const couponRef = db.collection("coupons").doc(input.couponId);
  const couponDoc = await transaction.get(couponRef);

  if (!couponDoc.exists) {
    throw new CouponIssuanceError(404, "Coupon does not exist.");
  }

  const couponData = couponDoc.data() || {};
  const issuePolicy = isCouponIssuableByAction(couponData);
  if (!issuePolicy.ok) {
    const statusByReason: Record<typeof issuePolicy.reason, number> = {
      inactive: 403,
      code_coupon_requires_register: 403,
      expired: 410,
      usage_limit_reached: 409,
    };
    const messageByReason: Record<typeof issuePolicy.reason, string> = {
      inactive: "Coupon is inactive.",
      code_coupon_requires_register: "Code coupons must be registered with couponCode.",
      expired: "Coupon has expired.",
      usage_limit_reached: "Coupon usage limit has been reached.",
    };
    throw new CouponIssuanceError(statusByReason[issuePolicy.reason], messageByReason[issuePolicy.reason]);
  }

  const existingQuery = db
    .collection("user_coupons")
    .where("uid", "==", input.userId)
    .where("couponId", "==", input.couponId);
  const existing = await transaction.get(existingQuery);
  if (!existing.empty) {
    throw new CouponIssuanceError(409, "Coupon already issued for this user.");
  }

  const today = toKstDayKey(new Date());
  const userCouponRef = db.collection("user_coupons").doc();
  transaction.set(userCouponRef, {
    uid: input.userId,
    couponId: input.couponId,
    status: "사용가능",
    issuedDate: today,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  transaction.update(couponRef, {
    usedCount: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    userCouponId: userCouponRef.id,
    couponName: typeof couponData.name === "string" ? couponData.name : "",
  };
}
