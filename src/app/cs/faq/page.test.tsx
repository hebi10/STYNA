import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SiteContentService } from '@/shared/services/siteContentService';
import FAQPage from './page';

jest.mock('@/shared/services/siteContentService', () => ({
  SiteContentService: {
    getFaqs: jest.fn(),
  },
}));

jest.mock('./page.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, property) => String(property),
  }),
}));

describe('FAQPage accessibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('defers the page-level h1 to the CS layout', async () => {
    jest.mocked(SiteContentService.getFaqs).mockResolvedValue([]);

    render(<FAQPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '검색 결과가 없습니다' }))
        .toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { level: 2, name: '자주 묻는 질문' }))
      .toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });

  test('labels FAQ search and connects each accordion trigger to its answer region', async () => {
    jest.mocked(SiteContentService.getFaqs).mockResolvedValue([
      {
        id: 'shipping',
        category: '배송',
        question: '배송비는 얼마인가요?',
        answer: '일반 배송비는 주문 조건에 따라 계산됩니다.',
        order: 1,
      },
    ]);

    render(<FAQPage />);

    expect(screen.getByRole('textbox', { name: 'FAQ 검색' })).toBeInTheDocument();
    const trigger = await screen.findByRole('button', { name: /배송비는 얼마인가요/ });

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-controls', 'faq-answer-shipping');
    expect(screen.queryByRole('region')).not.toBeInTheDocument();

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const answer = screen.getByRole('region');
    expect(answer).toHaveAttribute('id', 'faq-answer-shipping');
    expect(answer).toHaveAttribute('aria-labelledby', 'faq-question-shipping');
    expect(trigger).toHaveAttribute('id', 'faq-question-shipping');
    expect(answer).toHaveTextContent('일반 배송비는 주문 조건에 따라 계산됩니다.');
  });
});
