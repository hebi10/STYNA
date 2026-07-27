import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { serverTimestamp, updateDoc } from 'firebase/firestore';
import { reauthenticateWithCredential, updateEmail } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { useQueryClient } from '@tanstack/react-query';
import InfoEditPage from './page';
import { useAuth } from '@/context/authProvider';

const push = jest.fn();
const timestampSentinel = { kind: 'serverTimestamp' };

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

jest.mock('@/context/authProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => ({ path: 'users/owner-1' })),
  serverTimestamp: jest.fn(() => timestampSentinel),
  updateDoc: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
  EmailAuthProvider: { credential: jest.fn() },
  reauthenticateWithCredential: jest.fn(),
  updateEmail: jest.fn(),
  updatePassword: jest.fn(),
}));

jest.mock('@/shared/libs/firebase/firebase', () => ({
  db: {},
}));

jest.mock('./page.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, property) => String(property),
  }),
}));

describe('InfoEditPage Firestore timestamp contract', () => {
  const invalidateQueries = jest.fn();
  const getIdToken = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    window.alert = jest.fn();
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: jest.fn((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      }),
    });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.mocked(useQueryClient).mockReturnValue({ invalidateQueries } as never);
    jest.mocked(useAuth).mockReturnValue({
      user: {
        uid: 'owner-1',
        email: 'owner-1@example.com',
        getIdToken,
      },
      userData: {
        email: 'owner-1@example.com',
        name: '작성자',
        phone: '010-1234-5678',
        birth: { year: '1990', month: '7', day: '20' },
        gender: 'female',
        marketingAgree: false,
        status: 'active',
        role: 'user',
      },
    } as unknown as ReturnType<typeof useAuth>);
    jest.mocked(updateDoc).mockReset().mockResolvedValue(undefined);
    jest.mocked(updateEmail).mockReset().mockResolvedValue(undefined);
    jest.mocked(reauthenticateWithCredential).mockReset().mockResolvedValue({} as never);
    getIdToken.mockReset().mockResolvedValue('refreshed-token');
    invalidateQueries.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('provides stable metadata and grouped labels for profile controls', async () => {
    render(<InfoEditPage />);

    const emailInput = await screen.findByLabelText(/이메일/);
    expect(emailInput).toHaveAttribute('id', 'info-email');
    expect(emailInput).toBeRequired();
    expect(emailInput).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('현재 비밀번호')).toHaveAttribute(
      'autocomplete',
      'current-password',
    );
    expect(screen.getByRole('group', { name: '생년월일' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '성별' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /마케팅 정보 수신/ })).toHaveAttribute(
      'id',
      'info-marketing-agree',
    );
  });

  test('connects validation errors and focuses the first invalid control', async () => {
    render(<InfoEditPage />);
    const emailInput = await screen.findByLabelText(/이메일/);
    fireEvent.change(emailInput, { target: { name: 'email', value: '' } });

    fireEvent.click(screen.getByRole('button', { name: '정보 수정' }));

    expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    expect(emailInput).toHaveAttribute('aria-describedby', 'info-email-error');
    expect(screen.getByText('이메일을 입력해주세요.')).toHaveAttribute(
      'id',
      'info-email-error',
    );
    expect(emailInput).toHaveFocus();
  });

  test.each([
    ['auth/wrong-password', '현재 비밀번호가 올바르지 않습니다.'],
    ['auth/invalid-credential', '현재 비밀번호가 올바르지 않습니다.'],
    ['auth/requires-recent-login', '보안을 위해 현재 비밀번호로 다시 인증해주세요.'],
  ])('focuses a Firebase %s error on the current password control', async (errorCode, expectedMessage) => {
    jest.mocked(reauthenticateWithCredential).mockRejectedValueOnce(
      new FirebaseError(errorCode, 'reauthentication failed'),
    );
    render(<InfoEditPage />);
    const emailInput = await screen.findByLabelText(/이메일/);
    const currentPasswordInput = screen.getByLabelText('현재 비밀번호');
    fireEvent.change(emailInput, {
      target: { name: 'email', value: 'changed@example.com' },
    });
    fireEvent.change(currentPasswordInput, {
      target: { name: 'currentPassword', value: 'incorrect-password' },
    });

    fireEvent.click(screen.getByRole('button', { name: '정보 수정' }));

    expect(await screen.findByText(expectedMessage)).toHaveAttribute(
      'id',
      'info-current-password-error',
    );
    expect(currentPasswordInput).toHaveFocus();
  });

  test('announces an unmapped update failure as a general alert', async () => {
    jest.mocked(updateDoc).mockRejectedValueOnce(new Error('network unavailable'));
    render(<InfoEditPage />);

    fireEvent.click(await screen.findByRole('button', { name: '정보 수정' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '정보 업데이트에 실패했습니다. 다시 시도해주세요.',
    );
  });

  test('uses a server timestamp accepted by the profile security rule', async () => {
    render(<InfoEditPage />);

    fireEvent.click(await screen.findByRole('button', { name: '정보 수정' }));

    await waitFor(() => expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ updatedAt: timestampSentinel })
    ));
    expect(serverTimestamp).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['user', 'owner-1'] });
  });

  test('refreshes the email claim before writing and then refreshes the user cache', async () => {
    const { container } = render(<InfoEditPage />);
    const emailInput = await waitFor(() => container.querySelector('input[name="email"]'));
    const passwordInput = container.querySelector('input[name="currentPassword"]');

    fireEvent.change(emailInput as HTMLInputElement, {
      target: { name: 'email', value: 'changed@example.com' },
    });
    fireEvent.change(passwordInput as HTMLInputElement, {
      target: { name: 'currentPassword', value: 'current-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: '정보 수정' }));

    await waitFor(() => expect(updateDoc).toHaveBeenCalled());
    expect(updateEmail).toHaveBeenCalledWith(expect.anything(), 'changed@example.com');
    expect(getIdToken).toHaveBeenCalledWith(true);
    expect(jest.mocked(updateEmail).mock.invocationCallOrder[0]).toBeLessThan(
      getIdToken.mock.invocationCallOrder[0]
    );
    expect(getIdToken.mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(updateDoc).mock.invocationCallOrder[0]
    );
    expect(jest.mocked(updateDoc).mock.invocationCallOrder[0]).toBeLessThan(
      invalidateQueries.mock.invocationCallOrder[0]
    );
  });
});
