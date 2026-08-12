import { CategoryService } from '@/shared/services/categoryService';

export const DEFAULT_CATEGORY_IDS = [
  'clothing',
  'bottoms',
  'shoes',
  'sports',
  'outdoor',
  'bags',
  'jewelry',
  'accessories',
] as const;

const DEFAULT_CATEGORY_NAMES: Record<string, string> = {
  clothing: '의류',
  tops: '상의',
  bottoms: '하의',
  shoes: '신발',
  sports: '스포츠',
  outdoor: '아웃도어',
  bags: '가방',
  jewelry: '주얼리',
  accessories: '액세서리',
  pants: '바지',
  top: '상의',
  bag: '가방',
  accessory: '액세서리',
};

let categoryNamesCache: Record<string, string> | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000;

export function getDefaultCategoryNames(): Record<string, string> {
  return { ...DEFAULT_CATEGORY_NAMES };
}

export async function getCategoryNames(): Promise<Record<string, string>> {
  const now = Date.now();

  if (categoryNamesCache && now - cacheTimestamp < CACHE_DURATION) {
    return categoryNamesCache;
  }

  try {
    const categories = await CategoryService.getCategories();
    const categoryNames = getDefaultCategoryNames();

    categories.forEach((category) => {
      if (category.id && category.name) {
        categoryNames[category.id] = category.name;
      }
    });

    categoryNamesCache = categoryNames;
    cacheTimestamp = now;

    return categoryNames;
  } catch (error) {
    console.error('카테고리 이름 조회 실패:', error);
    return getDefaultCategoryNames();
  }
}

export async function getCategoryName(categoryId: string): Promise<string> {
  const categoryNames = await getCategoryNames();
  return categoryNames[categoryId] || categoryId;
}

export function invalidateCategoryNamesCache(): void {
  categoryNamesCache = null;
  cacheTimestamp = 0;
}
