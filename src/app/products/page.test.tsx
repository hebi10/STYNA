import { renderToStaticMarkup } from 'react-dom/server';
import ProductsPage from './page';

jest.mock('@/app/_components/PageHeader', () => ({
  __esModule: true,
  default: () => <header>상품 헤더</header>,
}));

jest.mock('./page.module.css', () => ({
  container: 'container',
  content: 'content',
}));

jest.mock('./_components/ProductList', () => ({
  __esModule: true,
  default: function SuspendedProductList() {
    throw Promise.resolve();
  },
}));

describe('ProductsPage', () => {
  test('검색 파라미터를 읽는 상품 목록을 Suspense 경계 안에서 렌더링한다', () => {
    const markup = renderToStaticMarkup(<ProductsPage />);

    expect(markup).toContain('role="status"');
    expect(markup).toContain('상품 목록을 준비 중입니다.');
  });
});
