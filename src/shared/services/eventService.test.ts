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
