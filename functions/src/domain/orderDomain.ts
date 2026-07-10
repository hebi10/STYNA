export type DeliveryOption = "standard" | "express";

export interface RawOrderItem {
  productId?: unknown;
  size?: unknown;
  color?: unknown;
  quantity?: unknown;
  id?: unknown;
}

export interface NormalizedOrderItem {
  productId: string;
  size: string;
  color: string;
  quantity: number;
  cartItemIds: string[];
}

export interface DeliveryAddress {
  id: string;
  name: string;
  recipient: string;
  phone: string;
  address: string;
  detailAddress: string;
  zipCode: string;
  isDefault: boolean;
}

interface CartItemSummary {
  quantity?: unknown;
  price?: unknown;
}

const DEFAULT_STANDARD_DELIVERY_FEE = 3000;
const DEFAULT_EXPRESS_DELIVERY_FEE = 5000;
const STANDARD_SHIPPING_FREE_AMOUNT = 50000;

const VALID_PAYMENT_METHODS = new Set([
  "card",
  "bank",
  "virtual",
  "phone",
  "cash",
  "card_transfer",
  "bank_transfer",
  "virtual_account",
  "point",
]);

const COUPON_PERCENT_TYPES = ["퍼센트", "percent", "할인율"];
const COUPON_AMOUNT_TYPES = ["금액", "amount", "할인금액"];
const COUPON_FREE_SHIPPING_TYPES = ["무료배송", "free_shipping"];

export function toStringValue(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  return "";
}

export function toNonNegativeInteger(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) {
    return 0;
  }
  return Math.max(0, Math.floor(num));
}

export function toNumber(value: unknown, fallback = 0): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return num;
}

export function normalizePaymentMethod(value: unknown): string {
  const method = toStringValue(value);
  return method && VALID_PAYMENT_METHODS.has(method) ? method : "card";
}

export function normalizeDeliveryOption(value: unknown): DeliveryOption {
  const option = toStringValue(value);
  return option === "express" ? "express" : "standard";
}

export function parseDeliveryAddress(value: unknown): DeliveryAddress {
  if (!value || typeof value !== "object") {
    throw new Error("deliveryAddress is required.");
  }

  const payload = value as Record<string, unknown>;
  const address: DeliveryAddress = {
    id: toStringValue(payload.id),
    name: toStringValue(payload.name),
    recipient: toStringValue(payload.recipient),
    phone: toStringValue(payload.phone),
    address: toStringValue(payload.address),
    detailAddress: toStringValue(payload.detailAddress),
    zipCode: toStringValue(payload.zipCode),
    isDefault: payload.isDefault === true,
  };

  if (!address.id || !address.name || !address.recipient || !address.phone || !address.address || !address.zipCode) {
    throw new Error("deliveryAddress is required.");
  }

  return address;
}

export function parseItems(rawItems: unknown): RawOrderItem[] {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return [];
  }

  return rawItems.filter((item): item is RawOrderItem => !!item && typeof item === "object");
}

export function normalizeItems(rawItems: RawOrderItem[]): NormalizedOrderItem[] {
  const groupedItems = new Map<string, NormalizedOrderItem>();

  for (const rawItem of rawItems) {
    const productId = toStringValue(rawItem.productId);
    if (!productId) {
      throw new Error("item.productId is required.");
    }

    const size = toStringValue(rawItem.size) || "default";
    const color = toStringValue(rawItem.color) || "default";
    const quantity = toNonNegativeInteger(rawItem.quantity);
    if (quantity <= 0) {
      throw new Error(`item.quantity must be greater than 0: ${productId}`);
    }

    const itemId = toStringValue(rawItem.id) || `${productId}-${size}-${color}`;
    const key = `${productId}|${size}|${color}`;

    const current = groupedItems.get(key);
    if (current) {
      current.quantity += quantity;
      if (!current.cartItemIds.includes(itemId)) {
        current.cartItemIds.push(itemId);
      }
      continue;
    }

    groupedItems.set(key, {
      productId,
      size,
      color,
      quantity,
      cartItemIds: [itemId],
    });
  }

  return Array.from(groupedItems.values());
}

