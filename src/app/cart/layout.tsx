import type { Metadata } from 'next';
import { noIndexMetadata } from '@/shared/constants/routeMetadata';

export const metadata: Metadata = {
  title: '장바구니 | STYNA',
  ...noIndexMetadata,
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
