import { render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import QnADetailPage from './page';
import { QnAService } from '@/shared/services/qnaService';
import { PublicQnA } from '@/shared/types/qna';

const push = jest.fn();

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'qna-1' }),
  useRouter: () => ({ push, back: jest.fn() }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/shared/services/qnaService', () => ({
  QnAService: { getQnAWithAccessCheck: jest.fn() },
}));

jest.mock('./page.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, property) => String(property),
  }),
}));

function qna(): PublicQnA {
  return {
    id: 'qna-1',
    userName: 'owner name',
    category: 'general',
    title: '문의',
    content: '문의 내용',
    images: [],
    isSecret: false,
    status: 'waiting',
    views: 0,
    createdAt: new Date('2026-07-20T00:00:00.000Z'),
    updatedAt: new Date('2026-07-20T00:00:00.000Z'),
  };
}

describe('QnA detail actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('does not render a broken edit action for a route that does not exist', async () => {
    jest.mocked(QnAService.getQnAWithAccessCheck).mockResolvedValue({
      success: true,
      qna: qna(),
    });
    const { container } = render(<QnADetailPage />);

    await waitFor(() => expect(QnAService.getQnAWithAccessCheck).toHaveBeenCalled());
    expect(container.querySelector('.editButton')).toBeNull();
    expect(push).not.toHaveBeenCalledWith('/qna/edit/qna-1');
  });

  test('does not render a stale view count for read-only detail requests', async () => {
    jest.mocked(QnAService.getQnAWithAccessCheck).mockResolvedValue({
      success: true,
      qna: { ...qna(), views: 27 },
    });
    render(<QnADetailPage />);

    await waitFor(() => expect(QnAService.getQnAWithAccessCheck).toHaveBeenCalled());
    expect(screen.queryByText('조회수 27')).toBeNull();
  });

  test.each([
    'modalOverlay',
    'modal',
    'modalHeader',
    'modalContent',
    'passwordInput',
    'passwordError',
    'modalActions',
    'cancelButton',
    'submitButton',
    'editButton',
  ])('does not keep the removed %s CSS surface', (selector) => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/app/qna/[id]/page.module.css'),
      'utf8'
    );

    expect(css).not.toContain(`.${selector}`);
  });
});
