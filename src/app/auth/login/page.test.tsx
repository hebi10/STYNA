import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginPage from './page';
import { useAuth } from '@/context/authProvider';

const replace = jest.fn();
const login = jest.fn();
const clearError = jest.fn();
const initialDemoLoginFlag = process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

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

jest.mock('../../_components/Button', () => ({
  __esModule: true,
  default: ({
    children,
    disabled,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

jest.mock('../../_components/Input', () => ({
  __esModule: true,
  default: ({
    label,
    id,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) => {
    const inputId = id || String(props.name);
    return (
      <label>
        {label}
        <input id={inputId} {...props} />
      </label>
    );
  },
}));

jest.mock('./page.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, property) => String(property),
  }),
}));

describe('LoginPage transition feedback', () => {
  afterEach(() => {
    if (initialDemoLoginFlag === undefined) {
      delete process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN;
      return;
    }

    process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN = initialDemoLoginFlag;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    window.scrollTo = jest.fn();
    window.history.pushState({}, '', '/auth/login');
    (useAuth as jest.Mock).mockReturnValue({
      login,
      error: null,
      clearError,
      user: null,
      loading: false,
    });
  });

  test('shows an account transition overlay while login is being verified', () => {
    login.mockReturnValue(new Promise(() => undefined));

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('이메일'), {
      target: { value: 'test01@test.com' },
    });
    fireEvent.change(screen.getByLabelText('비밀번호'), {
      target: { value: 'test01test01' },
    });
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));

    expect(screen.getByRole('status')).toHaveTextContent('마이페이지 준비 중');
    expect(screen.getByRole('status')).toHaveTextContent('계정 정보를 확인하고 있습니다');
  });

  test('uses redirect query after successful login before the default mypage route', async () => {
    window.history.pushState({}, '', '/auth/login?redirect=/orders/checkout');
    login.mockResolvedValue(undefined);

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('이메일'), {
      target: { value: 'buyer@example.com' },
    });
    fireEvent.change(screen.getByLabelText('비밀번호'), {
      target: { value: 'password1234' },
    });
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/orders/checkout'));
  });

  test('owns the redirect for an already authenticated session', async () => {
    window.history.pushState({}, '', '/auth/login?redirect=/products/product-1%3FresumeIntent%3D1');
    (useAuth as jest.Mock).mockReturnValue({
      login,
      error: null,
      clearError,
      user: { uid: 'user-1' },
      loading: false,
    });

    render(<LoginPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/products/product-1?resumeIntent=1');
    });
  });

  test.each([
    'https://evil.example/path',
    '//evil.example/path',
    '/\\evil.example/path',
    'javascript:alert(1)',
  ])('falls back to mypage for an unsafe redirect: %s', async (redirect) => {
    window.history.pushState(
      {},
      '',
      `/auth/login?redirect=${encodeURIComponent(redirect)}`,
    );
    login.mockResolvedValue(undefined);

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('이메일'), {
      target: { value: 'buyer@example.com' },
    });
    fireEvent.change(screen.getByLabelText('비밀번호'), {
      target: { value: 'password1234' },
    });
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/mypage'));
  });

  test('renders portfolio demo login controls only when the public flag is true', () => {
    process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN = 'true';

    render(<LoginPage />);

    expect(screen.getByText('포트폴리오 데모 로그인')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '일반 회원 로그인' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '관리자 로그인' })).toBeInTheDocument();
  });

  test.each([
    ['missing', undefined],
    ['false', 'false'],
  ])('does not render portfolio demo login controls when the flag is %s', (_case, flag) => {
    if (flag === undefined) {
      delete process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN;
    } else {
      process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN = flag;
    }

    render(<LoginPage />);

    expect(screen.queryByText('포트폴리오 데모 로그인')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '일반 회원 로그인' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '관리자 로그인' })).not.toBeInTheDocument();
  });

  test('announces authentication errors', () => {
    (useAuth as jest.Mock).mockReturnValue({
      login,
      error: '이메일 또는 비밀번호를 확인해 주세요.',
      clearError,
      user: null,
      loading: false,
    });

    render(<LoginPage />);

    expect(screen.getByRole('alert')).toHaveTextContent('이메일 또는 비밀번호를 확인해 주세요.');
  });
});
