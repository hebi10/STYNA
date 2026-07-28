export type StyleNowSeasonKey = 'spring' | 'summer' | 'autumn' | 'winter';

export interface StyleNowCategoryImage {
  localPath: string;
  alt: string;
}

export interface StyleNowEditorialPanel {
  kind: 'model' | 'product' | 'detail';
  localPath: string;
  alt: string;
  eyebrow: string;
  title: string;
  description: string;
  tone: 'light' | 'dark';
}

export interface StyleNowSeason {
  key: StyleNowSeasonKey;
  label: string;
  title: string;
  description: string;
  tag: string;
  heroAlt: string;
  heroLocalPath: string;
  heroStoragePath: string;
  categoryImage: StyleNowCategoryImage;
  editorialPanels: StyleNowEditorialPanel[];
  productIds: string[];
}

export function getStyleNowProductIds(
  season: StyleNowSeasonKey,
): string[] {
  return Array.from(
    { length: 20 },
    (_, index) =>
      `style-now-${season}-${String(index + 1).padStart(2, '0')}`,
  );
}

export function getStyleNowStorageUrl(
  storagePath: string,
  bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
): string | null {
  if (!bucket) {
    return null;
  }

  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(storagePath)}?alt=media`;
}

export const STYLE_NOW_SEASONS: StyleNowSeason[] = [
  {
    key: 'spring',
    label: '봄',
    title: '가볍게 시작하는 봄',
    description:
      '부드러운 색과 가벼운 소재로 일상에 산뜻한 리듬을 더하는 봄 스타일입니다.',
    tag: 'style-now-spring',
    heroAlt: '봄 스타일나우 패션 화보',
    heroLocalPath: '/style-now/spring/style-now-spring-main.webp',
    heroStoragePath:
      'images/style-now/spring/style-now-spring-main.webp',
    categoryImage: {
      localPath:
        '/style-now/spring/style-now-spring-category-v2.webp',
      alt: '봄 스타일나우 카테고리',
    },
    editorialPanels: [
      {
        kind: 'model',
        localPath: '/style-now/spring/style-now-spring-main.webp',
        alt: '봄 모델 스타일 화보',
        eyebrow: '봄의 장면',
        title: '봄날의 가벼운 시작',
        description:
          '부드러운 색과 가벼운 겹침으로 새 계절의 리듬을 시작합니다.',
        tone: 'light',
      },
      {
        kind: 'product',
        localPath:
          '/style-now/spring/style-now-spring-feature-trench-v2.webp',
        alt: '봄 트렌치 재킷 상품 강조',
        eyebrow: '대표 상품',
        title: '가볍게 걸치는 트렌치',
        description:
          '정돈된 실루엣과 산뜻한 촉감으로 일교차가 큰 날을 준비하세요.',
        tone: 'dark',
      },
      {
        kind: 'detail',
        localPath:
          '/style-now/spring/style-now-spring-feature-bag-v2.webp',
        alt: '봄 스웨이드 미니백 상품 디테일',
        eyebrow: '소재의 발견',
        title: '부드러운 색, 선명한 질감',
        description:
          '버터 옐로 스웨이드가 담백한 봄 스타일에 작은 온도를 더합니다.',
        tone: 'dark',
      },
    ],
    productIds: getStyleNowProductIds('spring'),
  },
  {
    key: 'summer',
    label: '여름',
    title: '빛과 바람을 입는 여름',
    description:
      '통기성 좋은 소재와 맑은 색으로 휴가와 도심의 더운 날을 가볍게 연결합니다.',
    tag: 'style-now-summer',
    heroAlt: '여름 스타일나우 패션 화보',
    heroLocalPath: '/style-now/summer/style-now-summer-main.webp',
    heroStoragePath:
      'images/style-now/summer/style-now-summer-main.webp',
    categoryImage: {
      localPath:
        '/style-now/summer/style-now-summer-category-v2.webp',
      alt: '여름 스타일나우 카테고리',
    },
    editorialPanels: [
      {
        kind: 'model',
        localPath: '/style-now/summer/style-now-summer-main.webp',
        alt: '여름 모델 스타일 화보',
        eyebrow: '여름의 장면',
        title: '빛과 바람을 입는 순간',
        description:
          '맑은 색과 여유로운 실루엣으로 도심과 휴가의 경계를 가볍게 넘습니다.',
        tone: 'light',
      },
      {
        kind: 'product',
        localPath:
          '/style-now/summer/style-now-summer-feature-01-v2.webp',
        alt: '여름 린넨 셔츠 상품 강조',
        eyebrow: '대표 상품',
        title: '린넨, 가장 시원한 선택',
        description:
          '통기성 좋은 결감과 넉넉한 핏이 더운 날에도 단정함을 지켜줍니다.',
        tone: 'dark',
      },
      {
        kind: 'detail',
        localPath:
          '/style-now/summer/style-now-summer-feature-02-v2.webp',
        alt: '여름 샌들과 액세서리 상품 디테일',
        eyebrow: '여름의 디테일',
        title: '발끝까지 가볍게',
        description:
          '탄 레더와 투명한 아쿠아 포인트로 여름 룩의 밀도를 조절하세요.',
        tone: 'dark',
      },
    ],
    productIds: getStyleNowProductIds('summer'),
  },
  {
    key: 'autumn',
    label: '가을',
    title: '겹쳐 입는 가을의 깊이',
    description:
      '차분한 색과 풍부한 표면을 겹쳐 입으며 도시의 선선한 공기에 어울리는 균형을 만듭니다.',
    tag: 'style-now-autumn',
    heroAlt: '가을 스타일나우 패션 화보',
    heroLocalPath: '/style-now/autumn/style-now-autumn-main.webp',
    heroStoragePath:
      'images/style-now/autumn/style-now-autumn-main.webp',
    categoryImage: {
      localPath:
        '/style-now/autumn/style-now-autumn-category-v2.webp',
      alt: '가을 스타일나우 카테고리',
    },
    editorialPanels: [
      {
        kind: 'model',
        localPath: '/style-now/autumn/style-now-autumn-main.webp',
        alt: '가을 모델 스타일 화보',
        eyebrow: '가을의 장면',
        title: '깊어지는 계절의 균형',
        description:
          '차분한 색을 겹치고 긴 실루엣을 더해 도시의 선선한 공기를 담았습니다.',
        tone: 'light',
      },
      {
        kind: 'product',
        localPath:
          '/style-now/autumn/style-now-autumn-feature-01-v2.webp',
        alt: '가을 버건디 숄더백 상품 강조',
        eyebrow: '대표 상품',
        title: '버건디로 남기는 포인트',
        description:
          '깊은 가죽 색과 간결한 형태가 차분한 레이어에 중심을 만듭니다.',
        tone: 'light',
      },
      {
        kind: 'detail',
        localPath:
          '/style-now/autumn/style-now-autumn-feature-02-v2.webp',
        alt: '가을 로퍼와 울 머플러 상품 디테일',
        eyebrow: '소재의 대비',
        title: '가죽과 울의 온도',
        description:
          '단단한 광택과 포근한 직조감을 나란히 두어 계절의 깊이를 완성합니다.',
        tone: 'light',
      },
    ],
    productIds: getStyleNowProductIds('autumn'),
  },
  {
    key: 'winter',
    label: '겨울',
    title: '온기를 쌓는 겨울',
    description:
      '묵직한 울과 충전재, 깊은 색을 중심으로 추운 계절의 실용성과 단정한 실루엣을 함께 담았습니다.',
    tag: 'style-now-winter',
    heroAlt: '겨울 스타일나우 패션 화보',
    heroLocalPath: '/style-now/winter/style-now-winter-main.webp',
    heroStoragePath:
      'images/style-now/winter/style-now-winter-main.webp',
    categoryImage: {
      localPath:
        '/style-now/winter/style-now-winter-category-v2.webp',
      alt: '겨울 스타일나우 카테고리',
    },
    editorialPanels: [
      {
        kind: 'model',
        localPath: '/style-now/winter/style-now-winter-main.webp',
        alt: '겨울 모델 스타일 화보',
        eyebrow: '겨울의 장면',
        title: '온기를 쌓는 겨울',
        description:
          '묵직한 아우터와 부드러운 니트를 겹쳐 추운 날의 균형을 만듭니다.',
        tone: 'light',
      },
      {
        kind: 'product',
        localPath:
          '/style-now/winter/style-now-winter-feature-01-v2.webp',
        alt: '겨울 패딩 토트백 상품 강조',
        eyebrow: '대표 상품',
        title: '가볍게 드는 포근함',
        description:
          '아이스 실버 퀼팅과 넉넉한 형태가 두꺼운 겨울 옷차림에 여백을 줍니다.',
        tone: 'light',
      },
      {
        kind: 'detail',
        localPath:
          '/style-now/winter/style-now-winter-feature-02-v2.webp',
        alt: '겨울 첼시부츠와 머플러 상품 디테일',
        eyebrow: '겨울의 디테일',
        title: '단단한 걸음, 부드러운 결',
        description:
          '러그 솔의 안정감과 캐시미어의 촉감을 함께 담아 실용적인 온기를 완성합니다.',
        tone: 'dark',
      },
    ],
    productIds: getStyleNowProductIds('winter'),
  },
];

export function getStyleNowSeason(key: string): StyleNowSeason | null {
  return STYLE_NOW_SEASONS.find((season) => season.key === key) ?? null;
}
