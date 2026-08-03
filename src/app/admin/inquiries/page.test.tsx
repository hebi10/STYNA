import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useSearchParams } from 'next/navigation';
import AdminInquiriesPage from './page';
import { InquiryService } from '@/shared/services/inquiryService';
import { Inquiry } from '@/shared/types/inquiry';

jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
}));

jest.mock('@/shared/services/inquiryService', () => ({
  InquiryService: {
    getAllInquiries: jest.fn(),
    markInquiriesRead: jest.fn(),
    answerInquiry: jest.fn(),
    updateInquiryStatus: jest.fn(),
  },
}));

jest.mock('./page.module.css', () => new Proxy({}, {
  get: (_target, property) => String(property),
}));

function makeInquiry(overrides: Partial<Inquiry> = {}): Inquiry {
  return {
    id: 'inquiry-1',
    userId: 'owner-1',
    userEmail: 'owner-1@example.com',
    userName: '작성자',
    category: 'other',
    title: '문의',
    content: '문의 내용',
    status: 'waiting',
    createdAt: new Date('2026-08-03T00:00:00.000Z'),
    updatedAt: new Date('2026-08-03T00:00:00.000Z'),
    unreadForAdmin: false,
    unreadForCustomer: false,
    ...overrides,
  };
}

describe('AdminInquiriesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(window, 'alert').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.mocked(InquiryService.getAllInquiries).mockResolvedValue([]);
    jest.mocked(InquiryService.markInquiriesRead).mockResolvedValue();
    jest.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams() as unknown as ReturnType<typeof useSearchParams>,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('keeps unread inquiries visible after marking them read', async () => {
    jest.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('filter=unread') as unknown as ReturnType<typeof useSearchParams>,
    );
    jest.mocked(InquiryService.getAllInquiries).mockResolvedValue([
      makeInquiry({ id: 'new-1', unreadForAdmin: true, title: '새 문의' }),
      makeInquiry({ id: 'read-1', unreadForAdmin: false, title: '기존 문의' }),
    ]);
    jest.mocked(InquiryService.markInquiriesRead).mockResolvedValue();

    render(<AdminInquiriesPage />);

    expect(await screen.findByRole('heading', { name: '새 문의' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '기존 문의' })).not.toBeInTheDocument();
    await waitFor(() => expect(InquiryService.markInquiriesRead)
      .toHaveBeenCalledWith(['new-1'], 'admin'));
    expect(screen.getByRole('heading', { name: '새 문의' })).toBeInTheDocument();
  });

  test('synchronizes the status filter when the unread query parameter is removed', async () => {
    jest.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('filter=unread') as unknown as ReturnType<typeof useSearchParams>,
    );
    jest.mocked(InquiryService.getAllInquiries).mockResolvedValue([
      makeInquiry({ id: 'new-1', unreadForAdmin: true, title: '새 문의' }),
      makeInquiry({ id: 'read-1', unreadForAdmin: false, title: '기존 문의' }),
    ]);

    const { rerender } = render(<AdminInquiriesPage />);

    expect(await screen.findByRole('heading', { name: '새 문의' })).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')[0]).toHaveValue('unread');

    jest.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams() as unknown as ReturnType<typeof useSearchParams>,
    );
    rerender(<AdminInquiriesPage />);

    await waitFor(() => expect(screen.getAllByRole('combobox')[0]).toHaveValue('all'));
    expect(await screen.findByRole('heading', { name: '기존 문의' })).toBeInTheDocument();
  });

  test('marks only unread inquiries remaining after the category filter', async () => {
    jest.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('filter=unread') as unknown as ReturnType<typeof useSearchParams>,
    );
    jest.mocked(InquiryService.getAllInquiries).mockResolvedValue([
      makeInquiry({ id: 'order-1', unreadForAdmin: true, category: 'order', title: '주문 문의' }),
      makeInquiry({ id: 'delivery-1', unreadForAdmin: true, category: 'delivery', title: '배송 문의' }),
    ]);

    render(<AdminInquiriesPage />);

    await waitFor(() => expect(InquiryService.markInquiriesRead)
      .toHaveBeenCalledWith(['order-1', 'delivery-1'], 'admin'));
    jest.mocked(InquiryService.markInquiriesRead).mockClear();

    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'order' } });

    await waitFor(() => expect(InquiryService.markInquiriesRead)
      .toHaveBeenCalledWith(['order-1'], 'admin'));
    expect(screen.getByRole('heading', { name: '주문 문의' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '배송 문의' })).not.toBeInTheDocument();
  });

  test('marks only unread inquiries remaining after the search filter', async () => {
    jest.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('filter=unread') as unknown as ReturnType<typeof useSearchParams>,
    );
    jest.mocked(InquiryService.getAllInquiries).mockResolvedValue([
      makeInquiry({ id: 'order-1', unreadForAdmin: true, title: '주문 문의' }),
      makeInquiry({ id: 'delivery-1', unreadForAdmin: true, title: '배송 문의' }),
    ]);

    render(<AdminInquiriesPage />);

    await waitFor(() => expect(InquiryService.markInquiriesRead)
      .toHaveBeenCalledWith(['order-1', 'delivery-1'], 'admin'));
    jest.mocked(InquiryService.markInquiriesRead).mockClear();

    fireEvent.change(screen.getByPlaceholderText('제목, 내용, 작성자로 검색...'), {
      target: { value: '배송' },
    });

    await waitFor(() => expect(InquiryService.markInquiriesRead)
      .toHaveBeenCalledWith(['delivery-1'], 'admin'));
    expect(screen.getByRole('heading', { name: '배송 문의' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '주문 문의' })).not.toBeInTheDocument();
  });

  test('does not mark the same inquiry twice while a read request is in flight', async () => {
    let resolveRead!: () => void;
    let loadCount = 0;
    jest.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('filter=unread') as unknown as ReturnType<typeof useSearchParams>,
    );
    jest.mocked(InquiryService.getAllInquiries).mockImplementation(async () => {
      loadCount += 1;
      return [makeInquiry({
        id: 'new-1',
        unreadForAdmin: true,
        title: loadCount >= 3 ? '새 문의 검색 결과' : '새 문의',
      })];
    });
    jest.mocked(InquiryService.markInquiriesRead).mockImplementation(() => new Promise<void>((resolve) => {
      resolveRead = resolve;
    }));

    render(
      <StrictMode>
        <AdminInquiriesPage />
      </StrictMode>,
    );

    await waitFor(() => expect(InquiryService.markInquiriesRead).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByPlaceholderText('제목, 내용, 작성자로 검색...'), {
      target: { value: '새 문의' },
    });
    expect(await screen.findByRole('heading', { name: '새 문의 검색 결과' })).toBeInTheDocument();
    await act(async () => {
      await Promise.resolve();
    });
    expect(InquiryService.markInquiriesRead).toHaveBeenCalledTimes(1);

    await act(async () => resolveRead());
  });

  test('keeps the list and does not retry the same read immediately after failure', async () => {
    let loadCount = 0;
    jest.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('filter=unread') as unknown as ReturnType<typeof useSearchParams>,
    );
    jest.mocked(InquiryService.getAllInquiries).mockImplementation(async () => {
      loadCount += 1;
      return [makeInquiry({
        id: 'new-1',
        unreadForAdmin: true,
        title: loadCount >= 2 ? '새 문의 검색 결과' : '새 문의',
      })];
    });
    jest.mocked(InquiryService.markInquiriesRead).mockRejectedValue(new Error('write failed'));

    render(<AdminInquiriesPage />);

    expect(await screen.findByRole('heading', { name: '새 문의' })).toBeInTheDocument();
    await waitFor(() => expect(console.error).toHaveBeenCalledWith(
      '신규 문의 읽음 처리 실패:',
      expect.any(Error),
    ));

    fireEvent.change(screen.getByPlaceholderText('제목, 내용, 작성자로 검색...'), {
      target: { value: '새 문의' },
    });
    expect(await screen.findByRole('heading', { name: '새 문의 검색 결과' })).toBeInTheDocument();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(InquiryService.markInquiriesRead).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: '새 문의 검색 결과' })).toBeInTheDocument();
  });

  test('ignores a stale load response after a newer request has rendered', async () => {
    let resolveFirstLoad!: (inquiries: Inquiry[]) => void;
    let resolveSecondLoad!: (inquiries: Inquiry[]) => void;
    jest.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('filter=unread') as unknown as ReturnType<typeof useSearchParams>,
    );
    jest.mocked(InquiryService.getAllInquiries)
      .mockImplementationOnce(() => new Promise<Inquiry[]>((resolve) => {
        resolveFirstLoad = resolve;
      }))
      .mockImplementationOnce(() => new Promise<Inquiry[]>((resolve) => {
        resolveSecondLoad = resolve;
      }));

    render(
      <StrictMode>
        <AdminInquiriesPage />
      </StrictMode>,
    );

    await waitFor(() => expect(InquiryService.getAllInquiries).toHaveBeenCalledTimes(2));
    await act(async () => resolveSecondLoad([
      makeInquiry({ id: 'latest-1', unreadForAdmin: true, title: '최신 문의' }),
    ]));
    expect(await screen.findByRole('heading', { name: '최신 문의' })).toBeInTheDocument();
    await waitFor(() => expect(InquiryService.markInquiriesRead)
      .toHaveBeenCalledWith(['latest-1'], 'admin'));

    await act(async () => resolveFirstLoad([
      makeInquiry({ id: 'stale-1', unreadForAdmin: true, title: '오래된 문의' }),
    ]));

    expect(screen.getByRole('heading', { name: '최신 문의' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '오래된 문의' })).not.toBeInTheDocument();
    expect(InquiryService.markInquiriesRead).not.toHaveBeenCalledWith(['stale-1'], 'admin');
  });

  test('clears the load error after a retry succeeds', async () => {
    jest.mocked(InquiryService.getAllInquiries)
      .mockRejectedValueOnce(new Error('load failed'))
      .mockResolvedValueOnce([
        makeInquiry({ id: 'recovered-1', title: '복구된 문의' }),
      ]);

    render(<AdminInquiriesPage />);

    expect(await screen.findByText('문의 목록을 불러오는데 실패했습니다.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByRole('heading', { name: '복구된 문의' })).toBeInTheDocument();
    expect(screen.queryByText('문의 목록을 불러오는데 실패했습니다.')).not.toBeInTheDocument();
  });

  test('does not mark inquiries read when the list fails to load', async () => {
    jest.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('filter=unread') as unknown as ReturnType<typeof useSearchParams>,
    );
    jest.mocked(InquiryService.getAllInquiries).mockRejectedValue(new Error('load failed'));

    render(<AdminInquiriesPage />);

    expect(await screen.findByText('문의 목록을 불러오는데 실패했습니다.')).toBeInTheDocument();
    expect(InquiryService.markInquiriesRead).not.toHaveBeenCalled();
  });

  test('submits the selected inquiry answer through the service contract', async () => {
    jest.mocked(InquiryService.getAllInquiries).mockResolvedValue([
      makeInquiry({ id: 'new-1', title: '새 문의' }),
    ]);
    jest.mocked(InquiryService.answerInquiry).mockResolvedValue();

    render(<AdminInquiriesPage />);

    await screen.findByRole('heading', { name: '새 문의' });
    fireEvent.click(screen.getByRole('button', { name: '답변하기' }));
    fireEvent.change(screen.getByLabelText('답변 내용'), { target: { value: '관리자 답변' } });
    fireEvent.click(screen.getByRole('button', { name: '답변 저장' }));

    await waitFor(() => expect(InquiryService.answerInquiry).toHaveBeenCalledWith('new-1', {
      content: '관리자 답변',
      answeredBy: 'Admin',
    }));
  });
});
