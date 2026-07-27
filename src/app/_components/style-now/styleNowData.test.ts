import {
  STYLE_NOW_SEASONS,
  getStyleNowProductIds,
  getStyleNowStorageUrl,
} from './styleNowData';

describe('styleNowData', () => {
  test('defines four seasons with twenty unique deterministic product ids each', () => {
    expect(STYLE_NOW_SEASONS.map((season) => season.key)).toEqual([
      'spring',
      'summer',
      'autumn',
      'winter',
    ]);

    const productIds = STYLE_NOW_SEASONS.flatMap((season) => season.productIds);
    expect(productIds).toHaveLength(80);
    expect(new Set(productIds).size).toBe(80);
    expect(getStyleNowProductIds('spring')).toEqual(
      Array.from(
        { length: 20 },
        (_, index) => `style-now-spring-${String(index + 1).padStart(2, '0')}`,
      ),
    );
  });

  test('builds a Firebase Storage media URL without exposing a token', () => {
    expect(
      getStyleNowStorageUrl(
        'images/style-now/spring/style-now-spring-main.webp',
        'hebimall.firebasestorage.app',
      ),
    ).toBe(
      'https://firebasestorage.googleapis.com/v0/b/hebimall.firebasestorage.app/o/images%2Fstyle-now%2Fspring%2Fstyle-now-spring-main.webp?alt=media',
    );
  });
});
