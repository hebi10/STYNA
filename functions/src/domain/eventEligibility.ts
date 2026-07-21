import type { DocumentData, Firestore, Transaction } from "firebase-admin/firestore";
import {
  buildReviewDocumentId,
  getOrderProducts,
  isDeliveredOrderStatus,
} from "./purchaseEvidence";

export type EventEligibilityType = "none" | "purchase" | "delivered" | "review";
export type EventEligibilityErrorCode =
  | "event_misconfigured"
  | "ineligible_purchase"
  | "ineligible_delivered"
  | "ineligible_review";

export interface EventEligibilityInput {
  userId: string;
  eligibilityType: unknown;
  targetProducts: unknown;
}

export interface EligibilityEvidence {
  type: EventEligibilityType;
  orderId?: string;
  productId?: string;
  size?: string;
  color?: string;
  reviewId?: string;
}

const VALID_ELIGIBILITY_TYPES = new Set<EventEligibilityType>([
  "none",
  "purchase",
  "delivered",
  "review",
]);
const EXCLUDED_PURCHASE_STATUSES = new Set([
  "cancelled",
  "canceled",
  "returned",
  "exchanged",
  "취소",
  "반품",
  "교환",
]);
const ERROR_MESSAGES: Record<EventEligibilityErrorCode, string> = {
  event_misconfigured: "이벤트 참여 조건이 올바르게 설정되지 않았습니다.",
  ineligible_purchase: "대상 상품 구매 내역을 확인할 수 없습니다.",
  ineligible_delivered: "대상 상품의 배송 완료 또는 구매 확정 내역을 확인할 수 없습니다.",
  ineligible_review: "대상 상품 옵션의 구매 인증 리뷰를 확인할 수 없습니다.",
};

interface OrderCandidate {
  orderId: string;
  productId: string;
  size: string;
  color: string;
}

export class EventEligibilityError extends Error {
  readonly statusCode: number;

  constructor(public readonly code: EventEligibilityErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "EventEligibilityError";
    this.statusCode = code === "event_misconfigured" ? 409 : 403;
  }
}

function toTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseEligibilityType(value: unknown): EventEligibilityType | null {
  return typeof value === "string" && VALID_ELIGIBILITY_TYPES.has(value as EventEligibilityType)
    ? value as EventEligibilityType
    : null;
}

function normalizeTargetProducts(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return Array.from(new Set(value.map(toTrimmedString).filter(Boolean)));
}

function isEligiblePurchaseStatus(status: unknown): boolean {
  const normalized = toTrimmedString(status);
  return Boolean(normalized) && !EXCLUDED_PURCHASE_STATUSES.has(normalized.toLowerCase());
}

function getMatchingProducts(orderData: DocumentData, targetProductIds: Set<string>) {
  return getOrderProducts(orderData).flatMap((product) => {
    const productId = toTrimmedString(product.productId);
    const quantity = typeof product.quantity === "number" ? product.quantity : 0;
    if (!targetProductIds.has(productId) || !Number.isFinite(quantity) || quantity <= 0) {
      return [];
    }

    return [{
      productId,
      size: toTrimmedString(product.size),
      color: toTrimmedString(product.color),
    }];
  });
}

function isMatchingReview(
  reviewData: DocumentData,
  userId: string,
  candidate: OrderCandidate,
): boolean {
  return reviewData.verifiedPurchase === true
    && toTrimmedString(reviewData.userId) === userId
    && toTrimmedString(reviewData.orderId) === candidate.orderId
    && toTrimmedString(reviewData.productId) === candidate.productId
    && toTrimmedString(reviewData.size) === candidate.size
    && toTrimmedString(reviewData.color) === candidate.color;
}

export async function assertEventEligibility(
  transaction: Transaction,
  db: Firestore,
  input: EventEligibilityInput,
): Promise<EligibilityEvidence> {
  const eligibilityType = parseEligibilityType(input.eligibilityType);
  if (!eligibilityType || !toTrimmedString(input.userId)) {
    throw new EventEligibilityError("event_misconfigured");
  }

  const normalizedTargets = input.targetProducts === undefined || input.targetProducts === null
    ? null
    : normalizeTargetProducts(input.targetProducts);
  if (eligibilityType === "none") {
    if (input.targetProducts !== undefined) {
      throw new EventEligibilityError("event_misconfigured");
    }
    return { type: "none" };
  }

  if (!normalizedTargets || normalizedTargets.length === 0) {
    throw new EventEligibilityError("event_misconfigured");
  }

  const targetProductIds = new Set(normalizedTargets);
  const ordersQuery = db.collection("orders").where("userId", "==", input.userId);
  const orderSnapshot = await transaction.get(ordersQuery);
  const candidates: OrderCandidate[] = [];

  for (const orderDoc of orderSnapshot.docs) {
    const orderData = orderDoc.data() || {};
    if (toTrimmedString(orderData.userId) !== input.userId) {
      continue;
    }

    const hasRequiredStatus = eligibilityType === "purchase"
      ? isEligiblePurchaseStatus(orderData.status)
      : isDeliveredOrderStatus(orderData.status);
    if (!hasRequiredStatus) {
      continue;
    }

    for (const product of getMatchingProducts(orderData, targetProductIds)) {
      candidates.push({ orderId: orderDoc.id, ...product });
    }
  }

  if (candidates.length === 0) {
    const code = eligibilityType === "purchase"
      ? "ineligible_purchase"
      : eligibilityType === "delivered"
        ? "ineligible_delivered"
        : "ineligible_review";
    throw new EventEligibilityError(code);
  }

  if (eligibilityType !== "review") {
    return { type: eligibilityType, ...candidates[0] };
  }

  const reviewCandidates = candidates.map((candidate) => {
    const reviewId = buildReviewDocumentId(candidate);
    return {
      candidate,
      reviewId,
      reviewRef: db.collection("reviews").doc(reviewId),
    };
  });
  const reviewSnapshots = await Promise.all(
    reviewCandidates.map(({ reviewRef }) => transaction.get(reviewRef)),
  );

  for (let index = 0; index < reviewCandidates.length; index += 1) {
    const reviewSnapshot = reviewSnapshots[index];
    const { candidate, reviewId } = reviewCandidates[index];
    if (reviewSnapshot.exists && isMatchingReview(reviewSnapshot.data() || {}, input.userId, candidate)) {
      return { type: "review", ...candidate, reviewId };
    }
  }

  throw new EventEligibilityError("ineligible_review");
}
