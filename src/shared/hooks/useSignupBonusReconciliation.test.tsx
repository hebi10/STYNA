import { renderHook, waitFor } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';
import PointService from '@/shared/services/pointService';
import { pointKeys } from './queryKeys';
import { useSignupBonusReconciliation } from './useSignupBonusReconciliation';

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: jest.fn(),
}));

jest.mock('@/shared/services/pointService', () => ({
  __esModule: true,
  default: { addSignupPoint: jest.fn() },
}));

describe('useSignupBonusReconciliation', () => {
  const invalidateQueries = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useQueryClient).mockReturnValue({ invalidateQueries } as never);
    jest.mocked(PointService.addSignupPoint).mockResolvedValue({
      success: true,
      newBalance: 5000,
    });
  });

  test('reconciles an active user without a server marker once and refreshes related caches', async () => {
    const { rerender } = renderHook(
      ({ userData }) => useSignupBonusReconciliation({
        userId: 'user-1',
        userData,
        enabled: true,
      }),
      { initialProps: { userData: { status: 'active', role: 'user' } as Record<string, unknown> } },
    );

    await waitFor(() => expect(PointService.addSignupPoint).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['user', 'user-1'] });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: pointKeys.all('user-1') });
    });

    rerender({ userData: { status: 'active', role: 'user' } });
    expect(PointService.addSignupPoint).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['a marked active user', { status: 'active', role: 'user', signupBonusGrantedAt: {} }, true],
    ['an inactive user', { status: 'inactive', role: 'user' }, true],
    ['a disabled provisioning boundary', { status: 'active', role: 'user' }, false],
  ])('does not reconcile %s', async (_label, userData, enabled) => {
    renderHook(() => useSignupBonusReconciliation({
      userId: 'user-1',
      userData,
      enabled,
    }));

    await Promise.resolve();
    expect(PointService.addSignupPoint).not.toHaveBeenCalled();
  });
});
