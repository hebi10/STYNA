import type { Metadata } from 'next';
import { routeMetadata } from '@/shared/constants/routeMetadata';

export const metadata: Metadata = routeMetadata.offline;

export default function OfflineLayout({ children }: { children: React.ReactNode }) {
  return children;
}
