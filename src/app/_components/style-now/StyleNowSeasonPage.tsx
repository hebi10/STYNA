'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import ProductCard from '@/app/products/_components/ProductCard';
import { ProductService } from '@/shared/services/productService';
import {
  STYLE_NOW_SEASONS,
  StyleNowSeasonKey,
  getStyleNowSeason,
} from './styleNowData';
import styles from './StyleNowSeasonPage.module.css';

interface StyleNowSeasonPageProps {
  season: StyleNowSeasonKey;
}

function getValidatedSeasonProducts(
  products: Awaited<ReturnType<typeof ProductService.getPublicProductsByIds>>,
  seasonTag: string,
) {
  return products.filter(
    (product) =>
      product.status === 'active' && product.tags.includes(seasonTag),
  );
}

export default function StyleNowSeasonPage({
  season: seasonKey,
}: StyleNowSeasonPageProps) {
  const season = getStyleNowSeason(seasonKey) ?? STYLE_NOW_SEASONS[0];
  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['products', 'style-now', season.key],
    queryFn: () => ProductService.getPublicProductsByIds(season.productIds),
  });
  const products = data
    ? getValidatedSeasonProducts(data, season.tag)
    : [];
  const hasInvalidCount = Boolean(data && products.length !== 20);

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <Link href="/" className={styles.backLink}>
          ← 홈으로
        </Link>

        <header className={styles.pageHeader}>
          <div>
            <p className={styles.kicker}>STYLE NOW · {season.label}</p>
            <h1>{season.title}</h1>
          </div>
          <p>{season.description}</p>
        </header>

        <nav className={styles.seasonNav} aria-label="스타일나우 계절 이동">
          {STYLE_NOW_SEASONS.map((item) => (
            <Link
              key={item.key}
              href={`/style-now/${item.key}`}
              className={
                item.key === season.key
                  ? styles.activeSeasonLink
                  : styles.seasonLink
              }
              aria-current={item.key === season.key ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.contentLayout}>
          <section
            className={styles.editorial}
            aria-label={`${season.label} 스타일 에디토리얼`}
          >
            {season.editorialPanels.map((panel) => (
              <article
                key={panel.kind}
                className={styles.editorialPanel}
              >
                <Image
                  src={panel.localPath}
                  alt={panel.alt}
                  fill
                  priority={panel.kind === 'model'}
                  sizes="(max-width: 900px) 100vw, 360px"
                  className={`${styles.editorialImage} ${
                    panel.kind === 'model' ? styles.modelImage : ''
                  }`}
                />
                <div
                  className={
                    panel.tone === 'light'
                      ? styles.copyLight
                      : styles.copyDark
                  }
                >
                  <p>{panel.eyebrow}</p>
                  <h2>{panel.title}</h2>
                  <span>{panel.description}</span>
                </div>
              </article>
            ))}
          </section>

          <section
            className={styles.products}
            aria-labelledby="style-now-products-title"
          >
            <header className={styles.productsHeader}>
              <div>
                <p className={styles.kicker}>{season.label} SELECTION</p>
                <h2 id="style-now-products-title">{season.label} 추천 상품</h2>
              </div>
              <span>20개 상품</span>
            </header>

            {isLoading && (
              <div className={styles.status} role="status">
                {season.label} 상품을 불러오는 중입니다.
              </div>
            )}

            {(isError || hasInvalidCount) && (
              <div className={styles.errorState} role="alert">
                <p>
                  {hasInvalidCount
                    ? `${season.label} 상품은 20개가 필요하지만 ${products.length}개만 확인되었습니다.`
                    : `${season.label} 상품을 불러오지 못했습니다.`}
                </p>
                <button
                  type="button"
                  onClick={() => void refetch()}
                  aria-label={`${season.label} 상품 다시 불러오기`}
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
                    operationLabel={season.label}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
