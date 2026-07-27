'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { FeaturedProductService } from '@/shared/services/featuredProductService';
import { productKeys } from '@/shared/hooks/queryKeys';
import ProductCard from '@/app/products/_components/ProductCard';
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
  const {
    data: section,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: productKeys.featured(),
    queryFn: () => FeaturedProductService.getFeaturedSection(),
    staleTime: 5 * 60 * 1000,
  });

  const sectionClassNameCombined = [styles.section, sectionClassName]
    .filter(Boolean)
    .join(' ');

  if (isLoading) {
    return (
      <section className={sectionClassNameCombined} aria-label="추천 상품 불러오는 중">
        <div className={styles.container}>
          <div className={styles.loading} role="status">추천 상품을 불러오는 중입니다.</div>
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className={sectionClassNameCombined}>
        <div className={styles.container}>
          <div className={styles.errorState} role="alert">
            <p>추천 상품을 불러오지 못했습니다.</p>
            <button
              type="button"
              className={styles.retryButton}
              onClick={() => void refetch()}
            >
              다시 시도
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (!section?.config.isActive || section.products.length === 0) {
    return null;
  }

  const resolvedTitle = title || section.config.title;
  const resolvedSubtitle = subtitle || section.config.subtitle;
  const resolvedDescription = description || section.config.description;

  return (
    <section className={sectionClassNameCombined}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.copyBlock}>
            {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
            <h2 className={styles.title}>{resolvedTitle}</h2>
            {resolvedSubtitle ? <p className={styles.subtitle}>{resolvedSubtitle}</p> : null}
          </div>
          <div className={styles.headerSide}>
            {resolvedDescription ? <p className={styles.description}>{resolvedDescription}</p> : null}
            <Link href="/recommend" className={styles.viewAllButton}>
              {viewAllLabel}
            </Link>
          </div>
        </div>

        <div className={styles.productGrid}>
          {section.products.map((product) => (
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
      </div>
    </section>
  );
}
