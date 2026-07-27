import type { Metadata } from 'next';
import { routeMetadata } from '@/shared/constants/routeMetadata';

export const metadata: Metadata = routeMetadata.categories;

export default function CategoriesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
