import { render, screen } from '@testing-library/react';
import DynamicCategoryPage, { generateMetadata } from './page';
import { CategoryService } from '@/shared/services/categoryService';
import { notFound, redirect } from 'next/navigation';
import type { Category } from '@/shared/types/category';

jest.mock('next/navigation', () => ({
  redirect: jest.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

jest.mock('@/shared/services/categoryService', () => ({
  CategoryService: {
    getCategories: jest.fn(),
  },
}));

jest.mock('@/app/_components/PageHeader', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

jest.mock('@/app/products/_components/ProductList', () => ({
  __esModule: true,
  default: ({ initialCategory, lockCategory }: {
    initialCategory: string;
    lockCategory: boolean;
  }) => (
    <div
      data-testid="product-list"
      data-category={initialCategory}
      data-locked={String(lockCategory)}
    />
  ),
}));

jest.mock('./page.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, { get: (_target, key) => String(key) }),
}));

describe('dynamic category page', () => {
  const category = (id: string, name: string): Category => ({
    id,
    name,
    slug: id,
    path: `/categories/${id}`,
    productCount: 1,
    isActive: true,
    order: 1,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(CategoryService.getCategories).mockResolvedValue([
      category('bags', '가방'),
      category('tops', '상의'),
    ]);
  });

  test('uses the shared cursor product list with a locked category', async () => {
    const page = await DynamicCategoryPage({
      params: Promise.resolve({ category: 'bags' }),
    });

    render(page);

    expect(screen.getByRole('heading', { level: 1, name: '가방' })).toBeInTheDocument();
    expect(screen.getByTestId('product-list')).toHaveAttribute('data-category', 'bags');
    expect(screen.getByTestId('product-list')).toHaveAttribute('data-locked', 'true');
  });

  test('redirects the legacy clothing slug to tops on the server', async () => {
    await expect(DynamicCategoryPage({
      params: Promise.resolve({ category: 'clothing' }),
    })).rejects.toThrow('NEXT_REDIRECT');

    expect(redirect).toHaveBeenCalledWith('/categories/tops');
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

  test('returns not found for a slug missing from the active category list', async () => {
    await expect(DynamicCategoryPage({
      params: Promise.resolve({ category: 'missing-category' }),
    })).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFound).toHaveBeenCalledTimes(1);
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

  test('propagates category lookup failures instead of turning them into not found', async () => {
    jest.mocked(CategoryService.getCategories).mockRejectedValueOnce(new Error('firestore unavailable'));

    await expect(DynamicCategoryPage({
      params: Promise.resolve({ category: 'lookup-error' }),
    })).rejects.toThrow('firestore unavailable');

    expect(notFound).not.toHaveBeenCalled();
  });
});
