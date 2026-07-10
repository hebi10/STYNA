import { CATEGORY_IMAGE_URLS } from './categoryImages';

describe('main category image URLs', () => {
  test('uses versioned local WebP files until Firebase Storage upload is authorized', () => {
    expect(CATEGORY_IMAGE_URLS).toHaveLength(4);
    expect(CATEGORY_IMAGE_URLS.every((url) => url.startsWith('/category/'))).toBe(true);
    expect(CATEGORY_IMAGE_URLS.every((url) => url.endsWith('_q75.webp'))).toBe(true);
  });
});
