import type { Metadata } from 'next';
import { routeMetadata } from '@/shared/constants/routeMetadata';

export const metadata: Metadata = routeMetadata.terms;

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
