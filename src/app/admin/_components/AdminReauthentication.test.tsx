import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import AdminReauthentication from './AdminReauthentication';
import { useAuth } from '@/context/authProvider';

jest.mock('firebase/auth', () => ({
  EmailAuthProvider: { credential: jest.fn() },
  reauthenticateWithCredential: jest.fn(),
}));

jest.mock('@/context/authProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('./AdminReauthentication.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, property) => String(property),
  }),
}), { virtual: true });

describe('AdminReauthentication', () => {
  const onVerified = jest.fn();
  const getIdToken = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    getIdToken.mockResolvedValue('fresh-token');
    jest.mocked(useAuth).mockReturnValue({
      user: { email: 'admin@example.com', getIdToken },
    } as unknown as ReturnType<typeof useAuth>);
    jest.mocked(EmailAuthProvider.credential).mockReturnValue({} as never);
    jest.mocked(reauthenticateWithCredential).mockResolvedValue({} as never);
  });

  test('reauthenticates with the current password before opening the five-minute write window', async () => {
    const onOpenChange = jest.fn();
    render(
      <AdminReauthentication
        isOpen
        onOpenChange={onOpenChange}
        onVerified={onVerified}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '변경 권한 인증' }));
    fireEvent.change(screen.getByLabelText('현재 비밀번호'), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: '인증 후 변경 허용' }));

    await waitFor(() => expect(reauthenticateWithCredential).toHaveBeenCalled());
    expect(EmailAuthProvider.credential).toHaveBeenCalledWith('admin@example.com', 'password');
    expect(getIdToken).toHaveBeenCalledWith(true);
    expect(onVerified).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
