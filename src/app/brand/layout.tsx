import type { Metadata } from 'next';
import { routeMetadata } from '@/shared/constants/routeMetadata';

export const metadata: Metadata = routeMetadata.brand;

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  return children;
}
