import { render, screen } from '@testing-library/react';
import AuthChecking from './AuthChecking';
import { useAuth } from '@/context/authProvider';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock('@/context/authProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('./AuthChecking.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, property) => String(property),
  }),
}));

describe('AuthChecking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('uses the neutral admin gate style for unauthenticated users', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      isAdmin: false,
      loading: false,
      isUserDataLoading: false,
    });

    render(<AuthChecking>관리자 본문</AuthChecking>);

    expect(screen.getByText('로그인이 필요합니다.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '로그인 페이지로 이동' })).toHaveClass('gateButton');
    expect(screen.queryByText('관리자 본문')).not.toBeInTheDocument();
  });

  test('allows a read-only demo administrator into the isolated admin shell', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { uid: 'demo-admin-1' },
      isAdmin: false,
      isDemoAdmin: true,
      loading: false,
      isUserDataLoading: false,
    });

    render(<AuthChecking>읽기 전용 관리자 본문</AuthChecking>);

    expect(screen.getByText('읽기 전용 관리자 본문')).toBeInTheDocument();
  });
});
