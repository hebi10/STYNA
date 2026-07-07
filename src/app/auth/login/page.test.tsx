import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginPage from './page';
import { useAuth } from '@/context/authProvider';

const replace = jest.fn();
const login = jest.fn();
const clearError = jest.fn();

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

  test('shows demo account login buttons', () => {
    render(<LoginPage />);

    expect(screen.getByRole('button', { name: /일반 로그인/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /관리자 로그인/ })).toBeInTheDocument();
  });
});
