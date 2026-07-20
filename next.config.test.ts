import nextConfig from './next.config';

describe('next image configuration', () => {
  test('Cloud Functions에서 이미지 최적화 경로를 사용하지 않는다', () => {
    expect(nextConfig.images?.unoptimized).toBe(true);
    expect(nextConfig.images?.minimumCacheTTL).toBe(86400);
  });
});
