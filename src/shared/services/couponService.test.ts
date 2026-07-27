import {
  documentId,
  getDoc,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
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
  getCountFromServer: jest.fn(),
  getDocs: jest.fn(),
  limit: jest.fn((count) => ({ type: 'limit', count })),
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

  test('applies the coupon-master type filter before the requested result limit', async () => {
    jest.mocked(getDocs)
      .mockResolvedValueOnce({
        docs: [
          makeDoc('user-coupon-1', { uid: 'user-1', couponId: 'amount', issuedDate: '2026.07.02' }),
          makeDoc('user-coupon-2', { uid: 'user-1', couponId: 'shipping', issuedDate: '2026.07.01' }),
        ],
      } as unknown as Awaited<ReturnType<typeof getDocs>>)
      .mockResolvedValueOnce({
        docs: [
          makeDoc('amount', { name: '금액', type: '할인금액' }),
          makeDoc('shipping', { name: '배송', type: '무료배송' }),
        ],
      } as unknown as Awaited<ReturnType<typeof getDocs>>);

    const result = await CouponService.getUserCoupons('user-1', { type: '무료배송' }, 1);

    expect(result.map((coupon) => coupon.couponId)).toEqual(['shipping']);
  });
});

describe('CouponService.getUserCouponOverview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getCountFromServer).mockReset();
    jest.mocked(getDocs).mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('builds the coupon list and statistics from one user-coupon snapshot', async () => {
    jest.mocked(getCountFromServer).mockResolvedValue({
      data: () => ({ count: 3 }),
    } as unknown as Awaited<ReturnType<typeof getCountFromServer>>);
    jest.mocked(getDocs)
      .mockResolvedValueOnce({
        docs: [
          makeDoc('user-available', {
            uid: 'user-1', couponId: 'available', status: '사용가능', issuedDate: '2026.07.03',
          }),
          makeDoc('user-used', {
            uid: 'user-1', couponId: 'used', status: '사용완료', issuedDate: '2026.07.02',
          }),
          makeDoc('user-expired', {
            uid: 'user-1', couponId: 'expired', status: '기간만료', issuedDate: '2026.07.01',
          }),
        ],
      } as unknown as Awaited<ReturnType<typeof getDocs>>)
      .mockResolvedValueOnce({
        docs: ['available', 'used', 'expired'].map((id) => makeDoc(id, {
          name: id,
          type: '할인금액',
          value: 1000,
          expiryDate: '2026.12.31',
          isActive: true,
          isDirectAssign: false,
          usageLimit: 100,
          usedCount: 0,
        })),
      } as unknown as Awaited<ReturnType<typeof getDocs>>);

    const result = await CouponService.getUserCouponOverview('user-1');

    expect(result.stats).toEqual({
      total: 3,
      available: 1,
      used: 1,
      expired: 1,
    });
    expect(result.isTruncated).toBe(false);
    expect(result.coupons.map((coupon) => coupon.couponId)).toEqual([
      'available',
      'used',
      'expired',
    ]);
    expect(getDocs).toHaveBeenCalledTimes(2);
    expect(where).toHaveBeenCalledWith('uid', '==', 'user-1');
  });

  test('rejects the overview when its shared user-coupon snapshot fails', async () => {
    jest.mocked(getCountFromServer).mockRejectedValue(new Error('snapshot unavailable'));

    await expect(CouponService.getUserCouponOverview('user-1')).rejects.toThrow(
      '쿠폰 목록을 불러오는데 실패했습니다.',
    );
  });

  test('reads the user-coupon list even when the earlier aggregate count is zero', async () => {
    jest.mocked(getCountFromServer).mockResolvedValue({ data: () => ({ count: 0 }) } as never);
    jest.mocked(getDocs)
      .mockResolvedValueOnce({
        docs: [makeDoc('issued-after-count', {
          uid: 'user-1',
          couponId: 'welcome',
          status: '사용가능',
          issuedDate: '2026-07-21',
          createdAt: timestamp('2026-07-21T00:00:00.000Z'),
        })],
      } as never)
      .mockResolvedValueOnce({
        docs: [makeDoc('welcome', { name: '환영 쿠폰', type: '할인금액' })],
      } as never);

    const result = await CouponService.getUserCouponOverview('user-1');

    expect(result.stats).toEqual({ total: 1, available: 1, used: 0, expired: 0 });
    expect(result.coupons).toHaveLength(1);
    expect(result.isTruncated).toBe(false);
  });

  test('marks a small-count overview as truncated when its list snapshot contains more than 50 records', async () => {
    jest.mocked(getCountFromServer).mockResolvedValue({ data: () => ({ count: 50 }) } as never);
    const records = Array.from({ length: 51 }, (_, index) => makeDoc(`user-${index}`, {
      uid: 'user-1',
      couponId: 'shared',
      status: '사용가능',
      issuedDate: `2026.07.${String((index % 28) + 1).padStart(2, '0')}`,
      createdAt: timestamp(`2026-07-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`),
    }));
    jest.mocked(getDocs)
      .mockResolvedValueOnce({ docs: records } as never)
      .mockResolvedValueOnce({
        docs: [makeDoc('shared', { name: '공통 쿠폰', type: '할인금액' })],
      } as never);

    const result = await CouponService.getUserCouponOverview('user-1');

    expect(result.stats).toEqual({ total: 51, available: 51, used: 0, expired: 0 });
    expect(result.coupons).toHaveLength(50);
    expect(result.isTruncated).toBe(true);
  });

  test('limits the recurring overview read and uses aggregate status counts for large histories', async () => {
    jest.mocked(getCountFromServer)
      .mockResolvedValueOnce({ data: () => ({ count: 75 }) } as never)
      .mockResolvedValueOnce({ data: () => ({ count: 40 }) } as never)
      .mockResolvedValueOnce({ data: () => ({ count: 20 }) } as never)
      .mockResolvedValueOnce({ data: () => ({ count: 15 }) } as never);
    jest.mocked(getDocs)
      .mockResolvedValueOnce({
        docs: [makeDoc('user-recent', {
          uid: 'user-1', couponId: 'recent', status: '사용가능', issuedDate: '2026.07.21',
        })],
      } as unknown as Awaited<ReturnType<typeof getDocs>>)
      .mockResolvedValueOnce({
        docs: [makeDoc('recent', { name: '최근 쿠폰', type: '할인금액' })],
      } as unknown as Awaited<ReturnType<typeof getDocs>>);

    const result = await CouponService.getUserCouponOverview('user-1');

    expect(result).toMatchObject({
      stats: { total: 75, available: 40, used: 20, expired: 15 },
      isTruncated: true,
    });
    expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(orderBy).not.toHaveBeenCalledWith('issuedDate', 'desc');
    expect(limit).toHaveBeenCalledWith(50);
    expect(getCountFromServer).toHaveBeenCalledTimes(4);
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
