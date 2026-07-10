jest.mock('firebase-admin', () => ({
  auth: jest.fn(),
  firestore: jest.fn(),
}));

import * as admin from 'firebase-admin';
import { verifyAuthContext } from '../src/utils/auth';

describe('verifyAuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(admin.auth).mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'user-1' }),
    } as never);
  });

  test.each(['inactive', 'banned'])('rejects a %s account even with a valid token', async (status) => {
    jest.mocked(admin.firestore).mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ status }),
          }),
        })),
      })),
    } as never);

    await expect(verifyAuthContext('Bearer valid-token')).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  test('accepts an active account', async () => {
    jest.mocked(admin.firestore).mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ status: 'active' }),
          }),
        })),
      })),
    } as never);

    await expect(verifyAuthContext('Bearer valid-token')).resolves.toMatchObject({
      uid: 'user-1',
      isAdmin: false,
    });
  });
});
