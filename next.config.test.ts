import nextConfig from './next.config';

describe('next image configuration', () => {
  test('Cloud Functions에서는 Next 이미지 최적화를 사용하지 않는다', () => {
    expect(nextConfig.images?.unoptimized).toBe(true);
  });

  test('최적화 비활성화 상태에서 최적화 전용 옵션을 유지하지 않는다', () => {
    expect(nextConfig.images?.minimumCacheTTL).toBeUndefined();
    expect(nextConfig.images?.formats).toBeUndefined();
    expect(nextConfig.images?.deviceSizes).toBeUndefined();
    expect(nextConfig.images?.imageSizes).toBeUndefined();
  });

  test('원격 이미지는 STYNA Firebase Storage만 허용한다', () => {
    expect(nextConfig.images?.remotePatterns).toEqual([
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/v0/b/hebimall.firebasestorage.app/o/**',
      },
    ]);
  });
});
