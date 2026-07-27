import { getAuth } from 'firebase/auth';
import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { OrderService } from './orderService';

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(() => ({ id: 'order-1' })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  getCountFromServer: jest.fn(),
  updateDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  serverTimestamp: jest.fn(() => 'server-time'),
}));

jest.mock('@/shared/libs/firebase/firebase', () => ({
  db: {},
}));

describe('OrderService.cancelOrder', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.mockReset();
    (global as typeof globalThis & { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    jest.mocked(getAuth).mockReturnValue({
      currentUser: {
        getIdToken: jest.fn().mockResolvedValue('id-token'),
      },
    } as unknown as ReturnType<typeof getAuth>);
    jest.mocked(updateDoc).mockReset();
  });

  it('routes customer cancellation through the order API', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { orderId: 'order-1', status: 'cancelled' } }),
    });

    await OrderService.cancelOrder('order-1', '고객 직접 취소');

    expect(fetchMock).toHaveBeenCalledWith('/api/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer id-token',
      },
      body: JSON.stringify({
        action: 'cancel',
        orderId: 'order-1',
        reason: '고객 직접 취소',
      }),
    });
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('does not expose an unused direct delivery update helper', () => {
    expect(OrderService).not.toHaveProperty('updateDeliveryInfo');
  });

  it('loads the newest user orders before applying the list limit', async () => {
    const collectionRef = { kind: 'orders-ref' };
    const userConstraint = { kind: 'user-filter' };
    const dateConstraint = { kind: 'created-desc' };
    const limitConstraint = { kind: 'limit-50' };
    jest.mocked(collection).mockReturnValue(collectionRef as never);
    jest.mocked(where).mockReturnValue(userConstraint as never);
    jest.mocked(orderBy).mockReturnValue(dateConstraint as never);
    jest.mocked(limit).mockReturnValue(limitConstraint as never);
    jest.mocked(query).mockReturnValue({ kind: 'orders-query' } as never);
    jest.mocked(getDocs).mockResolvedValue({ docs: [] } as never);

    await OrderService.getUserOrders('user-1', 50);

    expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(query).toHaveBeenCalledWith(
      collectionRef,
      userConstraint,
      dateConstraint,
      limitConstraint,
    );
  });

  it('counts every user order without applying the list limit', async () => {
    jest.mocked(getCountFromServer).mockResolvedValue({
      data: () => ({ count: 73 }),
    } as never);

    await expect(OrderService.getUserOrderCount('user-1')).resolves.toBe(73);
    expect(limit).not.toHaveBeenCalled();
  });
});
