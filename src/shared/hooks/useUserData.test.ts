import { createElement, type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { doc, getDoc } from 'firebase/firestore';
import {
  isUserDataNotFoundError,
  USER_DATA_NOT_FOUND_ERROR_CODE,
  UserDataNotFoundError,
  useUserData,
} from './useUserData';

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => ({ path: 'users/user-1' })),
  getDoc: jest.fn(),
}));

jest.mock('@/shared/libs/firebase/firebase', () => ({
  db: {},
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useUserData', () => {
  beforeEach(() => {
    jest.mocked(doc).mockClear();
    jest.mocked(getDoc).mockReset();
  });

  test('exposes a typed not-found error only when the user document does not exist', async () => {
    jest.mocked(getDoc).mockResolvedValue({
      exists: () => false,
    } as Awaited<ReturnType<typeof getDoc>>);

    const { result } = renderHook(() => useUserData('user-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(UserDataNotFoundError);
    });
    expect((result.current.error as UserDataNotFoundError).code)
      .toBe(USER_DATA_NOT_FOUND_ERROR_CODE);
    expect(isUserDataNotFoundError(result.current.error)).toBe(true);
    expect(doc).toHaveBeenCalledWith({}, 'users', 'user-1');
  });

  test('returns the existing user document data', async () => {
    const userData = { role: 'user', status: 'active', name: '테스트 사용자' };
    jest.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => userData,
    } as Awaited<ReturnType<typeof getDoc>>);

    const { result } = renderHook(() => useUserData('user-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).toEqual(userData));
    expect(result.current.error).toBeNull();
  });

  test('preserves generic Firestore read failures', async () => {
    const readError = new Error('firestore temporarily unavailable');
    jest.mocked(getDoc).mockRejectedValue(readError);

    const { result } = renderHook(() => useUserData('user-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.error).toBe(readError));
    expect(isUserDataNotFoundError(result.current.error)).toBe(false);
  });
});
