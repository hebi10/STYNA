import {
  PRODUCT_INTENT_STORAGE_KEY,
  consumeProductIntent,
  saveProductIntent,
} from './productIntent';

function createStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

const intent = {
  action: 'cart' as const,
  productId: 'product-1',
  pathname: '/products/product-1',
  size: 'M',
  color: 'black',
  quantity: 2,
};

describe('product intent storage', () => {
  test('consumes a valid intent exactly once', () => {
    const storage = createStorage();

    saveProductIntent(storage, intent, 1_000);

    expect(consumeProductIntent(storage, 2_000)).toMatchObject({
      ok: true,
      intent: {
        ...intent,
        createdAt: 1_000,
      },
    });
    expect(consumeProductIntent(storage, 2_001)).toEqual({
      ok: false,
      reason: 'missing',
    });
  });

  test('removes an expired intent', () => {
    const storage = createStorage();

    saveProductIntent(storage, intent, 1_000);

    expect(consumeProductIntent(storage, 601_001)).toEqual({
      ok: false,
      reason: 'expired',
    });
    expect(storage.getItem(PRODUCT_INTENT_STORAGE_KEY)).toBeNull();
  });

  test.each([
    '{',
    JSON.stringify({ ...intent, quantity: 0, version: 1, createdAt: 1_000 }),
    JSON.stringify({ ...intent, action: 'unknown', version: 1, createdAt: 1_000 }),
  ])('removes malformed or invalid data before returning: %s', (rawValue) => {
    const storage = createStorage();
    storage.setItem(PRODUCT_INTENT_STORAGE_KEY, rawValue);

    expect(consumeProductIntent(storage, 2_000)).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(storage.getItem(PRODUCT_INTENT_STORAGE_KEY)).toBeNull();
  });
});
