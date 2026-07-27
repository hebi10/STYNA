import type { Metadata } from 'next';
import { routeMetadata } from '@/shared/constants/routeMetadata';

export const metadata: Metadata = routeMetadata.notices;

export default function NoticeListLayout({ children }: { children: React.ReactNode }) {
  return children;
}