export function aggregateProductQuantities<T extends Pick<RawOrderItem, "productId" | "quantity">>(
  items: ReadonlyArray<T>
): Array<{ productId: string; quantity: number }> {
  const quantities = new Map<string, number>();

  for (const item of items) {
    const productId = toStringValue(item.productId);
    const quantity = toNonNegativeInteger(item.quantity);
    if (!productId || quantity <= 0) {
      continue;
    }

    quantities.set(productId, (quantities.get(productId) || 0) + quantity);
  }

  return Array.from(quantities, ([productId, quantity]) => ({ productId, quantity }));
}

export function assertOrderableProductOption(
  productData: Record<string, unknown>,
  item: NormalizedOrderItem
): void {
  const status = toStringValue(productData.status);
  if (status && status !== "active") {
    throw new Error(`Product is not orderable: ${item.productId}`);
  }

  const sizes = Array.isArray(productData.sizes)
    ? productData.sizes.map(toStringValue).filter(Boolean)
    : [];
  if (sizes.length > 0 && !sizes.includes(item.size)) {
    throw new Error(`Invalid size option: ${item.size}`);
  }

  const colors = Array.isArray(productData.colors)
    ? productData.colors.map(toStringValue).filter(Boolean)
    : [];
  if (colors.length > 0 && !colors.includes(item.color)) {
    throw new Error(`Invalid color option: ${item.color}`);
  }
}

export function parseDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return value;
  }

  if (value && typeof value === "object" && "toDate" in value) {
    const maybeDate = (value as { toDate: () => Date }).toDate();
    return maybeDate instanceof Date && Number.isFinite(maybeDate.getTime()) ? maybeDate : null;
  }

  const date = new Date(toStringValue(value));
  return Number.isFinite(date.getTime()) ? date : null;
}

export function toTodayString(value: Date): string {
  return value.toISOString().split("T")[0];
}

export function calculateDiscountedUnitPrice(productData: Record<string, unknown>): number {
  const price = toNumber(productData.price, 0);
  if (!Number.isFinite(price) || price <= 0) {
    return 0;
  }

  const originalPrice = toNumber(productData.originalPrice, 0);
  if (originalPrice > price) {
    return price;
  }

  const saleRate = toNumber(productData.saleRate, 0);
  const discountRate = Math.max(0, Math.min(100, saleRate));
  const discounted = Math.floor(price * (1 - discountRate / 100));
  return Math.max(0, Math.min(price, discounted));
}

export function calculateCouponDiscount(totalAmount: number, couponData: Record<string, unknown>): {
  discount: number;
  freeShipping: boolean;
} {
  const couponType = toStringValue(couponData.type);
  const couponValue = toNumber(couponData.value, 0);

  if (COUPON_PERCENT_TYPES.includes(couponType)) {
    return {
      discount: Math.floor(totalAmount * Math.min(100, Math.max(0, couponValue)) / 100),
      freeShipping: false,
    };
  }

  if (COUPON_AMOUNT_TYPES.includes(couponType)) {
    return {
      discount: Math.min(totalAmount, Math.max(0, couponValue)),
      freeShipping: false,
    };
  }

  return {
    discount: 0,
    freeShipping: COUPON_FREE_SHIPPING_TYPES.includes(couponType),
  };
}

export function calculateDeliveryFee(
  totalAfterCoupon: number,
  deliveryOption: DeliveryOption,
  couponFreeShipping: boolean
): number {
  if (deliveryOption === "express") {
    return DEFAULT_EXPRESS_DELIVERY_FEE;
  }

  if (totalAfterCoupon >= STANDARD_SHIPPING_FREE_AMOUNT || couponFreeShipping) {
    return 0;
  }

  return DEFAULT_STANDARD_DELIVERY_FEE;
}

export function mapCartTotal(items: Array<Record<string, unknown> | CartItemSummary>): {
  totalAmount: number;
  totalItems: number;
} {
  let totalAmount = 0;
  let totalItems = 0;

  for (const item of items) {
    const data = item as Record<string, unknown>;
    const quantity = toNonNegativeInteger(data.quantity);
    const price = toNumber(data.price, 0);
    totalAmount += quantity * price;
    totalItems += quantity;
  }

  return { totalAmount, totalItems };
}
