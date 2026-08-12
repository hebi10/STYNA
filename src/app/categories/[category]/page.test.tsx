import { render, screen } from '@testing-library/react';
import DynamicCategoryPage, { dynamic, generateMetadata } from './page';
import { redirect } from 'next/navigation';

jest.mock('next/navigation', () => ({
  redirect: jest.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

jest.mock('@/context/categoryProvider', () => ({
  CategoryProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="category-provider">{children}</div>
  ),
}));

jest.mock('@/shared/services/categoryService', () => ({
  CategoryService: {
    getCategories: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('./CategoryRouteContent', () => ({
  __esModule: true,
  default: ({ categoryId }: { categoryId: string }) => <div data-testid="category-route" data-category={categoryId} />,
}));

jest.mock('@/app/products/_components/ProductList', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('./page.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, { get: (_target, key) => String(key) }),
}));

describe('dynamic category page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders category slugs on request instead of freezing build-time category data', () => {
    expect(dynamic).toBe('force-dynamic');
  });

  test('delegates category data loading to the public category provider', async () => {
    const page = await DynamicCategoryPage({
      params: Promise.resolve({ category: 'bags' }),
    });

    render(page);

    expect(screen.getByTestId('category-provider')).toBeInTheDocument();
    expect(screen.getByTestId('category-route')).toHaveAttribute('data-category', 'bags');
  });

  test('redirects the legacy tops slug to the canonical clothing route on the server', async () => {
    await expect(DynamicCategoryPage({
      params: Promise.resolve({ category: 'tops' }),
    })).rejects.toThrow('NEXT_REDIRECT');

    expect(redirect).toHaveBeenCalledWith('/categories/clothing');
  });

  test('passes canonical clothing to the client route for a legacy tops document', async () => {
    const page = await DynamicCategoryPage({
      params: Promise.resolve({ category: 'clothing' }),
    });

    render(page);

    expect(screen.getByTestId('category-route')).toHaveAttribute('data-category', 'clothing');
  });

  test('uses the category route as its canonical URL', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ category: 'bags' }),
    });

    expect(metadata).toMatchObject({
      title: '가방 | STYNA',
      alternates: {
        canonical: 'https://hebimall.web.app/categories/bags/',
      },
      openGraph: {
        url: 'https://hebimall.web.app/categories/bags/',
      },
    });
  });

  test('marks missing category metadata as noindex without a canonical URL', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ category: 'missing-metadata' }),
    });

    expect(metadata).toMatchObject({
      robots: { index: false, follow: false },
    });
    expect(metadata.alternates).toBeUndefined();
  });
});
