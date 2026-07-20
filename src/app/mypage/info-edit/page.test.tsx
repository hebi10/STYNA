import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { serverTimestamp, updateDoc } from 'firebase/firestore';
import { reauthenticateWithCredential, updateEmail } from 'firebase/auth';
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
    jest.mocked(updateDoc).mockResolvedValue(undefined);
    jest.mocked(updateEmail).mockResolvedValue(undefined);
    jest.mocked(reauthenticateWithCredential).mockResolvedValue({} as never);
    getIdToken.mockResolvedValue('refreshed-token');
    invalidateQueries.mockResolvedValue(undefined);
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
