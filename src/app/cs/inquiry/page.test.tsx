import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import InquiryPage from './page';
import { useAuth } from '@/context/authProvider';
import { InquiryService } from '@/shared/services/inquiryService';
import { useSearchParams } from 'next/navigation';

jest.mock('@/context/authProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
}));

jest.mock('@/shared/services/inquiryService', () => ({
  InquiryService: {
    createInquiry: jest.fn(),
    getUserInquiries: jest.fn(),
    markInquiriesRead: jest.fn(),
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
    loading: false,
    isUserDataLoading: false,
    ...overrides,
    } as unknown as ReturnType<typeof useAuth>);
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

function createInquiry(overrides: Partial<Awaited<ReturnType<typeof InquiryService.getUserInquiries>>[number]> = {}) {
  return {
    id: 'answered-1',
    userId: 'owner-1',
    userEmail: 'owner-1@example.com',
    userName: '문서 작성자',
    category: 'other' as const,
    title: '답변된 문의',
    content: '문의 내용',
    status: 'answered' as const,
    createdAt: new Date('2026-08-01'),
    updatedAt: new Date('2026-08-03'),
    unreadForAdmin: false,
    unreadForCustomer: true,
    answer: {
      content: '관리자 답변',
      answeredBy: '관리자',
      answeredAt: new Date('2026-08-03'),
    },
    ...overrides,
  };
}

describe('Inquiry account identity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.alert = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockAuth();
    jest.mocked(InquiryService.createInquiry).mockResolvedValue('inquiry-1');
    jest.mocked(InquiryService.getUserInquiries).mockResolvedValue([]);
    jest.mocked(InquiryService.markInquiriesRead).mockResolvedValue();
    jest.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams() as unknown as ReturnType<typeof useSearchParams>,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('shows an authentication-check status before the auth state resolves', () => {
    mockAuth({ user: null, loading: true, isUserDataLoading: true, userData: null });

    render(<InquiryPage />);

    expect(screen.getByRole('status')).toHaveTextContent('로그인 상태를 확인하고 있습니다.');
    expect(screen.queryByRole('heading', { level: 2, name: '로그인 후 1:1 문의를 남길 수 있어요' }))
      .not.toBeInTheDocument();
  });

  test('guides a signed-out visitor to login and preserves the inquiry return path', () => {
    mockAuth({ user: null, loading: false, isUserDataLoading: false, userData: null });

    render(<InquiryPage />);

    expect(screen.getByRole('heading', { level: 2, name: '로그인 후 1:1 문의를 남길 수 있어요' }))
      .toBeInTheDocument();
    expect(screen.getByText('문의 작성과 답변 확인은 로그인한 회원만 이용할 수 있습니다.'))
      .toBeInTheDocument();
    expect(screen.getByRole('link', { name: '로그인하고 문의하기' }))
      .toHaveAttribute('href', '/auth/login?redirect=/cs/inquiry');
    expect(screen.getByRole('link', { name: '로그인하고 문의하기' }))
      .toHaveClass('loginButton');
    expect(screen.getByRole('heading', { level: 2, name: '로그인 후 1:1 문의를 남길 수 있어요' })
      .closest('section'))
      .toHaveClass('loginRequired');
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '문의 등록' })).not.toBeInTheDocument();
  });

  test('submits the authoritative user document email and name', async () => {
    render(<InquiryPage />);

    expect(screen.getByText(/답변 여부와 시점은 보장하지 않습니다/)).toBeInTheDocument();

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
    expect(window.alert).toHaveBeenCalledWith(
      '문의가 저장되었습니다. 문의 내역에서 상태를 확인해 주세요.',
    );
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

  test('opens unread answers from the notification route and then marks them read', async () => {
    jest.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('tab=list') as unknown as ReturnType<typeof useSearchParams>,
    );
    jest.mocked(InquiryService.getUserInquiries).mockResolvedValue([
      createInquiry(),
    ]);

    render(<InquiryPage />);

    expect(await screen.findByText('관리자 답변')).toBeInTheDocument();
    await waitFor(() => expect(InquiryService.markInquiriesRead)
      .toHaveBeenCalledWith(['answered-1'], 'customer'));
  });

  test('returns to the write tab when the same route loses the list query', async () => {
    jest.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('tab=list') as unknown as ReturnType<typeof useSearchParams>,
    );
    const view = render(<InquiryPage />);

    expect(await screen.findByText('등록된 문의가 없습니다.')).toBeInTheDocument();

    jest.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams() as unknown as ReturnType<typeof useSearchParams>,
    );
    view.rerender(<InquiryPage />);

    expect(await screen.findByText(/답변 여부와 시점은 보장하지 않습니다/)).toBeInTheDocument();
    expect(screen.queryByText('등록된 문의가 없습니다.')).not.toBeInTheDocument();
  });

  test('ignores a previous account response after the authenticated uid changes', async () => {
    jest.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('tab=list') as unknown as ReturnType<typeof useSearchParams>,
    );
    const previousAccountRequest = createDeferred<ReturnType<typeof createInquiry>[]>();
    const currentAccountRequest = createDeferred<ReturnType<typeof createInquiry>[]>();
    jest.mocked(InquiryService.getUserInquiries).mockImplementation((uid) => (
      uid === 'owner-1' ? previousAccountRequest.promise : currentAccountRequest.promise
    ));

    const view = render(<InquiryPage />);

    mockAuth({
      user: { uid: 'owner-2', email: 'owner-2@example.com', displayName: '새 계정' },
      userData: {
        email: 'owner-2@example.com',
        name: '새 계정',
        status: 'active',
        role: 'user',
      },
    });
    view.rerender(<InquiryPage />);

    await act(async () => {
      currentAccountRequest.resolve([
        createInquiry({
          id: 'current-account',
          userId: 'owner-2',
          userEmail: 'owner-2@example.com',
          userName: '새 계정',
          title: '새 계정 문의',
          unreadForCustomer: false,
        }),
      ]);
    });
    expect(await screen.findByText('새 계정 문의')).toBeInTheDocument();

    await act(async () => {
      previousAccountRequest.resolve([
        createInquiry({ id: 'stale-account', title: '이전 계정 문의' }),
      ]);
    });

    expect(screen.queryByText('이전 계정 문의')).not.toBeInTheDocument();
    expect(InquiryService.markInquiriesRead).not.toHaveBeenCalledWith(
      ['stale-account'],
      'customer',
    );
  });

  test('deduplicates an unread marking request during consecutive list loads in Strict Mode', async () => {
    jest.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('tab=list') as unknown as ReturnType<typeof useSearchParams>,
    );
    const markRequest = createDeferred<void>();
    jest.mocked(InquiryService.getUserInquiries).mockResolvedValue([createInquiry()]);
    jest.mocked(InquiryService.markInquiriesRead).mockReturnValue(markRequest.promise);

    render(
      <StrictMode>
        <InquiryPage />
      </StrictMode>,
    );

    expect(await screen.findByText('관리자 답변')).toBeInTheDocument();
    await waitFor(() => expect(InquiryService.markInquiriesRead).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: '문의하기' }));
    fireEvent.click(screen.getByRole('button', { name: '문의내역' }));
    await waitFor(() => expect(InquiryService.getUserInquiries).toHaveBeenCalledTimes(3));
    expect(InquiryService.markInquiriesRead).toHaveBeenCalledTimes(1);

    await act(async () => {
      markRequest.reject(new Error('읽음 처리 실패'));
    });
    await waitFor(() => expect(console.error).toHaveBeenCalledWith(
      '문의 답변 읽음 처리 실패:',
      expect.any(Error),
    ));
    expect(InquiryService.markInquiriesRead).toHaveBeenCalledTimes(1);
    expect(screen.getByText('관리자 답변')).toBeInTheDocument();
  });

  test('shows a retryable in-page error when the inquiry list fails to load', async () => {
    jest.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('tab=list') as unknown as ReturnType<typeof useSearchParams>,
    );
    jest.mocked(InquiryService.getUserInquiries)
      .mockRejectedValueOnce(new Error('목록 조회 실패'))
      .mockResolvedValueOnce([]);

    render(<InquiryPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('문의 내역을 불러오지 못했습니다.');
    expect(screen.queryByText('등록된 문의가 없습니다.')).not.toBeInTheDocument();
    expect(InquiryService.markInquiriesRead).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByText('등록된 문의가 없습니다.')).toBeInTheDocument();
    expect(InquiryService.getUserInquiries).toHaveBeenCalledTimes(2);
  });
});
