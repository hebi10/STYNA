import type { DocumentData } from "firebase-admin/firestore";

const DELIVERED_ORDER_STATUSES = new Set([
  "delivered",
  "배송완료",
  "purchase_confirmed",
  "구매확정",
]);

export interface ReviewDocumentIdInput {
  orderId: string;
  productId: string;
  size: string;
  color: string;
}

function toTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hasPositiveQuantity(product: Record<string, unknown>): boolean {
  return typeof product.quantity === "number"
    && Number.isFinite(product.quantity)
    && product.quantity > 0;
}

export function isDeliveredOrderStatus(status: unknown): boolean {
  return DELIVERED_ORDER_STATUSES.has(toTrimmedString(status));
}

export function getOrderProducts(order: DocumentData | undefined): Array<Record<string, unknown>> {
  if (!order || !Array.isArray(order.products)) {
    return [];
  }

  return order.products.filter(
    (product): product is Record<string, unknown> => Boolean(product) && typeof product === "object",
  );
}

export function orderHasTargetProduct(
  order: DocumentData | undefined,
  targetProductIds: readonly string[],
): boolean {
  const targetIds = new Set(targetProductIds.map(toTrimmedString).filter(Boolean));
  if (targetIds.size === 0) {
    return false;
  }

  return getOrderProducts(order).some((product) => (
    targetIds.has(toTrimmedString(product.productId)) && hasPositiveQuantity(product)
  ));
}

export function buildReviewDocumentId(input: ReviewDocumentIdInput): string {
  return Buffer.from(
    JSON.stringify([input.orderId, input.productId, input.size, input.color]),
    "utf8",
  ).toString("base64url");
}
