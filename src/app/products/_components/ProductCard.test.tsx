import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen } from '@testing-library/react';
import ProductCard from './ProductCard';
import { useWishlistActivity } from '@/shared/hooks/useUserActivityQueries';
import { useAuth } from '@/context/authProvider';

jest.mock('./ProductCard.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, prop) => String(prop),
  }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => {
    const { alt, ...imageProps } = props;
    delete imageProps.fill;
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt} {...imageProps} />;
  },
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

jest.mock('@/shared/hooks/useUserActivityQueries', () => ({
  useWishlistActivity: jest.fn(),
}));

jest.mock('@/context/authProvider', () => ({
  useAuth: jest.fn(),
}));

describe('ProductCard operating metadata', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useWishlistActivity).mockReturnValue({
      wishlistItems: [],
      addToWishlist: jest.fn(),
      removeFromWishlist: jest.fn(),
    } as unknown as ReturnType<typeof useWishlistActivity>);
    jest.mocked(useAuth).mockReturnValue({
      user: null,
    } as unknown as ReturnType<typeof useAuth>);
  });

  test('renders MD comment and operating labels when provided', () => {
    const markup = renderToStaticMarkup(
      <ProductCard
        id="daily-shirt"
        name="클래식 코튼 셔츠"
        brand="STYNA"
        price={32000}
        image="/sample.webp"
        stock={8}
        rating={4.8}
        reviewCount={128}
        operationLabel="MD추천"
        shippingLabel="오늘출발"
        mdComment="탄탄한 20수 코튼 소재로 단독 착용이 좋습니다."
      />,
    );

    expect(markup).toContain('MD추천');
    expect(markup).toContain('오늘출발');
    expect(markup).toContain('탄탄한 20수 코튼 소재로 단독 착용이 좋습니다.');
  });

  test('keeps the product link and wishlist button as sibling interactions', () => {
    const { container } = render(
      <ProductCard
        id="daily-shirt"
        name="클래식 코튼 셔츠"
        brand="STYNA"
        price={32000}
        image="/sample.webp"
        stock={8}
      />,
    );

    expect(container.querySelector('a button')).toBeNull();
    expect(screen.getByRole('link', { name: /클래식 코튼 셔츠/ })).toHaveAttribute(
      'href',
      '/products/daily-shirt',
    );
    expect(screen.getByRole('button', {
      name: '클래식 코튼 셔츠 위시리스트에 추가',
    })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  test('exposes the current wishlist state in the button name and aria-pressed', () => {
    jest.mocked(useWishlistActivity).mockReturnValue({
      wishlistItems: [{ productId: 'daily-shirt' }],
      addToWishlist: jest.fn(),
      removeFromWishlist: jest.fn(),
    } as unknown as ReturnType<typeof useWishlistActivity>);

    render(
      <ProductCard
        id="daily-shirt"
        name="클래식 코튼 셔츠"
        brand="STYNA"
        price={32000}
        image="/sample.webp"
        stock={8}
      />,
    );

    expect(screen.getByRole('button', {
      name: '클래식 코튼 셔츠 위시리스트에서 제거',
    })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
