import { renderToStaticMarkup } from 'react-dom/server';
import Home from './page';

jest.mock('./page.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, prop) => String(prop),
  }),
}));

jest.mock('./_components/MainBanner', () => ({
  __esModule: true,
  default: () => <section aria-label="mock main banner" />,
}));

jest.mock('./_components/DynamicCategorySection', () => ({
  __esModule: true,
  default: ({ visualMode = 'image' }: { visualMode?: 'image' | 'text' }) => (
    <div>category visual mode: {visualMode}</div>
  ),
}));

jest.mock('./_components/CategoryProductTabs', () => ({
  __esModule: true,
  default: () => <section>카테고리별 상품 모의 영역</section>,
}));

jest.mock('./_components/ProductSection', () => ({
  __esModule: true,
  default: ({ title, subtitle, description }: {
    title: string;
    subtitle?: string;
    description?: string;
  }) => (
    <section>
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
      {description && <p>{description}</p>}
    </section>
  ),
}));

jest.mock('./_components/FeaturedProducts', () => ({
  __esModule: true,
  default: ({ title, subtitle, description }: {
    title: string;
    subtitle?: string;
    description?: string;
  }) => (
    <section>
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
      {description && <p>{description}</p>}
    </section>
  ),
}));

describe('Home editorial composition', () => {
  test('renders operating traces for a curated daily shopping mall', () => {
    const markup = renderToStaticMarkup(<Home />);

    expect(markup).toContain('오늘의 기획전');
    expect(markup).toContain('출근룩을 가볍게 완성하는 여름 셋업');
    expect(markup).toContain('MD 기준');
    expect(markup).toContain("MD&#x27;S NOTE");
    expect(markup).toContain('최근 7일간 리뷰 수와 장바구니 저장 수를 기준으로 집계했습니다.');
    expect(markup).toContain('REVIEW HIGHLIGHT');
    expect(markup).toContain('7월 멤버십 위크');
    expect(markup).toContain('category visual mode: image');
  });

  test('keeps the main page compact instead of rendering duplicate editorial grids', () => {
    const markup = renderToStaticMarkup(<Home />);

    expect(markup).not.toContain('MINIMAL DAILY SELECT');
    expect(markup).not.toContain('카테고리별 상품 모의 영역');
  });
});
