export type StyleNowSeasonKey = 'spring' | 'summer' | 'autumn' | 'winter';

export interface StyleNowSeason {
  key: StyleNowSeasonKey;
  label: string;
  title: string;
  description: string;
  tag: string;
  heroAlt: string;
  heroLocalPath: string;
  heroStoragePath: string;
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
    productIds: getStyleNowProductIds('winter'),
  },
];
