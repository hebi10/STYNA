import { render, screen } from '@testing-library/react';
import { useAuth } from '@/context/authProvider';
import { buildDemoDataNotice } from '@/shared/constants/commercePolicy';
import SignupPage from './page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
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
  default: (initialValue: Record<string, unknown>) => [initialValue, jest.fn()],
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
  beforeEach(() => {
    jest.mocked(useAuth).mockReturnValue({
      signUp: jest.fn(),
      error: null,
      clearError: jest.fn(),
    } as unknown as ReturnType<typeof useAuth>);
  });

  test('discloses demo payment and Firebase persistence before signup', () => {
    render(<SignupPage />);

    const submitButton = screen.getByRole('button', { name: '회원가입' });
    const notice = screen.getByText(buildDemoDataNotice());
    expect(notice).toBeInTheDocument();
    expect(notice.compareDocumentPosition(submitButton) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });
});
