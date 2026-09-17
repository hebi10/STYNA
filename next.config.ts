import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Firebase Functions와 호환되는 설정
  serverExternalPackages: ['firebase-admin'],

  // Lint는 npm run lint/ci에서 별도로 관리하고, 배포 빌드에서는 타입/컴파일을 우선한다.
  eslint: {
    ignoreDuringBuilds: true,
  },

  // 출력 설정 - 개발 환경에서는 기본값 사용
  // output: 'standalone',
  trailingSlash: true,
  devIndicators: false,

  images: {
    // Firebase Hosting/Functions 배포에서는 Next 이미지 최적화 경로를 사용하지 않는다.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/v0/b/hebimall.firebasestorage.app/o/**',
      },
    ],
  },

  // Webpack 설정 최소화
  webpack: (config, { dev }) => {
    // 개발 환경에서 캐시 문제 해결
    if (dev) {
      config.cache = false;
    }

    // 폰트 파일 처리 최적화
    config.module.rules.push({
      test: /\.(woff|woff2|eot|ttf|otf)$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/chunks/[name].[hash][ext]',
      },
    });

    return config;
  },
};

export default nextConfig;
