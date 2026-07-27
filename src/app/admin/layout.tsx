import type { Metadata } from 'next';
import AdminShell from './AdminShell';
import { noIndexMetadata } from '@/shared/constants/routeMetadata';

export const metadata: Metadata = {
  title: '관리자 | STYNA',
  ...noIndexMetadata,
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
