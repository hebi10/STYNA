import { renderToStaticMarkup } from 'react-dom/server';
import Header from './Header';
import { useAuth } from '@/context/authProvider';
import { useCartItemCount } from '@/shared/hooks/useCart';
import { CategoryOrderService } from '@/shared/services/categoryOrderService';
import {
  formatShippingPolicy,
  formatSignupBenefit,
} from '@/shared/constants/commercePolicy';

jest.mock('./Header.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, prop) => String(prop),
  }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock('@/context/authProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/shared/hooks/useCart', () => ({
  useCartItemCount: jest.fn(),
}));

jest.mock('@/shared/services/categoryOrderService', () => ({
  CategoryOrderService: {
    getSortedCategories: jest.fn(),
  },
}));

jest.mock('@/shared/utils/categoryUtils', () => ({
  DEFAULT_CATEGORY_IDS: ['tops', 'bags', 'shoes', 'jewelry'],
  getDefaultCategoryNames: () => ({
    tops: '상의',
    bags: '가방',
    shoes: '신발',
    jewelry: '주얼리',
  }),
}));

describe('Header', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAuth).mockReturnValue({
      user: null,
      isAdmin: false,
      logout: jest.fn(),
    } as unknown as ReturnType<typeof useAuth>);
    jest.mocked(useCartItemCount).mockReturnValue({
      data: 0,
    } as unknown as ReturnType<typeof useCartItemCount>);
    jest.mocked(CategoryOrderService.getSortedCategories).mockResolvedValue([]);
  });

  test('renders only implemented commerce announcements', () => {
    const markup = renderToStaticMarkup(<Header />);

    expect(markup).toContain('class="header');
    expect(markup).toContain(formatSignupBenefit());
    expect(markup).toContain(formatShippingPolicy());
    expect(markup).not.toMatch(/10% 쿠폰|오늘 출고|당일 출고|구매.*1%/);
  });

  test('includes an all-products entry point in the primary navigation', () => {
    const markup = renderToStaticMarkup(<Header />);

    expect(markup).toContain('href="/products"');
  });
});
