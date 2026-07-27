const updateDoc = jest.fn();
const deleteFieldValue = { kind: 'delete-field' };
const deleteField = jest.fn(() => deleteFieldValue);
const getAuth = jest.fn();
const timestamp = { seconds: 1, nanoseconds: 0 };

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn((_db, collectionName, id) => ({ collectionName, id })),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  addDoc: jest.fn(),
  updateDoc,
  deleteDoc: jest.fn(),
  deleteField,
  documentId: jest.fn(() => '__name__'),
  limit: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  Timestamp: {
    now: jest.fn(() => timestamp),
    fromDate: jest.fn((value) => value),
  },
  writeBatch: jest.fn(),
}));

jest.mock('firebase/storage', () => ({
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
  deleteObject: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
  getAuth,
}));

jest.mock('../libs/firebase/firebase', () => ({
  db: { name: 'db' },
  storage: { name: 'storage' },
}));

jest.mock('../libs/firebase/imageOptimization', () => ({
  getImageUploadMetadata: jest.fn(),
  getOptimizedWebpStorageFileName: jest.fn(),
  optimizeImageForUpload: jest.fn(),
}));

import { EventParticipationError, EventService } from './eventService';
import { documentId, getDoc, getDocs, orderBy, where } from 'firebase/firestore';

describe('EventService conditional policy fields', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    getAuth.mockReturnValue({
      currentUser: {
        getIdToken: jest.fn().mockResolvedValue('user-token'),
      },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('queries public events through both verified and active publication gates', async () => {
    jest.mocked(getDocs).mockResolvedValue({ docs: [] } as never);

    await EventService.getPublicEvents({ eventType: 'sale', isActive: true });

    expect(where).toHaveBeenCalledTimes(2);
    expect(where).toHaveBeenCalledWith('publicPolicyVerified', '==', true);
    expect(where).toHaveBeenCalledWith('isActive', '==', true);
    expect(orderBy).not.toHaveBeenCalled();
  });

  test('queries public event detail by id and both publication gates', async () => {
    jest.mocked(getDoc).mockResolvedValue({ exists: () => false } as never);
    jest.mocked(getDocs).mockResolvedValue({ docs: [] } as never);

    await expect(EventService.getPublicEventById('event-1')).resolves.toBeNull();

    expect(getDoc).not.toHaveBeenCalled();
    expect(documentId).toHaveBeenCalledTimes(1);
    expect(where).toHaveBeenCalledWith('__name__', '==', 'event-1');
    expect(where).toHaveBeenCalledWith('publicPolicyVerified', '==', true);
    expect(where).toHaveBeenCalledWith('isActive', '==', true);
  });

  test('keeps public detail query failures distinct from an empty result', async () => {
    const upstreamError = new Error('firestore unavailable');
    jest.mocked(getDocs).mockRejectedValue(upstreamError);

    await expect(EventService.getPublicEventById('event-1')).rejects.toBe(upstreamError);
  });

  test.each(['permission-denied', 'firestore/permission-denied'])(
    'normalizes Firebase %s to null for a hidden or missing public event',
    async (code) => {
      jest.mocked(getDocs).mockRejectedValue({ code });

      await expect(EventService.getPublicEventById('event-1')).resolves.toBeNull();
    }
  );

  test.each(['unavailable', 'failed-precondition'])(
    'propagates Firebase %s failures from public event detail',
    async (code) => {
      const upstreamError = { code };
      jest.mocked(getDocs).mockRejectedValue(upstreamError);

      await expect(EventService.getPublicEventById('event-1')).rejects.toBe(upstreamError);
    }
  );

  test('keeps unverified event listing in an explicit admin-only method', async () => {
    jest.mocked(getDocs).mockResolvedValue({ docs: [] } as never);

    await EventService.getAdminEvents({ eventType: 'sale', isActive: true });

    expect(where).toHaveBeenCalledWith('eventType', '==', 'sale');
    expect(where).toHaveBeenCalledWith('isActive', '==', true);
    expect(where).not.toHaveBeenCalledWith('publicPolicyVerified', '==', true);
    expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
  });

  test('propagates admin active-event query failures instead of returning an empty dashboard', async () => {
    const upstreamError = { code: 'permission-denied' };
    jest.mocked(getDocs).mockRejectedValue(upstreamError);

    await expect(EventService.getAdminActiveEvents()).rejects.toBe(upstreamError);
  });

  test('deletes stale target and coupon fields when an event is changed to none', async () => {
    await EventService.updateEvent('event-1', {
      eligibilityType: 'none',
      rewardType: 'none',
    });

    expect(updateDoc).toHaveBeenCalledWith(
      { collectionName: 'events', id: 'event-1' },
      expect.objectContaining({
        eligibilityType: 'none',
        rewardType: 'none',
        targetProducts: deleteFieldValue,
        rewardCouponId: deleteFieldValue,
        updatedAt: timestamp,
      })
    );
    expect(deleteField).toHaveBeenCalledTimes(2);
  });

  test('keeps configured evidence and coupon fields', async () => {
    await EventService.updateEvent('event-1', {
      eligibilityType: 'review',
      rewardType: 'coupon',
      targetProducts: ['product-1'],
      rewardCouponId: 'coupon-1',
    });

    expect(updateDoc).toHaveBeenCalledWith(
      { collectionName: 'events', id: 'event-1' },
      expect.objectContaining({
        targetProducts: ['product-1'],
        rewardCouponId: 'coupon-1',
      })
    );
    expect(deleteField).not.toHaveBeenCalled();
  });

  test.each([
    ['event_misconfigured', '이벤트 참여 조건이 올바르게 설정되지 않았습니다. 잠시 후 다시 확인해주세요.'],
    ['ineligible_purchase', '대상 상품을 다시 선택하거나 구매 내역을 확인해주세요.'],
    ['ineligible_delivered', '대상 상품을 다시 선택하거나 배송 완료 후 참여해주세요.'],
    ['ineligible_review', '대상 상품과 옵션을 다시 선택해 구매 인증 리뷰를 작성해주세요.'],
  ] as const)(
    'maps stable participation code %s to a Korean recovery message',
    async (code, expectedMessage) => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue({
          success: false,
          code,
          error: 'untrusted upstream text',
        }),
      });
      const originalFetch = global.fetch;
      global.fetch = fetchMock as never;

      try {
        await expect(EventService.participateInEvent('event-1')).rejects.toEqual(
          expect.objectContaining<Pick<EventParticipationError, 'code' | 'message'>>({
            code,
            message: expectedMessage,
          })
        );
      } finally {
        global.fetch = originalFetch;
      }
    }
  );
});
