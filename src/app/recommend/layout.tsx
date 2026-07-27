import type { Metadata } from 'next';
import { routeMetadata } from '@/shared/constants/routeMetadata';

export const metadata: Metadata = routeMetadata.recommend;

export default function RecommendLayout({ children }: { children: React.ReactNode }) {
  return children;
}
