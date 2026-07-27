import type { Metadata } from 'next';
import MyPageShell from './MyPageShell';
import { noIndexMetadata } from '@/shared/constants/routeMetadata';

export const metadata: Metadata = {
  title: '마이페이지 | STYNA',
  ...noIndexMetadata,
};

export default function MyPageLayout({ children }: { children: React.ReactNode }) {
  return <MyPageShell>{children}</MyPageShell>;
}
