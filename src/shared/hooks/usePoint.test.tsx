import { createElement, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PointService from '@/shared/services/pointService';
import { useAuth } from '@/context/authProvider';
import { pointKeys, usePointHistory } from './usePoint';

jest.mock('@/context/authProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/shared/services/pointService', () => ({
  __esModule: true,
  default: {
    getPointHistory: jest.fn(),
  },
}));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('usePointHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAuth).mockReturnValue({ user: { uid: 'user-1' } } as never);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('uses a user prefix for balance and history queries', () => {
    expect(pointKeys.all('user-1')).toEqual(['points', 'user-1']);
    expect(pointKeys.balance('user-1')).toEqual(['points', 'user-1', 'balance']);
    expect(pointKeys.history('user-1', 50)).toEqual(['points', 'user-1', 'history', 50]);
  });

  test('replaces the first page after its query prefix is invalidated', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const firstHistory = [{
      id: 'history-old',
      type: 'earn',
      amount: 1000,
      description: '이전 내역',
      date: new Date('2026-07-20T00:00:00.000Z'),
      balanceAfter: 1000,
    }];
    const refreshedHistory = [{
      id: 'history-new',
      type: 'use',
      amount: 500,
      description: '새 내역',
      date: new Date('2026-07-21T00:00:00.000Z'),
      balanceAfter: 500,
    }];
    jest.mocked(PointService.getPointHistory)
      .mockResolvedValueOnce({
        success: true,
        history: firstHistory,
        lastDoc: null,
        hasMore: false,
      } as never)
      .mockResolvedValueOnce({
        success: true,
        history: refreshedHistory,
        lastDoc: null,
        hasMore: false,
      } as never);

    const { result } = renderHook(() => usePointHistory(50), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.history).toEqual(firstHistory));

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: pointKeys.all('user-1') });
    });

    await waitFor(() => expect(result.current.history).toEqual(refreshedHistory));
    expect(PointService.getPointHistory).toHaveBeenCalledTimes(2);
  });
});
