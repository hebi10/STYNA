import type { Metadata } from 'next';
import { CouponProvider } from '@/context/couponProvider';
import { noIndexMetadata } from '@/shared/constants/routeMetadata';

export const metadata: Metadata = {
  title: '주문 | STYNA',
  ...noIndexMetadata,
};

interface OrdersLayoutProps {
  children: React.ReactNode;
}

export default function OrdersLayout({ children }: OrdersLayoutProps) {
  return <CouponProvider>{children}</CouponProvider>;
}
