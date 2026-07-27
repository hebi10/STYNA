import { getAuth } from 'firebase/auth';
import PointService from './pointService';

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  limit: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  startAfter: jest.fn(),
}));

jest.mock('@/shared/libs/firebase/firebase', () => ({ db: {} }));

describe('PointService.addSignupPoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getAuth).mockReturnValue({
      currentUser: {
        getIdToken: jest.fn().mockResolvedValue('user-token'),
      },
    } as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('rejects an unsuccessful HTTP response even if its JSON claims success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: jest.fn().mockResolvedValue({
        success: true,
        data: { newBalance: 5000 },
      }),
    }) as jest.Mock;

    await expect(PointService.addSignupPoint()).rejects.toThrow('요청에 실패했습니다.');
  });

  test('returns the server-confirmed balance only for an HTTP and JSON success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        success: true,
        data: { newBalance: 5000, alreadyGranted: false, bonusAmount: 5000 },
      }),
    }) as jest.Mock;

    await expect(PointService.addSignupPoint()).resolves.toEqual({
      success: true,
      newBalance: 5000,
    });
  });

  test('rejects a success body that does not confirm the canonical signup bonus', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        success: true,
        data: { newBalance: 5000, alreadyGranted: false },
      }),
    }) as jest.Mock;

    await expect(PointService.addSignupPoint()).rejects.toThrow(
      '회원가입 보너스 지급 결과를 확인할 수 없습니다.',
    );
  });
});
