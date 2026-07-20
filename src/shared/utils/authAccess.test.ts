import { createElement } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { doc, getDoc } from 'firebase/firestore';
import {
  AUTH_ACCESS_CHANGED_EVENT,
  hasActiveAccount,
  hasStrictAdminAccess,
  notifyAuthAccessChanged,
} from './authAccess';
import { AuthProvider, useAuth } from '@/context/authProvider';
import { useAuthUser } from '@/shared/hooks/useAuthUser';
import { useUserData } from '@/shared/hooks/useUserData';
import {
  loginOneSession,
  loginKeepAlive,
  logout,
  signUp,
} from '@/shared/libs/firebase/auth';

const replaceMock = jest.fn();

function createUserDataNotFoundError() {
  return Object.assign(new Error('User not found'), {
    name: 'UserDataNotFoundError',
    code: 'USER_DATA_NOT_FOUND',
  });
}

jest.mock('next/navigation', () => ({
  usePathname: () => '/auth/login',
  useRouter: () => ({ replace: replaceMock }),
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
}));

jest.mock('@/shared/hooks/useAuthUser', () => ({
  useAuthUser: jest.fn(),
}));

jest.mock('@/shared/hooks/useUserData', () => ({
  ...jest.requireActual('@/shared/hooks/useUserData'),
  useUserData: jest.fn(),
}));

jest.mock('@/shared/libs/firebase/auth', () => ({
  loginOneSession: jest.fn(),
  loginKeepAlive: jest.fn(),
  logout: jest.fn(),
  signUp: jest.fn(),
}));

jest.mock('@/shared/libs/firebase/firebase', () => ({
  db: {},
}));

describe('authAccess', () => {
  test('accepts only an existing active user document', () => {
    expect(hasActiveAccount({ status: 'active' })).toBe(true);
    expect(hasActiveAccount(null)).toBe(false);
    expect(hasActiveAccount(undefined)).toBe(false);
    expect(hasActiveAccount({})).toBe(false);
    expect(hasActiveAccount({ status: 'inactive' })).toBe(false);
    expect(hasActiveAccount({ status: 'banned' })).toBe(false);
    expect(hasActiveAccount({ status: 'deleted' })).toBe(false);
  });

  test.each([
    [{ admin: true }, { role: 'admin', status: 'inactive' }],
    [{ admin: true }, { role: 'user', status: 'active' }],
    [{ role: 'admin' }, { role: 'admin', status: 'deleted' }],
    [{}, { role: 'admin', status: 'active' }],
    [{ admin: true }, null],
  ])('rejects strict admin access when any required condition is missing', (claims, userData) => {
    expect(hasStrictAdminAccess(claims, userData)).toBe(false);
  });

  test('accepts admin boolean and role claims only with an active admin document', () => {
    const activeAdmin = { role: 'admin', status: 'active' };

    expect(hasStrictAdminAccess({ admin: true }, activeAdmin)).toBe(true);
    expect(hasStrictAdminAccess({ role: 'admin' }, activeAdmin)).toBe(true);
  });

  test('publishes the changed user id for immediate auth access re-evaluation', () => {
    const eventListener = jest.fn();
    window.addEventListener(AUTH_ACCESS_CHANGED_EVENT, eventListener);

    notifyAuthAccessChanged('admin-1');

    expect(eventListener).toHaveBeenCalledTimes(1);
    expect((eventListener.mock.calls[0][0] as CustomEvent<{ userId: string }>).detail).toEqual({
      userId: 'admin-1',
    });
    window.removeEventListener(AUTH_ACCESS_CHANGED_EVENT, eventListener);
  });
});

