import {
  documentId,
  getDoc,
  getDocs,
  updateDoc,
  where,
} from 'firebase/firestore';
import { CouponService } from './couponService';

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: null })),
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((db, name) => ({ kind: 'collection', name })),
  doc: jest.fn((db, collectionName, id) => ({ kind: 'doc', collectionName, id })),
  documentId: jest.fn(() => '__name__'),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  orderBy: jest.fn((field, direction) => ({ type: 'orderBy', field, direction })),
  query: jest.fn((...args) => ({ kind: 'query', args })),
  serverTimestamp: jest.fn(() => ({ kind: 'serverTimestamp' })),
  updateDoc: jest.fn(),
  where: jest.fn((field, op, value) => ({ type: 'where', field, op, value })),
}));

jest.mock('@/shared/libs/firebase/firebase', () => ({
  db: {},
}));

function timestamp(date: string) {
  return { toDate: () => new Date(date) };
}

function makeDoc(id: string, data: Record<string, unknown>) {
  return {
    id,
    data: () => data,
  };
}

describe('CouponService.getUserCoupons', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('loads coupon masters with a batched documentId in query', async () => {
    jest
      .mocked(getDocs)
      .mockResolvedValueOnce({
        docs: [
          makeDoc('user-coupon-1', {
            uid: 'user-1',
            couponId: 'coupon-1',
            status: '사용가능',
            issuedDate: '2026.06.01',
            createdAt: timestamp('2026-06-01T00:00:00.000Z'),
            updatedAt: timestamp('2026-06-01T00:00:00.000Z'),
          }),
          makeDoc('user-coupon-2', {
            uid: 'user-1',
            couponId: 'coupon-2',
            status: '사용가능',
            issuedDate: '2026.06.02',
            createdAt: timestamp('2026-06-02T00:00:00.000Z'),
            updatedAt: timestamp('2026-06-02T00:00:00.000Z'),
          }),
        ],
      } as unknown as Awaited<ReturnType<typeof getDocs>>)
      .mockResolvedValueOnce({
        docs: [
          makeDoc('coupon-1', {
            name: '첫 쿠폰',
            type: '할인금액',
            value: 1000,
            expiryDate: '2026.12.31',
            isActive: true,
            isDirectAssign: false,
            usageLimit: 100,
            usedCount: 0,
            createdAt: timestamp('2026-06-01T00:00:00.000Z'),
            updatedAt: timestamp('2026-06-01T00:00:00.000Z'),
          }),
          makeDoc('coupon-2', {
            name: '둘 쿠폰',
            type: '무료배송',
            value: 0,
            expiryDate: '2026.12.31',
            isActive: true,
            isDirectAssign: false,
            usageLimit: 100,
            usedCount: 0,
            createdAt: timestamp('2026-06-02T00:00:00.000Z'),
            updatedAt: timestamp('2026-06-02T00:00:00.000Z'),
          }),
        ],
      } as unknown as Awaited<ReturnType<typeof getDocs>>);

    const result = await CouponService.getUserCoupons('user-1', {
      sortBy: 'issuedDate',
      sortOrder: 'desc',
    });

    expect(result.map((item) => item.coupon.name)).toEqual(['둘 쿠폰', '첫 쿠폰']);
    expect(documentId).toHaveBeenCalled();
    expect(where).toHaveBeenCalledWith('__name__', 'in', ['coupon-2', 'coupon-1']);
    expect(getDoc).not.toHaveBeenCalled();
  });
});

describe('CouponService order availability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('filters by the KST expiry day without writing coupon status from the client', async () => {
    const coupon = {
      id: 'user-coupon-1',
      status: '사용가능',
      coupon: {
        minOrderAmount: 0,
        expiryDate: '2026-07-21',
      },
    };
    jest.spyOn(CouponService, 'getUserCoupons').mockResolvedValue([coupon] as never);

    jest.setSystemTime(new Date('2026-07-21T14:59:59.999Z'));
    await expect(CouponService.getAvailableCouponsForOrder('user-1', 10000)).resolves.toHaveLength(1);

    jest.setSystemTime(new Date('2026-07-21T15:00:00.000Z'));
    await expect(CouponService.getAvailableCouponsForOrder('user-1', 10000)).resolves.toHaveLength(0);
    expect(updateDoc).not.toHaveBeenCalled();
  });

  test('calculates remaining days from KST day keys', () => {
    jest.setSystemTime(new Date('2026-07-21T14:59:59.999Z'));
    expect(CouponService.getDaysUntilExpiry('2026-07-21')).toBe(0);

    jest.setSystemTime(new Date('2026-07-21T15:00:00.000Z'));
    expect(CouponService.getDaysUntilExpiry('2026-07-21')).toBe(-1);
  });
});
