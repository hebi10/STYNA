const {
  MAIN_BANNER_CACHE_CONTROL,
  MAIN_BANNER_PATHS,
} = require('./main-banner-cache-update');

describe('main banner cache update', () => {
  test('keeps mutable banner paths cacheable without making them permanently immutable', () => {
    expect(MAIN_BANNER_PATHS).toHaveLength(10);
    expect(MAIN_BANNER_PATHS.every((path) => path.endsWith('/banner.webp'))).toBe(true);
    expect(MAIN_BANNER_CACHE_CONTROL).toBe('public, max-age=86400, stale-while-revalidate=604800');
  });
});
