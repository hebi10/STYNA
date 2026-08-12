export interface CheckoutItem {
  productId: string;
  id?: string;
  size: string;
  color: string;
  quantity: number;
  productName?: string;
  productImage?: string;
  brand?: string;
  price: number;
  discountAmount?: number;
  originalPrice?: number;
  salePrice?: number;
}

export interface CheckoutDraft {
  items: CheckoutItem[];
  selectedCoupon?: string;
  deliveryOption: "standard" | "express";
  pricingPreview?: {
    originalSubtotal: number;
    subtotal: number;
    productDiscountAmount: number;
    couponDiscount: number;
    deliveryFee: number;
    finalAmount: number;
  };
}

type CheckoutDraftFailureReason = "missing" | "invalid-json" | "empty-items";

type CheckoutDraftParseResult =
  | { ok: true; draft: CheckoutDraft }
  | { ok: false; reason: CheckoutDraftFailureReason };

export function parseCheckoutDraft(savedOrderData: string | null): CheckoutDraftParseResult {
  if (!savedOrderData) {
    return { ok: false, reason: "missing" };
  }

  let parsed: Partial<CheckoutDraft>;
  try {
    parsed = JSON.parse(savedOrderData) as Partial<CheckoutDraft>;
  } catch {
    return { ok: false, reason: "invalid-json" };
  }

  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    return { ok: false, reason: "empty-items" };
  }

  return {
    ok: true,
    draft: {
      items: parsed.items,
      selectedCoupon: parsed.selectedCoupon,
      deliveryOption: parsed.deliveryOption === "express" ? "express" : "standard",
      pricingPreview: parsed.pricingPreview,
    },
  };
}
