jest.mock('firebase-admin', () => ({
  auth: jest.fn(),
  firestore: jest.fn(),
}));

import * as admin from 'firebase-admin';
import { verifyAuthContext } from '../src/utils/auth';

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
