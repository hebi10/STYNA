import { render, screen, within } from '@testing-library/react';
import Home from './page';

jest.mock('./page.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, property) => String(property),
  }),
}));

jest.mock('./_components/MainBanner', () => ({
  __esModule: true,
  default: () => <section data-testid="home-banner">배너</section>,
}));

jest.mock('./_components/DynamicCategorySection', () => ({
  __esModule: true,
  default: () => <div data-testid="home-categories">카테고리 목록</div>,
}));

jest.mock('./_components/FeaturedProducts', () => ({
  __esModule: true,
  default: ({ eyebrow, description }: { eyebrow?: string; description?: string }) => (
    <section data-testid="home-featured">
      {eyebrow && <p>{eyebrow}</p>}
      <h2>에디터 추천</h2><p>{description}</p>
    </section>
  ),
}));

jest.mock('./_components/ProductSection', () => ({
  __esModule: true,
  default: ({ eyebrow, title, subtitle, type }: { eyebrow?: string; title: string; subtitle?: string; type: string }) => (
    <section data-testid={`home-${type}`}>
      {eyebrow && <p>{eyebrow}</p>}
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
    </section>
  ),
}));

jest.mock('./_components/PortfolioDemoSection', () => ({
  __esModule: true,
  default: () => (
    <section data-testid="home-portfolio">
      <p>PORTFOLIO DEMO</p><h2>포트폴리오 데모 안내</h2>
    </section>
  ),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('Home shopping-first composition', () => {
  test('renders one shopping-first path and one portfolio disclosure section', () => {
    const { container } = render(<Home />);

    expect(screen.getAllByText('PORTFOLIO DEMO')).toHaveLength(1);
    expect(screen.queryByText('스타일 코멘트 예시')).not.toBeInTheDocument();
    expect(screen.queryByText('혜택 안내 예시')).not.toBeInTheDocument();
    expect(screen.queryByText('isNew로 표시된 상품')).not.toBeInTheDocument();
    expect(screen.getByText('이번 주 새로 등록된 상품')).toBeInTheDocument();
    expect(screen.queryByText('SHOP BY USE')).not.toBeInTheDocument();
    expect(screen.queryByText("EDITOR'S SELECTION")).not.toBeInTheDocument();
    expect(screen.queryByText('NEW THIS WEEK')).not.toBeInTheDocument();
    expect(screen.queryByText('BEST RANKING')).not.toBeInTheDocument();
    expect(screen.queryByText('SEASON OFF')).not.toBeInTheDocument();
    expect(screen.queryByText('PORTFOLIO CONTACT')).not.toBeInTheDocument();

    const banner = screen.getByTestId('home-banner');
    const category = screen.getByTestId('home-categories').closest('section') as HTMLElement | null;
    const featured = screen.getByTestId('home-featured');
    const newArrivals = screen.getByTestId('home-new').closest('#new-arrivals') as HTMLElement | null;
    const ranking = screen.getByTestId('home-bestseller').closest('#best-ranking') as HTMLElement | null;
    const sale = screen.getByTestId('home-sale').closest('#sale-products') as HTMLElement | null;
    const portfolio = screen.getByTestId('home-portfolio');
    const orderedSections = [
      banner,
      category,
      featured,
      newArrivals,
      ranking,
      sale,
      portfolio,
    ];

    expect(orderedSections.every((section) => section)).toBe(true);
    const positions = orderedSections.map((section) =>
      Array.from(container.querySelectorAll('section')).indexOf(section!),
    );
    expect(positions).toEqual([...positions].sort((left, right) => left - right));

    const saleSection = sale!;
    expect(within(saleSection).getByTestId('home-sale')).toBeInTheDocument();
    expect(within(saleSection).getByRole('link', { name: '진행 중인 이벤트 보기' }))
      .toHaveAttribute('href', '/events');
  });
});
