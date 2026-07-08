import { render, screen, waitFor } from '@testing-library/react';
import DynamicCategorySection from './DynamicCategorySection';
import { CategoryOrderService } from '@/shared/services/categoryOrderService';

jest.mock('../page.module.css', () => ({
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

jest.mock('@/shared/services/categoryOrderService', () => ({
  CategoryOrderService: {
    getMainPageCategories: jest.fn(),
  },
}));

jest.mock('@/shared/utils/categoryUtils', () => ({
  DEFAULT_CATEGORY_IDS: ['tops', 'bottoms', 'shoes', 'sports'],
  getDefaultCategoryNames: () => ({
    tops: '상의',
    bottoms: '하의',
    shoes: '신발',
    sports: '스포츠',
  }),
}));

describe('DynamicCategorySection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows curated fallback categories immediately in text mode', () => {
    jest.mocked(CategoryOrderService.getMainPageCategories).mockReturnValue(new Promise(() => {}));

    const { container } = render(<DynamicCategorySection visualMode="text" />);

    expect(screen.getByText('상의')).toBeInTheDocument();
    expect(screen.getByText('하의')).toBeInTheDocument();
    expect(screen.getByText('신발')).toBeInTheDocument();
    expect(screen.getByText('스포츠')).toBeInTheDocument();
    expect(screen.queryByText('로딩 중...')).not.toBeInTheDocument();
    expect(container.querySelector('.categoryImageWrapper')).not.toBeInTheDocument();
  });

  test('renders category images in default image mode', async () => {
    jest.mocked(CategoryOrderService.getMainPageCategories).mockResolvedValue([
      {
        id: 'tops',
        name: '상의',
        slug: 'tops',
        href: '/categories/tops',
        icon: '',
        image: '/category/main_category01.png',
        count: '',
      },
    ]);

    render(<DynamicCategorySection />);

    await waitFor(() => expect(screen.getByAltText('상의')).toBeInTheDocument());
    expect(screen.getByAltText('상의')).toHaveAttribute('src', '/category/main_category01.png');
  });

  test('can render curated category cards without mismatched category images', async () => {
    jest.mocked(CategoryOrderService.getMainPageCategories).mockResolvedValue([
      {
        id: 'tops',
        name: '상의',
        slug: 'tops',
        href: '/categories/tops',
        icon: '',
        image: '/category/main_category01.png',
        count: '',
      },
    ]);

    render(<DynamicCategorySection visualMode="text" />);

    await waitFor(() => expect(screen.getByText('상의')).toBeInTheDocument());
    expect(screen.queryByAltText('상의')).not.toBeInTheDocument();
    expect(screen.getByText('매일 입기 좋은 기본 상의')).toBeInTheDocument();
  });
});
