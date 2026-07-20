import { getAuth, signOut } from 'firebase/auth';
import { getDoc, updateDoc } from 'firebase/firestore';
import { AdminUserData, AdminUserService } from './adminUserService';
import { AUTH_ACCESS_CHANGED_EVENT } from '@/shared/utils/authAccess';

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  getDocs: jest.fn(),
  doc: jest.fn(),
  updateDoc: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  where: jest.fn(),
  limit: jest.fn(),
  serverTimestamp: jest.fn(() => 'server-time'),
  getDoc: jest.fn(),
}));

jest.mock('@/shared/libs/firebase/firebase', () => ({
  db: {},
}));

describe('AdminUserService', () => {
  const fetchMock = jest.fn();
  const getIdTokenMock = jest.fn();
  const authMock = {
    currentUser: {
      uid: 'admin-1',
      getIdToken: getIdTokenMock,
    },
  };

  beforeEach(() => {
    fetchMock.mockReset();
    (global as typeof globalThis & { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    getIdTokenMock.mockReset().mockResolvedValue('admin-token');
    jest.mocked(getAuth).mockReturnValue(authMock as unknown as ReturnType<typeof getAuth>);
    jest.mocked(signOut).mockReset().mockResolvedValue(undefined);
    jest.mocked(getDoc).mockReset();
    jest.mocked(updateDoc).mockReset();
  });

  test('routes admin point changes through the points API', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { newBalance: 6000 } }),
    });

    await AdminUserService.updateUserPoints({
      userId: 'user-1',
      amount: 1000,
      description: '관리자 지급',
      type: 'add',
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/points', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-token',
      },
      body: JSON.stringify({
        action: 'add',
        userId: 'user-1',
        amount: 1000,
        description: '관리자 지급',
      }),
    });
    expect(getDoc).not.toHaveBeenCalled();
    expect(updateDoc).not.toHaveBeenCalled();
  });

  test('routes status changes through the admin users API without direct Firestore writes', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    await AdminUserService.updateUserStatus('user-1', 'banned');

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-token',
      },
      body: JSON.stringify({
        action: 'setStatus',
        userId: 'user-1',
        status: 'banned',
      }),
    });
    expect(updateDoc).not.toHaveBeenCalled();
  });

  test('routes role changes through the admin users API without direct Firestore writes', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    await AdminUserService.updateUserRole('user-1', 'admin');

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-token',
      },
      body: JSON.stringify({
        action: 'setRole',
        userId: 'user-1',
        role: 'admin',
      }),
    });
    expect(updateDoc).not.toHaveBeenCalled();
  });

  test('routes user deletion through the admin users API without direct Firestore writes', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    await AdminUserService.deleteUser('user-1');

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-token',
      },
      body: JSON.stringify({
        action: 'deleteUser',
        userId: 'user-1',
      }),
    });
    expect(updateDoc).not.toHaveBeenCalled();
  });

  test('refreshes the token and publishes an access change after changing the current user', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    const eventListener = jest.fn();
    window.addEventListener(AUTH_ACCESS_CHANGED_EVENT, eventListener);

    await AdminUserService.updateUserRole('admin-1', 'user');

    expect(getIdTokenMock).toHaveBeenNthCalledWith(1);
    expect(getIdTokenMock).toHaveBeenNthCalledWith(2, true);
    expect(eventListener).toHaveBeenCalledTimes(1);
    expect((eventListener.mock.calls[0][0] as CustomEvent<{ userId: string }>).detail).toEqual({
      userId: 'admin-1',
    });
    window.removeEventListener(AUTH_ACCESS_CHANGED_EVENT, eventListener);
  });

  test('signs out when the current user token cannot be refreshed after an access change', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    const refreshError = new Error('refresh failed');
    getIdTokenMock
      .mockResolvedValueOnce('admin-token')
      .mockRejectedValueOnce(refreshError);

    await expect(AdminUserService.updateUserStatus('admin-1', 'inactive')).rejects.toBe(refreshError);

    expect(signOut).toHaveBeenCalledWith(authMock);
    expect(consoleError).toHaveBeenCalledWith('Error updating user status:', refreshError);
    consoleError.mockRestore();
  });

  test('exports user fields in the existing order as BOM-prefixed safe RFC 4180 CSV', async () => {
    const getAllUsersSpy = jest.spyOn(AdminUserService, 'getAllUsersSimple').mockResolvedValue([
      {
        id: "=cmd|' /C calc'!A0",
        name: '김,"민\n수',
        email: ' \t+SUM(1,2)',
        role: 'admin',
        status: 'active',
        joinDate: '2026-07-01',
        lastLogin: new Date('2026-07-19T12:34:56.789Z'),
        orders: 3,
        totalSpent: 120000,
        pointBalance: 5000,
      } as AdminUserData,
    ]);

    const csv = await AdminUserService.exportUsersToCSV();

    expect(csv).toBe(
      '\ufeffID,이름,이메일,역할,상태,가입일,마지막 로그인,주문수,총 구매액,포인트 잔액\r\n' +
        "'=cmd|' /C calc'!A0,\"김,\"\"민\n수\",\"' \t+SUM(1,2)\",admin,active,2026-07-01," +
        '2026-07-19T12:34:56.789Z,3,120000,5000'
    );
    expect(csv.match(/\ufeff/gu)).toHaveLength(1);
    expect(getAllUsersSpy).toHaveBeenCalledTimes(1);
  });
});
