import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import InquiryPage from './page';
import { useAuth } from '@/context/authProvider';
import { InquiryService } from '@/shared/services/inquiryService';

jest.mock('@/context/authProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/shared/services/inquiryService', () => ({
  InquiryService: {
    createInquiry: jest.fn(),
    getUserInquiries: jest.fn(),
  },
}));

jest.mock('./page.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, property) => String(property),
  }),
}));

function mockAuth(overrides: Record<string, unknown> = {}) {
  jest.mocked(useAuth).mockReturnValue({
    user: {
      uid: 'owner-1',
      email: 'auth@example.com',
      displayName: 'Auth 표시 이름',
    },
    userData: {
      email: 'owner-1@example.com',
      name: '문서 작성자',
      status: 'active',
      role: 'user',
    },
    isUserDataLoading: false,
    ...overrides,
    } as unknown as ReturnType<typeof useAuth>);
}

describe('Inquiry account identity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.alert = jest.fn();
    mockAuth();
    jest.mocked(InquiryService.createInquiry).mockResolvedValue('inquiry-1');
    jest.mocked(InquiryService.getUserInquiries).mockResolvedValue([]);
  });

  test('submits the authoritative user document email and name', async () => {
    render(<InquiryPage />);

    fireEvent.change(screen.getByRole('textbox', { name: /제목/ }), {
      target: { value: '문의 제목' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /문의 내용/ }), {
      target: { value: '문의 내용' },
    });
    fireEvent.click(screen.getByRole('button', { name: '문의 등록' }));

    await waitFor(() => expect(InquiryService.createInquiry).toHaveBeenCalledWith(
      'owner-1',
      'owner-1@example.com',
      '문서 작성자',
      expect.objectContaining({ title: '문의 제목', content: '문의 내용' })
    ));
  });

  test('matches the Firestore length limits before submission', () => {
    const { container } = render(<InquiryPage />);

    expect(container.querySelector<HTMLInputElement>('#title')).toHaveAttribute('maxlength', '100');
    expect(container.querySelector<HTMLTextAreaElement>('#content')).toHaveAttribute('maxlength', '2000');
  });

  test.each([
    ['loading', { isUserDataLoading: true }],
    ['missing', { userData: null }],
  ])('blocks submission while authoritative user data is %s', async (_state, overrides) => {
    mockAuth(overrides);
    const { container } = render(<InquiryPage />);

    fireEvent.change(screen.getByRole('textbox', { name: /제목/ }), {
      target: { value: '문의 제목' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /문의 내용/ }), {
      target: { value: '문의 내용' },
    });
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    await waitFor(() => expect(InquiryService.createInquiry).not.toHaveBeenCalled());
    expect(screen.getByRole('button', { name: '문의 등록' })).toBeDisabled();
  });
});
