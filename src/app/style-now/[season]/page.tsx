import { notFound } from 'next/navigation';
import StyleNowSeasonPage from '@/app/_components/style-now/StyleNowSeasonPage';
import {
  STYLE_NOW_SEASONS,
  getStyleNowSeason,
} from '@/app/_components/style-now/styleNowData';
import { createPublicPageMetadata } from '@/shared/constants/routeMetadata';

interface StyleNowPageProps {
  params: Promise<{
    season: string;
  }>;
}

export function generateStaticParams() {
  return STYLE_NOW_SEASONS.map((season) => ({ season: season.key }));
}

export async function generateMetadata({ params }: StyleNowPageProps) {
  const { season: seasonKey } = await params;
  const season = getStyleNowSeason(seasonKey);

  if (!season) {
    return {
      title: '스타일나우를 찾을 수 없습니다 | STYNA',
      robots: { index: false, follow: false },
    };
  }

  return createPublicPageMetadata({
    title: `${season.title} | 스타일나우 | STYNA`,
    description: season.description,
    pathname: `/style-now/${season.key}`,
  });
}

export default async function StyleNowPage({
  params,
}: StyleNowPageProps) {
  const { season: seasonKey } = await params;
  const season = getStyleNowSeason(seasonKey);

  if (!season) {
    notFound();
  }

  return <StyleNowSeasonPage season={season.key} />;
}
