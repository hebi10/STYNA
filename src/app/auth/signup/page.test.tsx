import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/authProvider';
import { buildDemoDataNotice, formatSignupBenefit } from '@/shared/constants/commercePolicy';
import PointService from '@/shared/services/pointService';
import { setDoc } from 'firebase/firestore';
import SignupPage from './page';

let mockSignupFormData = {
  email: 'user@example.com',
  password: 'password123',
  confirmPassword: 'password123',
  name: '테스트 사용자',
  phone: '010-1234-5678',
  birthYear: '1990',
  birthMonth: '7',
  birthDay: '20',
  gender: 'female',
  termsAgree: true,
  privacyAgree: true,
  marketingAgree: false,
};

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock('@/context/authProvider', () => ({ useAuth: jest.fn() }));
jest.mock('@/shared/hooks/useInput', () => ({
  __esModule: true,
  default: () => [mockSignupFormData, jest.fn()],
}));
jest.mock('@/shared/services/pointService', () => ({
  __esModule: true,
  default: { addSignupPoint: jest.fn() },
}));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  serverTimestamp: jest.fn(),
  setDoc: jest.fn(),
}));
jest.mock('@/shared/libs/firebase/firebase', () => ({ db: {} }));
jest.mock('./page.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, property) => String(property),
  }),
}));

describe('SignupPage policy notice', () => {
  const push = jest.fn();
  const signUp = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSignupFormData = {
      email: 'user@example.com',
      password: 'password123',
      confirmPassword: 'password123',
      name: '테스트 사용자',
      phone: '010-1234-5678',
      birthYear: '1990',
      birthMonth: '7',
      birthDay: '20',
      gender: 'female',
      termsAgree: true,
      privacyAgree: true,
      marketingAgree: false,
    };
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: jest.fn((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      }),
    });
    jest.mocked(useRouter).mockReturnValue({ push } as never);
    jest.mocked(setDoc).mockResolvedValue(undefined);
    signUp.mockImplementation(async (
      _email: string,
      _password: string,
      createProfile: (user: { uid: string }) => Promise<void>,
    ) => {
      await createProfile({ uid: 'user-1' });
      return { user: { uid: 'user-1' } };
    });
    jest.mocked(useAuth).mockReturnValue({
      signUp,
      error: null,
      clearError: jest.fn(),
    } as unknown as ReturnType<typeof useAuth>);
    jest.spyOn(window, 'alert').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('discloses demo payment and Firebase persistence before signup', () => {
    render(<SignupPage />);

    const submitButton = screen.getByRole('button', { name: '회원가입' });
    const notice = screen.getByText(buildDemoDataNotice());
    expect(notice).toBeInTheDocument();
    expect(notice.compareDocumentPosition(submitButton) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    expect(screen.getByText('포트폴리오 데모 이용 안내에 동의합니다 (필수)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '데모 이용 안내 보기' })).toHaveAttribute(
      'href',
      '/legal/terms',
    );
    expect(screen.getByText(formatSignupBenefit())).toBeInTheDocument();
  });

  test('provides stable form metadata and groups related required controls', () => {
    render(<SignupPage />);

    expect(screen.getByLabelText(/이메일/)).toHaveAttribute('id', 'signup-email');
    expect(screen.getByLabelText(/이메일/)).toBeRequired();
    expect(screen.getByLabelText(/이메일/)).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText(/^비밀번호 \*$/)).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByRole('group', { name: '생년월일' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '성별' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '필수 안내 확인' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /데모 이용 안내/ })).toBeRequired();
    expect(screen.getByRole('checkbox', { name: /개인정보 안내/ })).toBeRequired();
  });

  test('connects validation errors and focuses the first invalid control', () => {
    mockSignupFormData = {
      email: '',
      password: '',
      confirmPassword: '',
      name: '',
      phone: '',
      birthYear: '',
      birthMonth: '',
      birthDay: '',
      gender: '',
      termsAgree: false,
      privacyAgree: false,
      marketingAgree: false,
    };

    render(<SignupPage />);
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }));

    const emailInput = screen.getByLabelText(/이메일/);
    expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    expect(emailInput).toHaveAttribute('aria-describedby', 'signup-email-error');
    expect(screen.getByText('이메일을 입력해주세요.')).toHaveAttribute(
      'id',
      'signup-email-error',
    );
    expect(emailInput).toHaveFocus();

    const birthGroup = screen.getByRole('group', { name: '생년월일' });
    expect(birthGroup).toHaveAttribute('aria-describedby', 'signup-birth-error');
    expect(screen.getByLabelText('생년월일 연도')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('생년월일을 모두 선택해주세요.')).toHaveAttribute(
      'id',
      'signup-birth-error',
    );
    expect(screen.getByRole('group', { name: '성별' })).toHaveAttribute('aria-invalid', 'true');
    screen.getAllByRole('radio').forEach((radio) => {
      expect(radio).toHaveAttribute('aria-describedby', 'signup-gender-error');
    });
  });

  test('keeps the completed account separate from a failed bonus sync and retries only the bonus', async () => {
    jest.mocked(PointService.addSignupPoint)
      .mockRejectedValueOnce(new Error('upstream unavailable'))
      .mockResolvedValueOnce({ success: true, newBalance: 5000 });

    render(<SignupPage />);
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '회원가입은 완료되었지만 5,000P 지급 확인에 실패했습니다.',
    );
    expect(signUp).toHaveBeenCalledTimes(1);
    expect(PointService.addSignupPoint).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
    const completedButton = screen.getByRole('button', { name: '회원가입 완료' });
    expect(completedButton).toBeDisabled();

    fireEvent.submit(completedButton.closest('form')!);
    await waitFor(() => expect(signUp).toHaveBeenCalledTimes(1));
    expect(PointService.addSignupPoint).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '5,000P 지급 다시 확인' }));

    await waitFor(() => {
      expect(PointService.addSignupPoint).toHaveBeenCalledTimes(2);
      expect(push).toHaveBeenCalledWith('/mypage');
    });
    expect(signUp).toHaveBeenCalledTimes(1);
    expect(window.alert).toHaveBeenCalledWith('회원가입과 5,000P 지급이 완료되었습니다!');
  });

  test('does not attempt the bonus when auth or profile provisioning fails', async () => {
    signUp.mockRejectedValueOnce(new Error('profile failed'));

    render(<SignupPage />);
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }));

    await waitFor(() => expect(signUp).toHaveBeenCalledTimes(1));
    expect(PointService.addSignupPoint).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
