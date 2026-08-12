import {
  getCategoryIdCandidates,
  normalizeCategoryId,
  toCategoryPath,
} from './categoryRouting';

describe('category routing', () => {
  test('uses clothing as the public canonical id while preserving the tops legacy id', () => {
    expect(normalizeCategoryId('tops')).toBe('clothing');
    expect(getCategoryIdCandidates('clothing')).toEqual(['clothing', 'tops']);
    expect(getCategoryIdCandidates('tops')).toEqual(['clothing', 'tops']);
    expect(toCategoryPath('tops')).toBe('/categories/clothing');
  });

  test('normalizes casing and singular aliases for the canonical public path', () => {
    expect(normalizeCategoryId('Bags')).toBe('bags');
    expect(normalizeCategoryId('bag')).toBe('bags');
    expect(toCategoryPath('Bags')).toBe('/categories/bags');
  });
});
