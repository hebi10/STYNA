import type { Metadata } from 'next';
import { routeMetadata } from '@/shared/constants/routeMetadata';

export const metadata: Metadata = routeMetadata.privacy;

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
