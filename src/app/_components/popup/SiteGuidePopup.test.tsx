import { renderToStaticMarkup } from 'react-dom/server';
import {
  buildDemoDataNotice,
  formatShippingPolicy,
  formatSignupBenefit,
  formatSupportHours,
} from '@/shared/constants/commercePolicy';
import SiteGuidePopup from './SiteGuidePopup';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock('./SiteGuidePopup.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, property) => String(property),
  }),
}));

describe('SiteGuidePopup policy copy', () => {
  test('shows canonical shipping, signup, demo, and support policies', () => {
    const markup = renderToStaticMarkup(
      <SiteGuidePopup isOpen onClose={jest.fn()} />,
    );

    expect(markup).toContain(formatShippingPolicy());
    expect(markup).toContain(formatSignupBenefit());
    expect(markup).toContain(buildDemoDataNotice());
    expect(markup).toContain(formatSupportHours());
    expect(markup).not.toMatch(
      /생일 쿠폰|구매 적립|당일 출고|수령 후 7일|무료 교환|구매.*1%/,
    );
  });

  test('renders nothing while closed', () => {
    expect(renderToStaticMarkup(
      <SiteGuidePopup isOpen={false} onClose={jest.fn()} />,
    )).toBe('');
  });
});
