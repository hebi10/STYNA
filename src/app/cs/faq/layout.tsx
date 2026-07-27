import type { Metadata } from 'next';
import { routeMetadata } from '@/shared/constants/routeMetadata';

export const metadata: Metadata = routeMetadata.faq;

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children;
}
