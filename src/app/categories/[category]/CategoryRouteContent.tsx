'use client';

import PageHeader from '@/app/_components/PageHeader';
import ProductList from '@/app/products/_components/ProductList';
import { useCategories } from '@/context/categoryProvider';
import { getCategoryIdCandidates } from '@/shared/utils/categoryRouting';

interface CategoryRouteContentProps {
  categoryId: string;
}

export default function CategoryRouteContent({ categoryId }: CategoryRouteContentProps) {
  const { categories, loading } = useCategories();

  if (loading) {
    return <main aria-busy="true">카테고리를 불러오는 중...</main>;
  }

  const candidates = getCategoryIdCandidates(categoryId);
  const category = categories.find((item) => candidates.includes(item.id.toLowerCase()));

  if (!category) {
    return <main><h1>카테고리를 찾을 수 없습니다</h1></main>;
  }

  return (
    <div>
      <PageHeader
        title={category.name}
        description={`${category.name} 카테고리의 현재 판매 상품을 확인하세요.`}
        breadcrumb={[
          { label: '홈', href: '/' },
          { label: '카테고리', href: '/categories' },
          { label: category.name },
        ]}
      />
      <ProductList initialCategory={category.id} lockCategory />
    </div>
  );
}
