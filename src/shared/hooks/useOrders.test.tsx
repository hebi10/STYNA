import { createElement, type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrderService } from '@/shared/services/orderService';
import { orderKeys, useOrders } from './useOrders';

jest.mock('@/shared/services/orderService', () => ({
  OrderService: {
    getUserOrders: jest.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useOrders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('uses a user prefix that invalidates every order list for that user', () => {
    expect(orderKeys.all('user-1')).toEqual(['orders', 'user-1']);
    expect(orderKeys.list('user-1', 50)).toEqual(['orders', 'user-1', 'list', 50]);
  });

  test('loads the requested user order list through React Query', async () => {
    const orders = [{ id: 'order-1' }];
    jest.mocked(OrderService.getUserOrders).mockResolvedValue(orders as never);

    const { result } = renderHook(() => useOrders('user-1', 50), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toEqual(orders));
    expect(OrderService.getUserOrders).toHaveBeenCalledWith('user-1', 50);
  });

  test('does not load orders without a user id', () => {
    const { result } = renderHook(() => useOrders(null, 50), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(OrderService.getUserOrders).not.toHaveBeenCalled();
  });
});
