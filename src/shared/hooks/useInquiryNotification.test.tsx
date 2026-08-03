import { act, renderHook } from '@testing-library/react';
import { InquiryService } from '@/shared/services/inquiryService';
import { useInquiryNotification } from './useInquiryNotification';

jest.mock('@/shared/services/inquiryService', () => ({
  InquiryService: {
    subscribeToUnreadInquiries: jest.fn(),
  },
}));

describe('useInquiryNotification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(InquiryService.subscribeToUnreadInquiries).mockReturnValue(jest.fn());
  });

  test('인증 완료 후 고객 알림을 구독하고 계정이 바뀌면 기존 구독을 해제한다', () => {
    const unsubscribe = jest.fn();
    jest.mocked(InquiryService.subscribeToUnreadInquiries).mockReturnValue(unsubscribe);

    const { rerender, unmount } = renderHook(
      ({ userId }) => useInquiryNotification({
        userId,
        isAdmin: false,
        enabled: true,
      }),
      { initialProps: { userId: 'owner-1' as string | null } },
    );

    expect(InquiryService.subscribeToUnreadInquiries).toHaveBeenCalledWith(
      { audience: 'customer', userId: 'owner-1' },
      expect.any(Function),
      expect.any(Function),
    );

    rerender({ userId: null });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    unmount();
  });

  test('관리자는 관리자 문의 알림을 구독하고 콜백 값을 반환한다', () => {
    jest.mocked(InquiryService.subscribeToUnreadInquiries).mockImplementation(
      (_options, onChange) => {
        onChange(true);
        return jest.fn();
      },
    );

    const { result } = renderHook(() => useInquiryNotification({
      userId: 'admin-1',
      isAdmin: true,
      enabled: true,
    }));

    expect(InquiryService.subscribeToUnreadInquiries).toHaveBeenCalledWith(
      { audience: 'admin', userId: 'admin-1' },
      expect.any(Function),
      expect.any(Function),
    );
    expect(result.current).toBe(true);
  });

  test.each([
    { enabled: false, userId: 'owner-1' },
    { enabled: true, userId: null },
  ])('인증 준비가 되지 않은 경우 구독하지 않는다: %o', ({ enabled, userId }) => {
    const { result } = renderHook(() => useInquiryNotification({
      userId,
      isAdmin: false,
      enabled,
    }));

    expect(InquiryService.subscribeToUnreadInquiries).not.toHaveBeenCalled();
    expect(result.current).toBe(false);
  });

  test('구독 오류가 발생하면 읽지 않은 상태를 해제한다', () => {
    let notifyUnread: ((value: boolean) => void) | undefined;
    let notifyError: ((error: Error) => void) | undefined;
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.mocked(InquiryService.subscribeToUnreadInquiries).mockImplementation(
      (_options, onChange, onError) => {
        notifyUnread = onChange;
        notifyError = onError;
        return jest.fn();
      },
    );

    const { result } = renderHook(() => useInquiryNotification({
      userId: 'owner-1',
      isAdmin: false,
      enabled: true,
    }));

    act(() => notifyUnread?.(true));
    expect(result.current).toBe(true);

    act(() => notifyError?.(new Error('network')));
    expect(result.current).toBe(false);
    expect(console.error).toHaveBeenCalledWith(
      '문의 알림 구독 실패:',
      expect.any(Error),
    );

    jest.restoreAllMocks();
  });
});
