'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ProductCard from '@/app/products/_components/ProductCard';
import { ProductService } from '@/shared/services/productService';
import {
  STYLE_NOW_SEASONS,
  StyleNowSeasonKey,
  getStyleNowStorageUrl,
} from './styleNowData';
import styles from './StyleNowSection.module.css';

function getValidatedSeasonProducts(
  products: Awaited<ReturnType<typeof ProductService.getPublicProductsByIds>>,
  seasonTag: string,
) {
  return products.filter(
    (product) =>
      product.status === 'active' && product.tags.includes(seasonTag),
  );
}

export default function StyleNowSection() {
  const [activeSeasonKey, setActiveSeasonKey] =
    useState<StyleNowSeasonKey>('spring');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeSeason =
    STYLE_NOW_SEASONS.find((season) => season.key === activeSeasonKey) ??
    STYLE_NOW_SEASONS[0];
  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['products', 'style-now', activeSeason.key],
    queryFn: () =>
      ProductService.getPublicProductsByIds(activeSeason.productIds),
  });
  const products = data
    ? getValidatedSeasonProducts(data, activeSeason.tag)
    : [];
  const hasInvalidCount = Boolean(data && products.length !== 20);
  const heroImage =
    getStyleNowStorageUrl(activeSeason.heroStoragePath) ??
    activeSeason.heroLocalPath;

  const selectSeason = (seasonKey: StyleNowSeasonKey, index: number) => {
    setActiveSeasonKey(seasonKey);
    tabRefs.current[index]?.focus();
  };

  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    let nextIndex = currentIndex;

    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % STYLE_NOW_SEASONS.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex =
        (currentIndex - 1 + STYLE_NOW_SEASONS.length) %
        STYLE_NOW_SEASONS.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = STYLE_NOW_SEASONS.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextSeason = STYLE_NOW_SEASONS[nextIndex];
    selectSeason(nextSeason.key, nextIndex);
  };

  return (
    <section className={styles.section} aria-labelledby="style-now-title">
      <div className={styles.container}>
        <header className={styles.sectionHeader}>
          <p className={styles.kicker}>STYLE NOW</p>
          <div className={styles.sectionHeading}>
            <h2 id="style-now-title">스타일나우</h2>
            <p>
              계절의 색과 소재를 따라 지금 입기 좋은 스타일을
              살펴보세요.
            </p>
          </div>
        </header>

        <div className={styles.tabs} role="tablist" aria-label="스타일나우 계절">
          {STYLE_NOW_SEASONS.map((season, index) => {
            const isActive = season.key === activeSeason.key;
            return (
              <button
                key={season.key}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                type="button"
                id={`style-now-tab-${season.key}`}
                className={isActive ? styles.activeTab : styles.tab}
                role="tab"
                aria-selected={isActive}
                aria-controls={`style-now-panel-${season.key}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => selectSeason(season.key, index)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                {season.label}
              </button>
            );
          })}
        </div>

        <div
          id={`style-now-panel-${activeSeason.key}`}
          className={styles.panel}
          role="tabpanel"
          aria-labelledby={`style-now-tab-${activeSeason.key}`}
          aria-busy={isLoading}
          tabIndex={0}
        >
          <div className={styles.heroColumn}>
            <Image
              key={activeSeason.key}
              src={heroImage}
              alt={activeSeason.heroAlt}
              width={900}
              height={2700}
              sizes="(max-width: 900px) 300px, 25vw"
              className={styles.heroImage}
            />
          </div>

          <div className={styles.productsColumn}>
            <header className={styles.seasonHeader}>
              <div>
                <p className={styles.seasonLabel}>{activeSeason.label} STYLE</p>
                <h3>{activeSeason.title}</h3>
                <p>{activeSeason.description}</p>
              </div>
              <span className={styles.productCount}>20개 상품</span>
            </header>

            {isLoading && (
              <div className={styles.status} role="status">
                {activeSeason.label} 상품을 불러오는 중입니다.
              </div>
            )}

            {(isError || hasInvalidCount) && (
              <div className={styles.errorState} role="alert">
                <p>
                  {hasInvalidCount
                    ? `${activeSeason.label} 상품은 20개가 필요하지만 ${products.length}개만 확인되었습니다.`
                    : `${activeSeason.label} 상품을 불러오지 못했습니다.`}
                </p>
                <button
                  type="button"
                  onClick={() => void refetch()}
                  aria-label={`${activeSeason.label} 상품 다시 불러오기`}
                >
                  다시 시도
                </button>
              </div>
            )}

            {!isLoading && !isError && !hasInvalidCount && (
              <div className={styles.productGrid}>
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    brand={product.brand}
                    price={product.price}
                    originalPrice={product.originalPrice}
                    image={product.mainImage || product.images[0]}
                    isNew={product.isNew}
                    isSale={product.isSale}
                    saleRate={product.saleRate}
                    rating={product.rating}
                    reviewCount={product.reviewCount}
                    stock={product.stock}
                    operationLabel={activeSeason.label}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
