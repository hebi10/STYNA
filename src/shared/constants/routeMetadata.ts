import type { Metadata } from 'next';
import {
  absoluteSiteUrl,
  canonicalUrl,
  getOpenGraphImage,
  SITE_NAME,
  SITE_URL,
} from './seo';

const DEFAULT_DESCRIPTION =
  '의류, 신발, 가방과 액세서리를 둘러볼 수 있는 STYNA 패션 포트폴리오 쇼핑몰입니다.';

interface PublicPageMetadataInput {
  title: string;
  description: string;
  pathname: string;
}

export function createPublicPageMetadata({
  title,
  description,
  pathname,
}: PublicPageMetadataInput): Metadata {
  const canonical = canonicalUrl(pathname);

  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      locale: 'ko_KR',
      type: 'website',
      images: [
        {
          ...getOpenGraphImage('/thum.png', `${SITE_NAME} 쇼핑몰`),
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [absoluteSiteUrl('/thum.png')],
    },
  };
}

export const noIndexMetadata: Metadata = {
  robots: { index: false, follow: true },
};

export const rootMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'STYNA - 패션 쇼핑몰',
  description: DEFAULT_DESCRIPTION,
  keywords: ['쇼핑몰', '패션', '온라인 쇼핑', '의류', 'STYNA'],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
      { url: '/favicon.ico', sizes: '16x16', type: 'image/x-icon' },
    ],
    shortcut: '/favicon.ico',
    apple: [{ url: '/favicon.ico', sizes: '180x180', type: 'image/x-icon' }],
  },
  manifest: '/manifest.json',
  openGraph: {
    title: 'STYNA - 패션 쇼핑몰',
    description: DEFAULT_DESCRIPTION,
    siteName: SITE_NAME,
    images: [
      {
        url: '/thum.png',
        width: 1200,
        height: 630,
        alt: 'STYNA 쇼핑몰',
        type: 'image/png',
      },
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'STYNA - 패션 쇼핑몰',
    description: DEFAULT_DESCRIPTION,
    images: ['/thum.png'],
    creator: '@STYNA',
  },
  verification: {
    google: '',
    other: { 'naver-site-verification': '' },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: SITE_NAME,
  },
  applicationName: SITE_NAME,
  formatDetection: { telephone: false },
};

export const routeMetadata = {
  home: createPublicPageMetadata({
    title: 'STYNA - 패션 쇼핑몰',
    description: DEFAULT_DESCRIPTION,
    pathname: '/',
  }),
  products: createPublicPageMetadata({
    title: '전체 상품 | STYNA',
    description: 'STYNA의 전체 패션 상품을 둘러보세요.',
    pathname: '/products',
  }),
  categories: createPublicPageMetadata({
    title: '카테고리 | STYNA',
    description: '카테고리별 STYNA 패션 상품을 찾아보세요.',
    pathname: '/categories',
  }),
  events: createPublicPageMetadata({
    title: '이벤트 | STYNA',
    description: '현재 공개 중인 STYNA 이벤트와 혜택을 확인하세요.',
    pathname: '/events',
  }),
  brand: createPublicPageMetadata({
    title: '브랜드 | STYNA',
    description: 'STYNA에서 판매 중인 브랜드를 둘러보세요.',
    pathname: '/brand',
  }),
  recommend: createPublicPageMetadata({
    title: '추천 상품 | STYNA',
    description: '신상품, 인기 상품과 리뷰 추천 상품을 만나보세요.',
    pathname: '/recommend',
  }),
  reviews: createPublicPageMetadata({
    title: '상품 리뷰 | STYNA',
    description: '상품별 평점과 공개 리뷰를 확인하세요.',
    pathname: '/reviews',
  }),
  sale: createPublicPageMetadata({
    title: '할인 상품 | STYNA',
    description: '현재 할인 중인 STYNA 상품을 확인하세요.',
    pathname: '/main/sale',
  }),
  faq: createPublicPageMetadata({
    title: '자주 묻는 질문 | STYNA',
    description: 'STYNA 이용 중 자주 묻는 질문과 답변을 확인하세요.',
    pathname: '/cs/faq',
  }),
  notices: createPublicPageMetadata({
    title: '공지사항 | STYNA',
    description: 'STYNA 서비스 공지사항을 확인하세요.',
    pathname: '/cs/notice_list',
  }),
  privacy: createPublicPageMetadata({
    title: '개인정보 안내 | STYNA',
    description: 'STYNA 포트폴리오 데모의 개인정보 안내입니다.',
    pathname: '/legal/privacy',
  }),
  terms: createPublicPageMetadata({
    title: '이용 안내 | STYNA',
    description: 'STYNA 포트폴리오 데모의 이용 안내입니다.',
    pathname: '/legal/terms',
  }),
  businessInfo: createPublicPageMetadata({
    title: '서비스 정보 | STYNA',
    description: 'STYNA 포트폴리오 프로젝트와 운영 정보를 확인하세요.',
    pathname: '/legal/business-info',
  }),
  offline: createPublicPageMetadata({
    title: '오프라인 안내 | STYNA',
    description: 'STYNA 포트폴리오 데모의 오프라인 안내를 확인하세요.',
    pathname: '/support/offline',
  }),
  search: {
    title: '상품 검색 | STYNA',
    description: 'STYNA 상품 검색 결과입니다.',
    ...noIndexMetadata,
  } satisfies Metadata,
} as const;
