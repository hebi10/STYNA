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

jest.mock('./_components/FeaturedProducts', () => ({
  __esModule: true,
  default: () => <section><h2>관리자 추천 상품</h2></section>,
}));

jest.mock('./_components/style-now/StyleNowSection', () => ({
  __esModule: true,
  default: () => <section>mock style now</section>,
}));

describe('Home editorial composition', () => {
  test('renders operating traces for a curated daily shopping mall', () => {
    const markup = renderToStaticMarkup(<Home />);

    expect(markup).toContain('<h1 class="visuallyHidden">STYNA 패션 쇼핑몰</h1>');

    expect(markup).toContain('스타일 조합 안내');
    expect(markup).toContain('여름 셋업 조합');
    expect(markup).toContain('상품 데이터');
    expect(markup).toContain('편집 추천');
    expect(markup).toContain('등록된 리뷰 수를 기준으로 정렬한 상위 8개 상품');
    expect(markup).toContain('PORTFOLIO DEMO');
    expect(markup).toContain('회원가입 완료 시 5,000P');
    expect(markup).not.toContain('신규 회원 쿠폰');
    expect(markup).toContain('아래 문구와 평점은 포트폴리오 데모용 예시이며 실제 고객 리뷰가 아닙니다.');
    expect(markup).toContain('현재 적용 가능한 혜택은 이벤트 페이지에서 확인하세요.');
    expect(markup).toContain('검증 완료된 이벤트만 표시됩니다.');
    expect(markup).toContain('상품별 평점·리뷰 확인');
    expect(markup).toContain('현재 할인가가 등록된 상품');
    expect(markup).toContain('신상품');
    expect(markup).toContain('편집 추천');
    expect(markup).not.toMatch(/이번 주|MD가.*골랐|구김이 덜한|오래 걸어도 편한/);
    expect(markup).not.toMatch(/리뷰 4\.7 이상|일주일 특가/);
    expect(markup).toContain('PORTFOLIO CONTACT');
    expect(markup).toContain('답변 시점은 보장하지 않습니다');
    expect(markup).not.toContain('CUSTOMER CENTER');
    expect(markup).not.toContain('최근 7일간 리뷰 수와 장바구니 저장 수를 기준으로 집계했습니다.');
    expect(markup).not.toContain('07.14까지');
    expect(markup).toContain('category visual mode: image');
    expect(markup).toContain('관리자 추천 상품');
    expect(markup).toContain('mock style now');
    expect(markup.lastIndexOf('mock style now')).toBeGreaterThan(
      markup.lastIndexOf('PORTFOLIO'),
    );
  });

  test('keeps the main page compact instead of rendering duplicate editorial grids', () => {
    const markup = renderToStaticMarkup(<Home />);

    expect(markup).not.toContain('MINIMAL DAILY SELECT');
    expect(markup).not.toContain('카테고리별 상품 모의 영역');
  });
});
