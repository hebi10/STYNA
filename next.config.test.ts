import nextConfig from './next.config';

describe('next image configuration', () => {
  test('keeps responsive image optimization enabled for Firebase Storage images', () => {
    expect(nextConfig.images?.unoptimized).toBe(false);
    expect(nextConfig.images?.minimumCacheTTL).toBe(86400);
  });
});
