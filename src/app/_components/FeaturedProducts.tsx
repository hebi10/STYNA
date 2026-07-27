'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { FeaturedProductService } from '@/shared/services/featuredProductService';
import { useHomeProducts } from '@/shared/hooks/useProducts';
import { productKeys } from '@/shared/hooks/queryKeys';
import ProductCard from '@/app/products/_components/ProductCard';
import AsyncStatePanel from './AsyncStatePanel';
import styles from './FeaturedProducts.module.css';

interface FeaturedProductsProps {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  sectionClassName?: string;
  viewAllLabel?: string;
}

export default function FeaturedProducts({
  eyebrow,
  title,
  subtitle,
  description,
  sectionClassName = '',
  viewAllLabel = '전체 보기',
}: FeaturedProductsProps) {
  const featuredQuery = useQuery({
    queryKey: productKeys.featured(),
    queryFn: () => FeaturedProductService.getFeaturedSection(),
    staleTime: 5 * 60 * 1000,
  });
  const homeQuery = useHomeProducts();
  const fallbackProducts = homeQuery.data?.recommendedProducts.slice(0, 4) ?? [];
  const isFallback = featuredQuery.isError && fallbackProducts.length > 0;
  const section = featuredQuery.data;

  const sectionClassNameCombined = [styles.section, sectionClassName]
    .filter(Boolean)
    .join(' ');

  if (featuredQuery.isLoading || (featuredQuery.isError && homeQuery.isLoading)) {
    return (
      <section className={sectionClassNameCombined} aria-label="추천 상품 불러오는 중">
        <div className={styles.container}>
          <div className={styles.loading} role="status">추천 상품을 불러오는 중입니다.</div>
        </div>
      </section>
    );
  }

  if (featuredQuery.isError && !isFallback) {
    return (
      <section className={sectionClassNameCombined}>
        <div className={styles.container}>
          <AsyncStatePanel
            kind="error"
            title="추천 상품을 불러오지 못했습니다."
            description="잠시 후 다시 시도해 주세요."
            primaryAction={{
              label: '다시 시도',
              onClick: () => {
                void featuredQuery.refetch();
                void homeQuery.refetch();
              },
            }}
          />
        </div>
      </section>
    );
  }

  if (!isFallback && !section?.config.isActive) {
    return null;
  }

  const products = isFallback ? fallbackProducts : section!.products;
  const isEmpty = products.length === 0;
  const resolvedTitle = title || (isFallback ? '추천 상품' : section!.config.title);
  const resolvedSubtitle = subtitle || (isFallback ? undefined : section!.config.subtitle);
  const resolvedDescription = description || (isFallback ? undefined : section!.config.description);

  return (
    <section className={sectionClassNameCombined}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.copyBlock}>
            {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
            <h2 className={styles.title}>{resolvedTitle}</h2>
            {resolvedSubtitle ? <p className={styles.subtitle}>{resolvedSubtitle}</p> : null}
          </div>
          {(resolvedDescription || !isEmpty) && (
            <div className={styles.headerSide}>
              {resolvedDescription ? <p className={styles.description}>{resolvedDescription}</p> : null}
              {!isEmpty && (
                <Link href="/recommend" className={styles.viewAllButton}>
                  {viewAllLabel}
                </Link>
              )}
            </div>
          )}
        </div>

        {isEmpty ? (
          <div className={styles.emptyState}>
            <p>현재 소개할 추천 상품이 없습니다.</p>
            <Link href="/products" className={styles.viewAllButton}>
              전체 상품 보기
            </Link>
          </div>
        ) : (
          <div className={styles.productGrid}>
            {products.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                name={product.name}
                brand={product.brand}
                price={product.price}
                originalPrice={product.originalPrice}
                isNew={product.isNew}
                isSale={product.isSale}
                saleRate={product.saleRate}
                rating={product.rating}
                reviewCount={product.reviewCount}
                image={product.mainImage || product.images[0]}
                stock={product.stock}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
