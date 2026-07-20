import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import QnAWritePage from './page';
import { useAuth } from '@/context/authProvider';
import { SimpleQnAService } from '@/shared/services/simpleQnAService';

const push = jest.fn();
const back = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, back }),
  useSearchParams: () => ({ get: () => null }),
}));

jest.mock('@/context/authProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/shared/services/simpleQnAService', () => ({
  SimpleQnAService: {
    createQnA: jest.fn(),
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

describe('QnA write account identity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth();
    jest.mocked(SimpleQnAService.createQnA).mockResolvedValue('qna-1');
  });

  test('submits the authoritative user document email and name', async () => {
    render(<QnAWritePage />);

    fireEvent.change(screen.getByPlaceholderText('문의 제목을 입력해주세요'), {
      target: { value: '문의 제목' },
    });
    fireEvent.change(screen.getByPlaceholderText('문의 내용을 자세히 작성해주세요'), {
      target: { value: '문의 내용' },
    });
    fireEvent.click(screen.getByRole('button', { name: '문의 등록' }));

    await waitFor(() => expect(SimpleQnAService.createQnA).toHaveBeenCalledWith(
      'owner-1',
      'owner-1@example.com',
      '문서 작성자',
      expect.objectContaining({ title: '문의 제목', content: '문의 내용' })
    ));
  });

  test.each([
    ['loading', { isUserDataLoading: true }],
    ['missing', { userData: null }],
  ])('blocks submission while authoritative user data is %s', async (_state, overrides) => {
    mockAuth(overrides);
    const { container } = render(<QnAWritePage />);

    fireEvent.change(screen.getByPlaceholderText('문의 제목을 입력해주세요'), {
      target: { value: '문의 제목' },
    });
    fireEvent.change(screen.getByPlaceholderText('문의 내용을 자세히 작성해주세요'), {
      target: { value: '문의 내용' },
    });
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    await waitFor(() => expect(SimpleQnAService.createQnA).not.toHaveBeenCalled());
    expect(screen.getByRole('button', { name: '문의 등록' })).toBeDisabled();
  });
});
