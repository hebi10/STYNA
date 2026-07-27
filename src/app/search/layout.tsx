import type { Metadata } from 'next';
import { routeMetadata } from '@/shared/constants/routeMetadata';

export const metadata: Metadata = routeMetadata.search;

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
