import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import PageHeader from '@/app/_components/PageHeader';
import ProductList from '@/app/products/_components/ProductList';
import { CategoryService } from '@/shared/services/categoryService';
import { createPublicPageMetadata } from '@/shared/constants/routeMetadata';
import styles from './page.module.css';

interface CategoryPageProps {
  params: Promise<{
    category: string;
  }>;
}

const getActiveCategories = cache(() => CategoryService.getCategories());

const getActiveCategory = cache(async (categoryId: string) => {
  const categories = await getActiveCategories();
  return categories.find((category) => category.id === categoryId) ?? null;
});

export async function generateMetadata({ params }: CategoryPageProps) {
  const { category } = await params;
  const normalizedCategory = category === 'clothing' ? 'tops' : category;
  const activeCategory = await getActiveCategory(normalizedCategory);

  if (!activeCategory) {
    return {
      title: '카테고리를 찾을 수 없습니다 | STYNA',
      robots: { index: false, follow: false },
    };
  }

  return createPublicPageMetadata({
    title: `${activeCategory.name} | STYNA`,
    description: activeCategory.description
      ?? `${activeCategory.name} 카테고리의 STYNA 상품을 둘러보세요.`,
    pathname: `/categories/${encodeURIComponent(normalizedCategory)}`,
  });
}

export default async function DynamicCategoryPage({ params }: CategoryPageProps) {
  const { category } = await params;

  if (category === 'clothing') {
    redirect('/categories/tops');
  }

  const activeCategory = await getActiveCategory(category);

  if (!activeCategory) {
    notFound();
  }

  return (
    <div className={styles.container}>
      <PageHeader
        title={activeCategory.name}
        description={`${activeCategory.name} 카테고리의 현재 판매 상품을 확인하세요.`}
        breadcrumb={[
          { label: '홈', href: '/' },
          { label: '카테고리', href: '/categories' },
          { label: activeCategory.name },
        ]}
      />
      <ProductList initialCategory={category} lockCategory />
    </div>
  );
}
