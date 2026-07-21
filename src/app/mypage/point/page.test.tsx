import { render } from '@testing-library/react';
import { useAuth } from '@/context/authProvider';
import PointPage from './page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('@/context/authProvider', () => ({ useAuth: jest.fn() }));
jest.mock('@/shared/hooks/usePoint', () => ({
  usePointBalance: () => ({ data: { pointBalance: 5000 }, isLoading: false }),
  usePointHistory: () => ({
    history: [],
    isLoading: false,
    hasMore: false,
    loadMore: jest.fn(),
    isLoadingMore: false,
  }),
}));
jest.mock('./page.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, property) => String(property),
  }),
}));

describe('PointPage policy copy', () => {
  test('shows only balance, usage, and server-record guidance', () => {
    jest.mocked(useAuth).mockReturnValue({
      user: { uid: 'user-1' },
      loading: false,
    } as unknown as ReturnType<typeof useAuth>);

    const { container } = render(<PointPage />);

    expect(container.textContent).toContain('서버에서 처리된 기록');
    expect(container.textContent).not.toMatch(
      /구매금액의 1%|리뷰 작성|생일 혜택|최대 50%|적립일로부터 6개월/,
    );
  });
});