describe('AuthProvider access enforcement', () => {
  let authContext: ReturnType<typeof useAuth> | null;

  function ContextProbe() {
    authContext = useAuth();
    return null;
  }

  function providerTree(queryClient: QueryClient) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(AuthProvider, null, createElement(ContextProbe))
    );
  }

  function renderProvider(queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })) {
    return {
      queryClient,
      ...render(providerTree(queryClient)),
    };
  }

  beforeEach(() => {
    authContext = null;
    replaceMock.mockReset();
    jest.mocked(useAuthUser).mockReturnValue({ user: null, loading: false });
    jest.mocked(useUserData).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });
    jest.mocked(loginOneSession).mockReset();
    jest.mocked(loginKeepAlive).mockReset();
    jest.mocked(logout).mockReset().mockResolvedValue(undefined);
    jest.mocked(signUp).mockReset();
    jest.mocked(doc).mockReset();
    jest.mocked(getDoc).mockReset();
  });

  test('logs out and rejects login when the user document is missing', async () => {
    jest.mocked(loginOneSession).mockResolvedValue({
      user: { uid: 'missing-user' },
    } as Awaited<ReturnType<typeof loginOneSession>>);
    jest.mocked(getDoc).mockResolvedValue({
      exists: () => false,
    } as Awaited<ReturnType<typeof getDoc>>);
    renderProvider();

    await act(async () => {
      await expect(authContext!.login('missing@example.com', 'password', false))
        .rejects.toThrow('ACCOUNT_UNAVAILABLE');
    });

    expect(logout).toHaveBeenCalledTimes(1);
  });

  test('logs out and preserves the error when the user document check fails after sign-in', async () => {
    const readError = new Error('firestore unavailable');
    jest.mocked(loginOneSession).mockResolvedValue({
      user: { uid: 'user-1' },
    } as Awaited<ReturnType<typeof loginOneSession>>);
    jest.mocked(getDoc).mockRejectedValue(readError);
    renderProvider();

    await act(async () => {
      await expect(authContext!.login('user@example.com', 'password', false))
        .rejects.toBe(readError);
    });

    expect(logout).toHaveBeenCalledTimes(1);
  });

  test.each([
    [
      'inactive cache',
      { data: { role: 'user', status: 'inactive' }, isLoading: false, error: null },
    ],
    [
      'typed not-found error',
      { data: undefined, isLoading: false, error: createUserDataNotFoundError() },
    ],
  ])(
    'defers stale account enforcement during login validation (%s)',
    async (_caseName, staleUserQuery) => {
      const user = {
        uid: 'user-1',
        getIdTokenResult: jest.fn().mockResolvedValue({ claims: {} }),
      };
      const activeAccount = { role: 'user', status: 'active' };
      let resolveUserDocument: ((snapshot: Awaited<ReturnType<typeof getDoc>>) => void) | undefined;
      jest.mocked(loginOneSession).mockResolvedValue(
        { user } as unknown as Awaited<ReturnType<typeof loginOneSession>>
      );
      jest.mocked(getDoc).mockImplementation(() => new Promise((resolve) => {
        resolveUserDocument = resolve;
      }));
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      if (staleUserQuery.data) {
        queryClient.setQueryData(['user', 'user-1'], staleUserQuery.data);
      }
      const setQueryData = jest.spyOn(queryClient, 'setQueryData');
      const rendered = renderProvider(queryClient);

      let loginPromise: Promise<unknown>;
      act(() => {
        loginPromise = authContext!.login('user@example.com', 'password', false);
      });
      await waitFor(() => expect(getDoc).toHaveBeenCalled());

      jest.mocked(useAuthUser).mockReturnValue(
        { user, loading: false } as unknown as ReturnType<typeof useAuthUser>
      );
      jest.mocked(useUserData).mockReturnValue(staleUserQuery);
      rendered.rerender(providerTree(queryClient));
      await act(async () => Promise.resolve());
      const logoutCallsWhilePending = jest.mocked(logout).mock.calls.length;

      resolveUserDocument!({
        exists: () => true,
        data: () => activeAccount,
      } as Awaited<ReturnType<typeof getDoc>>);
      jest.mocked(useUserData).mockReturnValue({
        data: activeAccount,
        isLoading: false,
        error: null,
      });
      await act(async () => {
        await loginPromise!;
      });
      act(() => {
        rendered.rerender(providerTree(queryClient));
      });
      await waitFor(() => expect(user.getIdTokenResult).toHaveBeenCalledTimes(1));

      expect(logoutCallsWhilePending).toBe(0);
      expect(setQueryData).toHaveBeenCalledWith(['user', 'user-1'], activeAccount);
      expect(logout).not.toHaveBeenCalled();
    }
  );

  test.each(['inactive', 'banned', 'deleted', undefined])(
    'logs out and rejects login for a non-active status (%s)',
    async (status) => {
      jest.mocked(loginOneSession).mockResolvedValue({
        user: { uid: 'blocked-user' },
      } as Awaited<ReturnType<typeof loginOneSession>>);
      jest.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({ status }),
      } as Awaited<ReturnType<typeof getDoc>>);
      renderProvider();

      await act(async () => {
        await expect(authContext!.login('blocked@example.com', 'password', false))
          .rejects.toThrow();
      });

      expect(logout).toHaveBeenCalledTimes(1);
    }
  );

  test('does not grant admin access from a claim unless the active document is also admin', async () => {
    const user = {
      uid: 'admin-1',
      getIdTokenResult: jest.fn().mockResolvedValue({ claims: { admin: true } }),
    };
    jest.mocked(useAuthUser).mockReturnValue(
      { user, loading: false } as unknown as ReturnType<typeof useAuthUser>
    );
    jest.mocked(useUserData).mockReturnValue({
      data: { role: 'user', status: 'active' },
      isLoading: false,
      error: null,
    });

    renderProvider();

    await waitFor(() => expect(user.getIdTokenResult).toHaveBeenCalledWith(true));
    expect(authContext!.isAdmin).toBe(false);
  });

  test('invalidates the current user document when an access change is published', async () => {
    const user = {
      uid: 'admin-1',
      getIdTokenResult: jest.fn().mockResolvedValue({ claims: { admin: true } }),
    };
    jest.mocked(useAuthUser).mockReturnValue(
      { user, loading: false } as unknown as ReturnType<typeof useAuthUser>
    );
    jest.mocked(useUserData).mockReturnValue({
      data: { role: 'admin', status: 'active' },
      isLoading: false,
      error: null,
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
    renderProvider(queryClient);

    await waitFor(() => expect(authContext!.isAdmin).toBe(true));

    act(() => notifyAuthAccessChanged('admin-1'));

    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['user', 'admin-1'] });
      expect(authContext!.isAdmin).toBe(false);
    });
  });

  test('does not log out while the signup profile callback is still provisioning a missing document', async () => {
    const user = {
      uid: 'new-user',
      getIdTokenResult: jest.fn().mockResolvedValue({ claims: {} }),
    };
    jest.mocked(signUp).mockResolvedValue(
      { user } as unknown as Awaited<ReturnType<typeof signUp>>
    );
    let finishProfile: (() => void) | undefined;
    const profileCallback = jest.fn(() => new Promise<void>((resolve) => {
      finishProfile = resolve;
    }));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');
    const refetchQueries = jest.spyOn(queryClient, 'refetchQueries');
    const rendered = renderProvider(queryClient);
    const signUpWithProfile = authContext!.signUp as unknown as (
      email: string,
      password: string,
      createProfile: (createdUser: { uid: string }) => Promise<void>
    ) => Promise<unknown>;

    let signupPromise: Promise<unknown>;
    act(() => {
      signupPromise = signUpWithProfile('new@example.com', 'password', profileCallback);
    });
    await waitFor(() => expect(profileCallback).toHaveBeenCalledWith(user));

    jest.mocked(useAuthUser).mockReturnValue(
      { user, loading: false } as unknown as ReturnType<typeof useAuthUser>
    );
    jest.mocked(useUserData).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: createUserDataNotFoundError(),
    });
    rendered.rerender(providerTree(queryClient));
    await act(async () => Promise.resolve());

    expect(logout).not.toHaveBeenCalled();

    await act(async () => {
      finishProfile!();
      await signupPromise!;
    });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['user', 'new-user'],
      refetchType: 'none',
    });
    expect(refetchQueries).toHaveBeenCalledWith({
      queryKey: ['user', 'new-user'],
      type: 'active',
    });
    expect(invalidateQueries.mock.invocationCallOrder[0])
      .toBeLessThan(refetchQueries.mock.invocationCallOrder[0]);
  });

  test('logs out a persisted authenticated user whose user document is missing', async () => {
    const user = {
      uid: 'orphaned-user',
      getIdTokenResult: jest.fn().mockResolvedValue({ claims: {} }),
    };
    jest.mocked(useAuthUser).mockReturnValue(
      { user, loading: false } as unknown as ReturnType<typeof useAuthUser>
    );
    jest.mocked(useUserData).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: createUserDataNotFoundError(),
    });

    renderProvider();

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(authContext!.isAdmin).toBe(false);
    expect(authContext!.error).toBe('사용할 수 없는 계정입니다. 관리자에게 문의하세요.');
  });

  test('logs out and rethrows when signup profile provisioning fails', async () => {
    const user = { uid: 'new-user' };
    const profileError = new Error('profile write failed');
    jest.mocked(signUp).mockResolvedValue(
      { user } as unknown as Awaited<ReturnType<typeof signUp>>
    );
    renderProvider();
    const signUpWithProfile = authContext!.signUp as unknown as (
      email: string,
      password: string,
      createProfile: (createdUser: { uid: string }) => Promise<void>
    ) => Promise<unknown>;

    await act(async () => {
      await expect(signUpWithProfile(
        'new@example.com',
        'password',
        async () => { throw profileError; }
      )).rejects.toBe(profileError);
    });

    expect(logout).toHaveBeenCalled();
  });

  test('preserves the existing session when Firebase signup fails before creating an account', async () => {
    const signupError = new Error('email already in use');
    const profileCallback = jest.fn(async () => undefined);
    jest.mocked(signUp).mockRejectedValue(signupError);
    renderProvider();
    const signUpWithProfile = authContext!.signUp as unknown as (
      email: string,
      password: string,
      createProfile: (createdUser: { uid: string }) => Promise<void>
    ) => Promise<unknown>;

    await act(async () => {
      await expect(signUpWithProfile(
        'existing@example.com',
        'password',
        profileCallback
      )).rejects.toBe(signupError);
    });

    expect(profileCallback).not.toHaveBeenCalled();
    expect(logout).not.toHaveBeenCalled();
  });

  test('logs out an authenticated user whose document is explicitly inactive', async () => {
    const user = {
      uid: 'inactive-user',
      getIdTokenResult: jest.fn().mockResolvedValue({ claims: {} }),
    };
    jest.mocked(useAuthUser).mockReturnValue(
      { user, loading: false } as unknown as ReturnType<typeof useAuthUser>
    );
    jest.mocked(useUserData).mockReturnValue({
      data: { role: 'user', status: 'inactive' },
      isLoading: false,
      error: null,
    });

    renderProvider();

    await waitFor(() => expect(logout).toHaveBeenCalled());
  });

  test('revokes admin access without logging out on a transient user document read error', async () => {
    const user = {
      uid: 'admin-1',
      getIdTokenResult: jest.fn().mockResolvedValue({ claims: { admin: true } }),
    };
    const activeAdmin = { role: 'admin', status: 'active' };
    jest.mocked(useAuthUser).mockReturnValue(
      { user, loading: false } as unknown as ReturnType<typeof useAuthUser>
    );
    jest.mocked(useUserData).mockReturnValue({
      data: activeAdmin,
      isLoading: false,
      error: null,
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const rendered = renderProvider(queryClient);
    await waitFor(() => expect(authContext!.isAdmin).toBe(true));

    jest.mocked(useUserData).mockReturnValue({
      data: { ...activeAdmin },
      isLoading: false,
      error: new Error('temporarily unavailable'),
    });
    rendered.rerender(providerTree(queryClient));

    await waitFor(() => expect(authContext!.isAdmin).toBe(false));
    expect(logout).not.toHaveBeenCalled();
    expect(user.getIdTokenResult).toHaveBeenCalledTimes(1);
  });
});
