import { ReactNode } from 'react';
import { ProductProvider } from '@/context/productProvider';

interface AdminDashboardLayoutProps {
  children: ReactNode;
  products: ReactNode;
}

export default function AdminDashboardLayout({ 
  children,
  products
}: AdminDashboardLayoutProps) {
  return (
    <ProductProvider>
      <div className="admin-dashboard-layout">
        <div className="dashboard-main">
          {children}
          {products}
        </div>
      </div>
    </ProductProvider>
  );
}
