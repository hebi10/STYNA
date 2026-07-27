import { renderToStaticMarkup } from 'react-dom/server';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  test('keeps the existing login alert without starting a wishlist request', () => {
    const addToWishlist = jest.fn();
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => undefined);
    jest.mocked(useWishlistActivity).mockReturnValue({
      wishlistItems: [],
      addToWishlist,
      removeFromWishlist: jest.fn(),
    } as unknown as ReturnType<typeof useWishlistActivity>);

    render(
      <ProductCard
        id="daily-shirt"
        name="클래식 코튼 셔츠"
        brand="STYNA"
        price={32000}
        stock={8}
      />,
    );

    fireEvent.click(screen.getByRole('button', {
      name: '클래식 코튼 셔츠 위시리스트에 추가',
    }));

    expect(alertSpy).toHaveBeenCalledWith('로그인이 필요한 서비스입니다.');
    expect(addToWishlist).not.toHaveBeenCalled();
  });

  test('disables duplicate wishlist requests while the current request is pending', () => {
    const addToWishlist = jest.fn(() => new Promise<void>(() => undefined));
    jest.mocked(useWishlistActivity).mockReturnValue({
      wishlistItems: [],
      addToWishlist,
      removeFromWishlist: jest.fn(),
    } as unknown as ReturnType<typeof useWishlistActivity>);
    jest.mocked(useAuth).mockReturnValue({
      user: { uid: 'member-1' },
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <ProductCard
        id="daily-shirt"
        name="클래식 코튼 셔츠"
        brand="STYNA"
        price={32000}
        stock={8}
      />,
    );
    const wishlistButton = screen.getByRole('button', {
      name: '클래식 코튼 셔츠 위시리스트에 추가',
    });

    fireEvent.click(wishlistButton);

    expect(wishlistButton).toBeDisabled();
    expect(wishlistButton).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(wishlistButton);
    expect(addToWishlist).toHaveBeenCalledTimes(1);
  });

  test('shows an accessible retryable error after a wishlist request fails', async () => {
    const addToWishlist = jest.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    jest.mocked(useWishlistActivity).mockReturnValue({
      wishlistItems: [],
      addToWishlist,
      removeFromWishlist: jest.fn(),
    } as unknown as ReturnType<typeof useWishlistActivity>);
    jest.mocked(useAuth).mockReturnValue({
      user: { uid: 'member-1' },
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <ProductCard
        id="daily-shirt"
        name="클래식 코튼 셔츠"
        brand="STYNA"
        price={32000}
        stock={8}
      />,
    );

    fireEvent.click(screen.getByRole('button', {
      name: '클래식 코튼 셔츠 위시리스트에 추가',
    }));

    const feedback = await screen.findByRole('alert');
    expect(feedback).toHaveTextContent('위시리스트를 변경하지 못했습니다. 다시 시도해 주세요.');
    const retryButton = screen.getByRole('button', {
      name: '클래식 코튼 셔츠 위시리스트에 추가 다시 시도',
    });
    expect(retryButton).not.toBeDisabled();
    expect(retryButton).toHaveAttribute('aria-describedby', feedback.id);

    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(addToWishlist).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  test('keeps a successful wishlist request free of error feedback', async () => {
    const addToWishlist = jest.fn().mockResolvedValue(undefined);
    jest.mocked(useWishlistActivity).mockReturnValue({
      wishlistItems: [],
      addToWishlist,
      removeFromWishlist: jest.fn(),
    } as unknown as ReturnType<typeof useWishlistActivity>);
    jest.mocked(useAuth).mockReturnValue({
      user: { uid: 'member-1' },
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <ProductCard
        id="daily-shirt"
        name="클래식 코튼 셔츠"
        brand="STYNA"
        price={32000}
        stock={8}
      />,
    );

    fireEvent.click(screen.getByRole('button', {
      name: '클래식 코튼 셔츠 위시리스트에 추가',
    }));

    await waitFor(() => expect(addToWishlist).toHaveBeenCalledWith('daily-shirt'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
