export const PRODUCT_INTENT_STORAGE_KEY = 'hebimall:product-intent';
export const PRODUCT_INTENT_VERSION = 1;
export const PRODUCT_INTENT_TTL_MS = 10 * 60 * 1000;

export type ProductIntentAction = 'cart' | 'buy' | 'wishlist';

export interface ProductIntentDraft {
  action: ProductIntentAction;
  productId: string;
  pathname: string;
  size: string;
  color: string;
  quantity: number;
}

export interface ProductIntent extends ProductIntentDraft {
  version: typeof PRODUCT_INTENT_VERSION;
  createdAt: number;
}

export type ProductIntentResult =
  | { ok: true; intent: ProductIntent }
  | { ok: false; reason: 'missing' | 'invalid' | 'expired' };

type ProductIntentStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function isProductIntent(value: unknown): value is ProductIntent {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ProductIntent>;

  return candidate.version === PRODUCT_INTENT_VERSION
    && ['cart', 'buy', 'wishlist'].includes(candidate.action ?? '')
    && typeof candidate.productId === 'string'
    && candidate.productId.trim().length > 0
    && typeof candidate.pathname === 'string'
    && candidate.pathname.startsWith('/')
    && !candidate.pathname.startsWith('//')
    && !candidate.pathname.includes('\\')
    && typeof candidate.size === 'string'
    && typeof candidate.color === 'string'
    && Number.isInteger(candidate.quantity)
    && (candidate.quantity ?? 0) > 0
    && typeof candidate.createdAt === 'number'
    && Number.isFinite(candidate.createdAt);
}

export function saveProductIntent(
  storage: ProductIntentStorage,
  draft: ProductIntentDraft,
  nowMs = Date.now(),
): boolean {
  const intent: ProductIntent = {
    ...draft,
    version: PRODUCT_INTENT_VERSION,
    createdAt: nowMs,
  };

  if (!isProductIntent(intent)) {
    return false;
  }

  try {
    storage.setItem(PRODUCT_INTENT_STORAGE_KEY, JSON.stringify(intent));
    return true;
  } catch {
    return false;
  }
}

export function consumeProductIntent(
  storage: ProductIntentStorage,
  nowMs = Date.now(),
): ProductIntentResult {
  let rawValue: string | null;

  try {
    rawValue = storage.getItem(PRODUCT_INTENT_STORAGE_KEY);
    if (rawValue === null) {
      return { ok: false, reason: 'missing' };
    }

    storage.removeItem(PRODUCT_INTENT_STORAGE_KEY);
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  if (!isProductIntent(parsed) || parsed.createdAt > nowMs) {
    return { ok: false, reason: 'invalid' };
  }

  if (nowMs - parsed.createdAt > PRODUCT_INTENT_TTL_MS) {
    return { ok: false, reason: 'expired' };
  }

  return { ok: true, intent: parsed };
}
