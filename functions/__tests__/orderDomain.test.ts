import {
  calculateCouponDiscount,
  calculateDeliveryFee,
  calculateDiscountedUnitPrice,
  aggregateProductQuantities,
  assertOrderableProductOption,
  markExpiredUserCoupon,
  normalizeItems,
  toTodayString,
} from '../src/domain/orderDomain';

describe('order domain logic', () => {
  test('groups duplicate order items by product option and keeps cart item ids', () => {
    const items = normalizeItems([
      { id: 'cart-1', productId: 'p1', size: 'M', color: 'black', quantity: 1 },
      { id: 'cart-2', productId: 'p1', size: 'M', color: 'black', quantity: 2 },
      { id: 'cart-3', productId: 'p1', size: 'L', color: 'black', quantity: 1 },
    ]);

    expect(items).toEqual([
      {
        productId: 'p1',
        size: 'M',
        color: 'black',
        quantity: 3,
        cartItemIds: ['cart-1', 'cart-2'],
      },
      {
        productId: 'p1',
        size: 'L',
        color: 'black',
        quantity: 1,
        cartItemIds: ['cart-3'],
      },
    ]);
  });

  test('rejects items without product id or positive quantity', () => {
    expect(() => normalizeItems([{ productId: '', quantity: 1 }])).toThrow('item.productId is required.');
    expect(() => normalizeItems([{ productId: 'p1', quantity: 0 }])).toThrow(
      'item.quantity must be greater than 0: p1'
    );
  });

  test('aggregates quantities by product while preserving separate options', () => {
    expect(aggregateProductQuantities([
      { productId: 'p1', size: 'M', color: 'black', quantity: 2, cartItemIds: [] },
      { productId: 'p1', size: 'L', color: 'black', quantity: 3, cartItemIds: [] },
    ])).toEqual([
      { productId: 'p1', quantity: 5 },
    ]);
  });

  test.each(['inactive', 'draft'])('rejects a product with %s sales status', (status) => {
    expect(() => assertOrderableProductOption(
      { status, sizes: [], colors: [] },
      { productId: 'p1', size: 'M', color: 'black', quantity: 1, cartItemIds: [] }
    )).toThrow('Product is not orderable: p1');
  });

  test('rejects options not declared by the product', () => {
    expect(() => assertOrderableProductOption(
      { status: 'active', sizes: ['S', 'M'], colors: ['black'] },
      { productId: 'p1', size: 'L', color: 'white', quantity: 1, cartItemIds: [] }
    )).toThrow('Invalid size option: L');

    expect(() => assertOrderableProductOption(
      { status: 'active', sizes: ['S', 'M'], colors: ['black'] },
      { productId: 'p1', size: 'M', color: 'white', quantity: 1, cartItemIds: [] }
    )).toThrow('Invalid color option: white');
  });

  test('allows legacy products without status or declared options', () => {
    expect(() => assertOrderableProductOption(
      { sizes: [], colors: [] },
      { productId: 'p1', size: 'M', color: 'black', quantity: 1, cartItemIds: [] }
    )).not.toThrow();
  });

  test('calculates discounted unit price within a valid price range', () => {
    expect(calculateDiscountedUnitPrice({ price: 10000, saleRate: 25 })).toBe(7500);
    expect(calculateDiscountedUnitPrice({ price: 10000, saleRate: 150 })).toBe(0);
    expect(calculateDiscountedUnitPrice({ price: 10000, saleRate: -10 })).toBe(10000);
  });

  test('does not discount price again when originalPrice is already higher than price', () => {
    expect(calculateDiscountedUnitPrice({
      price: 985000,
      originalPrice: 1250000,
      saleRate: 21,
    })).toBe(985000);
  });

  test('calculates coupon and delivery discounts', () => {
    expect(calculateCouponDiscount(10000, { type: 'percent', value: 15 })).toEqual({
      discount: 1500,
      freeShipping: false,
    });
    expect(calculateCouponDiscount(10000, { type: 'amount', value: 20000 })).toEqual({
      discount: 10000,
      freeShipping: false,
    });
    expect(calculateCouponDiscount(10000, { type: 'free_shipping', value: 0 })).toEqual({
      discount: 0,
      freeShipping: true,
    });

    expect(calculateDeliveryFee(50000, 'standard', false)).toBe(0);
    expect(calculateDeliveryFee(10000, 'standard', true)).toBe(0);
    expect(calculateDeliveryFee(10000, 'express', true)).toBe(5000);
  });

  test('creates order day keys at the KST midnight boundary', () => {
    expect(toTodayString(new Date('2026-07-20T14:59:59.999Z'))).toBe('2026-07-20');
    expect(toTodayString(new Date('2026-07-20T15:00:00.000Z'))).toBe('2026-07-21');
  });

  test('marks only an owned, available coupon whose master is still expired', async () => {
    const userCouponRef = { kind: 'user-coupon' };
    const couponRef = { kind: 'coupon' };
    const update = jest.fn();
    const transaction = {
      get: jest.fn(async (ref: unknown) => ref === userCouponRef
        ? {
            exists: true,
            data: () => ({ uid: 'user-1', couponId: 'coupon-1', status: '사용가능' }),
          }
        : {
            exists: true,
            data: () => ({ expiryDate: '2026-07-20' }),
          }),
      update,
    };
    const db = {
      collection: jest.fn((name: string) => ({
        doc: jest.fn(() => name === 'user_coupons' ? userCouponRef : couponRef),
      })),
      runTransaction: jest.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction)),
    };

    await markExpiredUserCoupon(db as never, {
      userCouponId: 'user-coupon-1',
      userId: 'user-1',
      now: new Date('2026-07-20T15:00:00.000Z'),
    });

    expect(update).toHaveBeenCalledWith(userCouponRef, expect.objectContaining({
      status: '기간만료',
      expiredDate: '2026-07-21',
    }));
  });

  test.each([
    ['a used coupon', { uid: 'user-1', couponId: 'coupon-1', status: '사용완료' }],
    ['another user coupon', { uid: 'user-2', couponId: 'coupon-1', status: '사용가능' }],
  ])('does not overwrite %s while marking expiry', async (_caseName, userCouponData) => {
    const userCouponRef = { kind: 'user-coupon' };
    const update = jest.fn();
    const transaction = {
      get: jest.fn().mockResolvedValue({ exists: true, data: () => userCouponData }),
      update,
    };
    const db = {
      collection: jest.fn(() => ({ doc: jest.fn(() => userCouponRef) })),
      runTransaction: jest.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction)),
    };

    await markExpiredUserCoupon(db as never, {
      userCouponId: 'user-coupon-1',
      userId: 'user-1',
      now: new Date('2026-07-20T15:00:00.000Z'),
    });

    expect(update).not.toHaveBeenCalled();
    expect(transaction.get).toHaveBeenCalledTimes(1);
  });

  test('does not mark a coupon when its master is no longer expired', async () => {
    const userCouponRef = { kind: 'user-coupon' };
    const couponRef = { kind: 'coupon' };
    const update = jest.fn();
    const transaction = {
      get: jest.fn(async (ref: unknown) => ref === userCouponRef
        ? {
            exists: true,
            data: () => ({ uid: 'user-1', couponId: 'coupon-1', status: '사용가능' }),
          }
        : {
            exists: true,
            data: () => ({ expiryDate: '2026-07-21' }),
          }),
      update,
    };
    const db = {
      collection: jest.fn((name: string) => ({
        doc: jest.fn(() => name === 'user_coupons' ? userCouponRef : couponRef),
      })),
      runTransaction: jest.fn((callback: (tx: typeof transaction) => unknown) => callback(transaction)),
    };

    await markExpiredUserCoupon(db as never, {
      userCouponId: 'user-coupon-1',
      userId: 'user-1',
      now: new Date('2026-07-21T14:59:59.999Z'),
    });

    expect(transaction.get).toHaveBeenCalledTimes(2);
    expect(update).not.toHaveBeenCalled();
  });
});
