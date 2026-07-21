import { render, screen } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { ReactNode } from 'react';
import QnAListPage from './page';
import { QnAService } from '@/shared/services/qnaService';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock('@/shared/services/qnaService', () => ({
  QnAService: { getQnAList: jest.fn() },
}));

jest.mock('./page.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, property) => String(property),
  }),
}));

describe('QnA public list', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders only the latest batch without stale views or pagination controls', async () => {
    jest.mocked(QnAService.getQnAList).mockResolvedValue({
      qnas: [{
        id: 'qna-1',
        userName: '홍**',
        category: 'general',
        title: '문의 제목',
        content: '문의 내용',
        images: [],
        isSecret: false,
        status: 'waiting',
        views: 27,
        createdAt: new Date('2026-07-20T00:00:00.000Z'),
        updatedAt: new Date('2026-07-20T00:00:00.000Z'),
      }],
      pagination: { page: 1, limit: 50, totalCount: 1, totalPages: 2 },
    });

    render(<QnAListPage />);

    await screen.findByText('문의 제목');
    expect(QnAService.getQnAList).toHaveBeenCalledWith({}, 1, 50);
    expect(screen.queryByText('조회 27')).toBeNull();
    expect(screen.queryByRole('button', { name: '이전' })).toBeNull();
    expect(screen.queryByRole('button', { name: '다음' })).toBeNull();
  });

  test.each(['views', 'pagination', 'pageButton'])(
    'removes the unused %s CSS surface',
    (selector) => {
      const css = readFileSync(resolve(process.cwd(), 'src/app/qna/page.module.css'), 'utf8');

      expect(css).not.toContain(`.${selector}`);
    }
  );
});
