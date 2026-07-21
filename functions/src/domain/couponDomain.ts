import { isExpiredOnKstDay } from "./kstDate";

const USER_COUPON_AVAILABLE_STATUSES = ["사용가능", "available", "ACTIVE"];

export type CouponIssuePolicyResult =
  | { ok: true }
  | {
      ok: false;
      reason: "inactive" | "code_coupon_requires_register" | "expired" | "usage_limit_reached";
    };

export function normalizeCouponCode(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export function couponHasExpired(expiryDate: unknown, now: Date = new Date()): boolean {
  return isExpiredOnKstDay(expiryDate, now);
}

export function isAvailableUserCouponStatus(status: unknown): boolean {
  return typeof status === "string" && USER_COUPON_AVAILABLE_STATUSES.includes(status);
}

export function isCouponIssuableByAction(
  couponData: Record<string, unknown> | undefined,
  now: Date = new Date(),
): CouponIssuePolicyResult {
  if (!couponData?.isActive) {
    return { ok: false, reason: "inactive" };
  }

  if (!couponData.isDirectAssign) {
    return { ok: false, reason: "code_coupon_requires_register" };
  }

  if (couponHasExpired(couponData.expiryDate, now)) {
    return { ok: false, reason: "expired" };
  }

  const usageLimit = toFiniteNumber(couponData.usageLimit);
  const usedCount = toFiniteNumber(couponData.usedCount) ?? 0;

  if (usageLimit !== null && usedCount >= usageLimit) {
    return { ok: false, reason: "usage_limit_reached" };
  }

  return { ok: true };
}

function toFiniteNumber(value: unknown): number | null {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}
