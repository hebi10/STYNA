import { redirect } from 'next/navigation';
import { CategoryProvider } from '@/context/categoryProvider';
import { createPublicPageMetadata } from '@/shared/constants/routeMetadata';
import { getDefaultCategoryNames } from '@/shared/utils/categoryUtils';
import { normalizeCategoryId, toCategoryPath } from '@/shared/utils/categoryRouting';
import CategoryRouteContent from './CategoryRouteContent';

// Firestore 카테고리 변경을 빌드 결과에 고정하지 않고 요청 시점에 조회한다.
export const dynamic = 'force-dynamic';

interface CategoryPageProps {
  params: Promise<{
    category: string;
  }>;
}

export async function generateMetadata({ params }: CategoryPageProps) {
  const { category } = await params;
  const normalizedCategory = normalizeCategoryId(category);
  const categoryName = getDefaultCategoryNames()[normalizedCategory];

  if (!categoryName) {
    return {
      title: '카테고리를 찾을 수 없습니다 | STYNA',
      robots: { index: false, follow: false },
    };
  }

  return createPublicPageMetadata({
    title: `${categoryName} | STYNA`,
    description: `${categoryName} 카테고리의 STYNA 상품을 둘러보세요.`,
    pathname: toCategoryPath(normalizedCategory),
  });
}

export default async function DynamicCategoryPage({ params }: CategoryPageProps) {
  const { category } = await params;
  const normalizedCategory = normalizeCategoryId(category);

  if (category !== normalizedCategory) {
    redirect(toCategoryPath(normalizedCategory));
  }

  return (
    <CategoryProvider>
      <CategoryRouteContent categoryId={normalizedCategory} />
    </CategoryProvider>
  );
}
