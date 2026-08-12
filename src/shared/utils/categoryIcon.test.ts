import { isCategoryIconImage } from './categoryIcon';

describe('isCategoryIconImage', () => {
  test('accepts local and Firebase image URLs', () => {
    expect(isCategoryIconImage('/category-icons/clothing.webp')).toBe(true);
    expect(isCategoryIconImage('https://firebasestorage.googleapis.com/v0/b/hebimall/o/categories%2Ficon.webp?alt=media')).toBe(true);
  });

  test('keeps legacy text icons as text', () => {
    expect(isCategoryIconImage('👕')).toBe(false);
    expect(isCategoryIconImage('box')).toBe(false);
    expect(isCategoryIconImage(undefined)).toBe(false);
  });
});
