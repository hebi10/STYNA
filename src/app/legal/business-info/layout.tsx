import type { Metadata } from 'next';
import { routeMetadata } from '@/shared/constants/routeMetadata';

export const metadata: Metadata = routeMetadata.businessInfo;

export default function BusinessInfoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
