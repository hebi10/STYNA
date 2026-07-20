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

describe('Home editorial composition', () => {
  test('renders operating traces for a curated daily shopping mall', () => {
    const markup = renderToStaticMarkup(<Home />);

    expect(markup).toContain('오늘의 기획전');
    expect(markup).toContain('출근룩을 가볍게 완성하는 여름 셋업');
    expect(markup).toContain('MD 기준');
    expect(markup).toContain("MD&#x27;S NOTE");
    expect(markup).toContain('등록된 리뷰 수를 기준으로 정렬한 상위 8개 상품');
    expect(markup).toContain('PORTFOLIO DEMO');
    expect(markup).toContain('아래 문구와 평점은 포트폴리오 데모용 예시이며 실제 고객 리뷰가 아닙니다.');
    expect(markup).toContain('현재 적용 가능한 혜택은 이벤트 페이지에서 확인하세요.');
    expect(markup).not.toContain('최근 7일간 리뷰 수와 장바구니 저장 수를 기준으로 집계했습니다.');
    expect(markup).not.toContain('07.14까지');
    expect(markup).toContain('category visual mode: image');
  });

  test('keeps the main page compact instead of rendering duplicate editorial grids', () => {
    const markup = renderToStaticMarkup(<Home />);

    expect(markup).not.toContain('MINIMAL DAILY SELECT');
    expect(markup).not.toContain('카테고리별 상품 모의 영역');
  });
});
