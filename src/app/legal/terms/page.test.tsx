import { renderToStaticMarkup } from 'react-dom/server';
import TermsPage from './page';

jest.mock('./page.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, property) => String(property),
  }),
}));

describe('TermsPage demo boundary', () => {
  test('publishes a portfolio usage notice instead of fabricated legal terms', () => {
    const markup = renderToStaticMarkup(<TermsPage />);

    expect(markup).toContain('포트폴리오 데모 이용 안내');
    expect(markup).toContain('실제 이용약관이 아닙니다');
    expect(markup).toContain('실제 구매계약·결제·배송');
    expect(markup).toContain('Firebase');
    expect(markup).not.toMatch(
      /㈜스티나몰|1588-1234|중요한 법적 문서|약관의 효력|관할법원|대한민국법에 의해 규율/,
    );
  });
});
