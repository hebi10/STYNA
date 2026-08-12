jest.mock('firebase-admin', () => ({
  auth: jest.fn(),
  firestore: jest.fn(),
}));

import * as admin from 'firebase-admin';
import { requireRecentAdmin, verifyAuthContext } from '../src/utils/auth';

describe('verifyAuthContext', () => {
  const verifyIdToken = jest.fn();
  const getUserDocument = jest.fn();

  function mockDecodedToken(claims: Record<string, unknown> = {}) {
    verifyIdToken.mockResolvedValue({ uid: 'user-1', ...claims });
  }

  function mockUserDocument(data: Record<string, unknown> | undefined) {
    getUserDocument.mockResolvedValue({
      exists: data !== undefined,
      data: () => data,
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(admin.auth).mockReturnValue({
      verifyIdToken,
    } as never);
    jest.mocked(admin.firestore).mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: getUserDocument,
        })),
      })),
    } as never);
    mockDecodedToken();
    mockUserDocument({ status: 'active', role: 'user' });
  });

  test('checks token revocation while verifying the ID token', async () => {
    await verifyAuthContext('Bearer valid-token');

    expect(verifyIdToken).toHaveBeenCalledWith('valid-token', true);
  });

  test.each(['inactive', 'banned', 'deleted', undefined])(
    'rejects an account with status %s even with a valid token',
    async (status) => {
      mockUserDocument({ status, role: 'user' });

      await expect(verifyAuthContext('Bearer valid-token')).rejects.toMatchObject({
        statusCode: 403,
      });
    }
  );

  test('rejects an account without a user document', async () => {
    mockUserDocument(undefined);

    await expect(verifyAuthContext('Bearer valid-token')).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  test('uses the active user document role for the authentication context', async () => {
    mockDecodedToken({ role: 'admin' });
    mockUserDocument({ status: 'active', role: 'user' });

    await expect(verifyAuthContext('Bearer valid-token')).resolves.toMatchObject({
      uid: 'user-1',
      role: 'user',
      isAdmin: false,
    });
  });

  test.each([
    [{ admin: true }, { status: 'active', role: 'admin' }],
    [{ role: 'admin' }, { status: 'active', role: 'admin' }],
  ])('grants admin access only when an admin claim matches the document role', async (claims, userData) => {
    mockDecodedToken(claims);
    mockUserDocument(userData);

    await expect(verifyAuthContext('Bearer valid-token')).resolves.toMatchObject({
      role: 'admin',
      isAdmin: true,
    });
  });

  test('identifies a read-only demo administrator separately from a full administrator', async () => {
    mockDecodedToken({ demoAdmin: true });
    mockUserDocument({ status: 'active', role: 'demo_admin' });

    await expect(verifyAuthContext('Bearer demo-token')).resolves.toMatchObject({
      role: 'demo_admin',
      isAdmin: false,
      isDemoAdmin: true,
    });
  });

  test('rejects a full administrator whose password authentication is older than five minutes', async () => {
    mockDecodedToken({ admin: true, auth_time: Math.floor(Date.now() / 1000) - 301 });
    mockUserDocument({ status: 'active', role: 'admin' });

    await expect(requireRecentAdmin('Bearer stale-token')).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  test('accepts a full administrator immediately after password reauthentication', async () => {
    mockDecodedToken({ admin: true, auth_time: Math.floor(Date.now() / 1000) });
    mockUserDocument({ status: 'active', role: 'admin' });

    await expect(requireRecentAdmin('Bearer fresh-token')).resolves.toMatchObject({
      isAdmin: true,
    });
  });

  test.each([
    [{ admin: true }, { status: 'active', role: 'user' }],
    [{ role: 'admin' }, { status: 'active', role: 'user' }],
    [{}, { status: 'active', role: 'admin' }],
  ])('does not grant admin access when token and document roles disagree', async (claims, userData) => {
    mockDecodedToken(claims);
    mockUserDocument(userData);

    await expect(verifyAuthContext('Bearer valid-token')).resolves.toMatchObject({
      isAdmin: false,
    });
  });

  test('normalizes a revoked-token verification failure to 401', async () => {
    verifyIdToken.mockRejectedValue(new Error('revoked token'));

    await expect(verifyAuthContext('Bearer revoked-token')).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(getUserDocument).not.toHaveBeenCalled();
  });
});
