'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { FeaturedProductService } from '@/shared/services/featuredProductService';
import { useHomeProducts } from '@/shared/hooks/useProducts';
import { productKeys } from '@/shared/hooks/queryKeys';
import { getProductPricing } from '@/shared/utils/productPricing';
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
  const fallbackProducts = homeQuery.data?.recommendedProducts.slice(0, 3) ?? [];
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

  const products = (isFallback ? fallbackProducts : section!.products).slice(0, 3);
  const isEmpty = products.length === 0;
  const resolvedTitle = title || (isFallback ? '추천 상품' : section!.config.title);
  const resolvedSubtitle = subtitle || (isFallback ? undefined : section!.config.subtitle);
  const resolvedDescription = description || (isFallback ? undefined : section!.config.description);
  const heroImage = isFallback
    ? '/style-now/autumn/style-now-autumn-main.webp'
    : section!.config.heroImage || '/style-now/autumn/style-now-autumn-main.webp';

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
          <div className={styles.editorialLayout}>
            <Link href="/recommend" className={styles.heroLink}>
              <Image
                src={heroImage}
                alt={`${resolvedTitle} 무드 이미지`}
                fill
                sizes="(max-width: 768px) 100vw, 66vw"
                className={styles.heroImage}
              />
            </Link>

            <div className={styles.productList}>
              {products.map((product, index) => {
                const pricing = getProductPricing({
                  price: product.price,
                  originalPrice: product.originalPrice,
                  saleRate: product.saleRate,
                });
                const image = product.mainImage || product.images[0];

                return (
                  <Link
                    key={product.id}
                    href={`/products/${product.id}`}
                    className={styles.productRow}
                    aria-label={`${product.name} 상품 보기`}
                  >
                    <span className={styles.productNumber}>{String(index + 1).padStart(2, '0')}</span>
                    <span className={styles.thumbnail}>
                      {image ? (
                        <Image
                          src={image}
                          alt=""
                          fill
                          sizes="96px"
                          className={styles.thumbnailImage}
                        />
                      ) : (
                        <span className={styles.thumbnailPlaceholder} aria-hidden="true" />
                      )}
                    </span>
                    <span className={styles.productCopy}>
                      <span className={styles.productBrand}>{product.brand}</span>
                      <strong className={styles.productName}>{product.name}</strong>
                      <span className={styles.priceLine}>
                        {pricing.listPrice > pricing.salePrice && (
                          <span className={styles.originalPrice}>
                            {pricing.listPrice.toLocaleString('ko-KR')}원
                          </span>
                        )}
                        <span>{pricing.salePrice.toLocaleString('ko-KR')}원</span>
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
