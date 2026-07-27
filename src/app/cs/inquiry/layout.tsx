import type { Metadata } from 'next';
import { noIndexMetadata } from '@/shared/constants/routeMetadata';

export const metadata: Metadata = {
  title: '1:1 문의 | STYNA',
  ...noIndexMetadata,
};

export default function InquiryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
