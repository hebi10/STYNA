import PageHeader from "@/app/_components/PageHeader";
import ProductList from "./_components/ProductList";
import styles from "./page.module.css";
import type { Metadata } from "next";
import { routeMetadata } from "@/shared/constants/routeMetadata";
import { Suspense } from "react";

export const metadata: Metadata = routeMetadata.products;

export default function ProductsPage() {
  return (
    <div className={styles.container}>
      <PageHeader
        title="전체 상품"
        description="STYNA의 다양한 상품을 만나보세요"
        breadcrumb={[
          { label: '홈', href: '/' },
          { label: '전체 상품' }
        ]}
      />
      
      <div className={styles.content}>
        <Suspense fallback={<p role="status">상품 목록을 준비 중입니다.</p>}>
          <ProductList />
        </Suspense>
      </div>
    </div>
  );
}
