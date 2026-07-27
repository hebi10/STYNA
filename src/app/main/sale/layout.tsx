import type { Metadata } from 'next';
import { routeMetadata } from '@/shared/constants/routeMetadata';

export const metadata: Metadata = routeMetadata.sale;

export default function SaleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
