import { renderToStaticMarkup } from 'react-dom/server';
import ProductCard from './ProductCard';
import { useUserActivity } from '@/context/userActivityProvider';
import { useAuthUser } from '@/shared/hooks/useAuthUser';

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

jest.mock('@/context/userActivityProvider', () => ({
  useUserActivity: jest.fn(),
}));

jest.mock('@/shared/hooks/useAuthUser', () => ({
  useAuthUser: jest.fn(),
}));

describe('ProductCard operating metadata', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useUserActivity).mockReturnValue({
      wishlistItems: [],
      addToWishlist: jest.fn(),
      removeFromWishlist: jest.fn(),
    } as unknown as ReturnType<typeof useUserActivity>);
    jest.mocked(useAuthUser).mockReturnValue({
      user: null,
    } as unknown as ReturnType<typeof useAuthUser>);
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
});
