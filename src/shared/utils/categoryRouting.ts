const CATEGORY_ID_ALIASES: Record<string, string> = {
  clothing: 'clothing',
  tops: 'clothing',
  top: 'clothing',
  bottoms: 'bottoms',
  pants: 'bottoms',
  shoes: 'shoes',
  shoe: 'shoes',
  bags: 'bags',
  bag: 'bags',
  accessories: 'accessories',
  accessory: 'accessories',
  jewelry: 'jewelry',
  sports: 'sports',
  outdoor: 'outdoor',
};

const LEGACY_CATEGORY_IDS: Record<string, string[]> = {
  clothing: ['clothing', 'tops'],
};

export function normalizeCategoryId(categoryId: string): string {
  const normalizedId = categoryId.trim().toLowerCase();
  return CATEGORY_ID_ALIASES[normalizedId] || normalizedId;
}

export function getCategoryIdCandidates(categoryId: string): string[] {
  const canonicalId = normalizeCategoryId(categoryId);
  return LEGACY_CATEGORY_IDS[canonicalId] || [canonicalId];
}

export function toCategoryPath(categoryId: string): string {
  return `/categories/${encodeURIComponent(normalizeCategoryId(categoryId))}`;
}
