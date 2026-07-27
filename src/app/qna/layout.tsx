import type { Metadata } from 'next';
import { noIndexMetadata } from '@/shared/constants/routeMetadata';

export const metadata: Metadata = {
  title: '고객 문의 | STYNA',
  ...noIndexMetadata,
};

export default function QnALayout({ children }: { children: React.ReactNode }) {
  return children;
}
