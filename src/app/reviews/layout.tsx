import type { Metadata } from 'next';
import { routeMetadata } from '@/shared/constants/routeMetadata';

export const metadata: Metadata = routeMetadata.reviews;

export default function ReviewsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
