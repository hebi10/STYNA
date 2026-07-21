import { getAuth } from 'firebase/auth';
import { updateDoc } from 'firebase/firestore';
import { OrderService } from './orderService';

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(() => ({ id: 'order-1' })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
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
});
