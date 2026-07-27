'use client';

import Link from 'next/link';
import { useHomeProducts } from '@/shared/hooks/useProducts';
import ProductCard from '@/app/products/_components/ProductCard';
import AsyncStatePanel from './AsyncStatePanel';
import { Product } from '@/shared/types/product';
import styles from './ProductSection.module.css';

type ProductSectionVariant = 'default' | 'ranking' | 'sale' | 'scroll';
type ProductSectionHeaderStyle = 'minimal' | 'bordered' | 'display';

interface ProductSectionProps {
  title: string;
  subtitle?: string;
  description?: string;
  eyebrow?: string;
  type: 'recommended' | 'new' | 'sale' | 'bestseller';
  showViewAllButton?: boolean;
  maxItems?: number;
  variant?: ProductSectionVariant;
  headerStyle?: ProductSectionHeaderStyle;
  viewAllLink?: string;
  viewAllLabel?: string;
  className?: string;
}

const MAIN_ALLOWED_CATEGORY_IDS = new Set([
  'clothing',
  'tops',
  'top',
  'bottoms',
  'bottom',
  'outerwear',
  'bags',
  'bag',
  'shoes',
  'shoe',
  'jewelry',
  'accessories',
  'accessory',
  '상의',
  '하의',
  '아우터',
  '가방',
  '신발',
  '주얼리',
  '악세서리',
  '액세서리',
]);

const MAIN_EXCLUDED_KEYWORDS = [
  '수영',
  '고글',
  '캐리어',
  '어닝',
  '캠핑',
];

function isMainCuratedProduct(product: Product) {
  const searchableText = [
    product.name,
    product.description,
    product.category,
    product.categoryId,
    ...(product.tags || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const categoryId = (product.categoryId || product.category || '').toLowerCase();

  if (MAIN_EXCLUDED_KEYWORDS.some((keyword) => searchableText.includes(keyword.toLowerCase()))) {
    return false;
  }

  return MAIN_ALLOWED_CATEGORY_IDS.has(categoryId);
}

function getDisplayProducts(
  sourceProducts: Product[],
  maxItems: number,
  variant: ProductSectionVariant,
) {
  const products = sourceProducts.filter(isMainCuratedProduct).slice(0, maxItems);

  if (variant === 'ranking' && products.length > 4 && products.length < 8) {
    return products.slice(0, 4);
  }

  return products;
}

export default function ProductSection({
  title,
  subtitle,
  description,
  eyebrow,
  type,
  showViewAllButton = true,
  maxItems = 8,
  variant = 'default',
  headerStyle = 'minimal',
  viewAllLink = '/recommend',
  viewAllLabel = '전체 보기',
  className = '',
}: ProductSectionProps) {
  const {
    data,
    isLoading: loading,
    isError,
    refetch,
  } = useHomeProducts();
  const {
    recommendedProducts = [],
    newProducts = [],
    saleProducts = [],
    bestSellerProducts = [],
  } = data ?? {};

  const getProducts = () => {
    switch (type) {
      case 'recommended':
        return recommendedProducts;
      case 'new':
        return newProducts;
      case 'sale':
        return saleProducts;
      case 'bestseller':
        return bestSellerProducts;
      default:
        return [];
    }
  };

  const products = getDisplayProducts(getProducts(), maxItems, variant);
  const isSuccessfulEmpty = !loading && !isError && products.length === 0;

  const sectionClassName = [styles.section, className].filter(Boolean).join(' ');
  const headerClassName = [
    styles.header,
    headerStyle === 'bordered'
      ? styles.headerBordered
      : headerStyle === 'display'
        ? styles.headerDisplay
        : styles.headerMinimal,
  ]
    .filter(Boolean)
    .join(' ');

  const gridClassName =
    variant === 'ranking'
      ? styles.rankingGrid
      : variant === 'sale'
        ? styles.saleGrid
        : variant === 'scroll'
          ? styles.scrollGrid
          : styles.productGrid;

  const linkClassName =
    headerStyle === 'display' ? styles.viewAllButton : styles.viewAllLink;

  const headerContent = (
    <div className={headerClassName}>
      <div className={styles.headerCopy}>
        {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
        <h2 className={styles.title}>{title}</h2>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>

      {(description || showViewAllButton) && (
        <div className={styles.headerSide}>
          {description && <p className={styles.description}>{description}</p>}
          {showViewAllButton && !isSuccessfulEmpty && (
            <Link href={viewAllLink} className={linkClassName}>
              {viewAllLabel}
            </Link>
          )}
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <section className={sectionClassName}>
        {headerContent}
        <div className={styles.loading} role="status" aria-live="polite">
          <div className={styles.spinner}></div>
          <p>상품을 불러오는 중입니다...</p>
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className={sectionClassName}>
        {headerContent}
        <AsyncStatePanel
          kind="error"
          title="상품을 불러오지 못했습니다."
          description="잠시 후 다시 시도해 주세요."
          primaryAction={{ label: '다시 시도', onClick: () => void refetch() }}
        />
      </section>
    );
  }

  if (products.length === 0) {
    return (
      <section className={sectionClassName}>
        {headerContent}
        <div className={styles.emptyState}>
          <p>현재 소개할 상품이 없습니다.</p>
          <Link href="/products" className={styles.viewAllButton}>
            전체 상품 보기
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className={sectionClassName}>
      {headerContent}

      <div className={gridClassName}>
        {products.map((product, index) => (
          <div
            key={product.id}
            className={[
              variant === 'ranking' ? styles.rankingItem : '',
              variant === 'scroll' ? styles.scrollItem : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {variant === 'ranking' && (
              <span className={styles.rankNumber}>{index + 1}</span>
            )}
            <ProductCard
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
              badgePlacement={variant === 'ranking' ? 'belowRank' : 'default'}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
