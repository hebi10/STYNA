const {
  CATEGORY_IMAGE_SOURCES,
  buildCategoryImageStoragePath,
} = require('./category-image-webp-migration');

describe('category image WebP migration helpers', () => {
  test('uses four versioned category source files without replacing originals', () => {
    expect(CATEGORY_IMAGE_SOURCES).toHaveLength(4);
    expect(CATEGORY_IMAGE_SOURCES.map((entry) => entry.categoryId)).toEqual([
      'tops',
      'bottoms',
      'shoes',
      'sports',
    ]);
  });

  test('builds immutable versioned q75 WebP paths', () => {
    expect(buildCategoryImageStoragePath('tops')).toBe(
      'categories/main-category-tops-v20260710_q75.webp',
    );
  });
});
