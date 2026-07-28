import {
  STYLE_NOW_SEASONS,
  getStyleNowSeason,
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

  test('defines one new category image and three editorial panels for every season', () => {
    const expectedMedia = [
      {
        key: 'spring',
        label: '봄',
        category: 'style-now-spring-category-v2.webp',
        panels: [
          'style-now-spring-main.webp',
          'style-now-spring-feature-trench-v2.webp',
          'style-now-spring-feature-bag-v2.webp',
        ],
      },
      {
        key: 'summer',
        label: '여름',
        category: 'style-now-summer-category-v2.webp',
        panels: [
          'style-now-summer-main.webp',
          'style-now-summer-feature-01-v2.webp',
          'style-now-summer-feature-02-v2.webp',
        ],
      },
      {
        key: 'autumn',
        label: '가을',
        category: 'style-now-autumn-category-v2.webp',
        panels: [
          'style-now-autumn-main.webp',
          'style-now-autumn-feature-01-v2.webp',
          'style-now-autumn-feature-02-v2.webp',
        ],
      },
      {
        key: 'winter',
        label: '겨울',
        category: 'style-now-winter-category-v2.webp',
        panels: [
          'style-now-winter-main.webp',
          'style-now-winter-feature-01-v2.webp',
          'style-now-winter-feature-02-v2.webp',
        ],
      },
    ] as const;

    for (const expected of expectedMedia) {
      const season = getStyleNowSeason(expected.key);
      expect(season).not.toBeNull();
      expect(season?.categoryImage.localPath).toContain(expected.category);
      expect(season?.categoryImage.alt).toContain(expected.label);
      expect(season?.editorialPanels.map((panel) => panel.kind)).toEqual([
        'model',
        'product',
        'detail',
      ]);
      expect(
        season?.editorialPanels.map((panel) =>
          panel.localPath.split('/').at(-1),
        ),
      ).toEqual(expected.panels);

      for (const panel of season?.editorialPanels ?? []) {
        expect(panel.alt).toMatch(/[가-힣]/);
        expect(panel.eyebrow).toMatch(/[가-힣]/);
        expect(panel.title).toMatch(/[가-힣]/);
        expect(panel.description).toMatch(/[가-힣]/);
        expect(['light', 'dark']).toContain(panel.tone);
      }
    }
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

  test('returns only a supported season and rejects an invalid route segment', () => {
    expect(getStyleNowSeason('spring')).toMatchObject({
      key: 'spring',
      label: '봄',
    });
    expect(getStyleNowSeason('rainy')).toBeNull();
  });
});
