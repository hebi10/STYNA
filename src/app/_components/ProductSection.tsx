'use client';

import Link from 'next/link';
import { useProduct } from '@/context/productProvider';
import ProductCard from '@/app/products/_components/ProductCard';
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

function getOperatingMetadata(
  product: Product,
  index: number,
  type: ProductSectionProps['type'],
) {
  const reviewCount = product.reviewCount ?? 0;
  const inStock = (product.stock ?? 0) > 0;
  const operationLabel =
    type === 'recommended' || index === 0
      ? 'MD추천'
      : product.isNew
        ? 'NEW'
        : product.isSale
          ? 'SALE'
          : undefined;
  const shippingLabel = inStock ? '오늘출발' : undefined;
  const reviewLabel = reviewCount >= 100 ? '리뷰 100+' : undefined;
  const mdComment = product.isSale
    ? '이번 주만 적용되는 시즌 특가로 준비했습니다.'
    : reviewCount >= 100
      ? '실제 구매 후기가 많은 데일리 기본 아이템입니다.'
      : '가볍게 입고 오래 손이 가는 소재와 핏을 기준으로 골랐습니다.';

  return { operationLabel, shippingLabel, reviewLabel, mdComment };
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
    recommendedProducts,
    newProducts,
    saleProducts,
    bestSellerProducts,
    loading,
  } = useProduct();

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
          {showViewAllButton && (
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
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>상품을 불러오는 중입니다...</p>
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return null;
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
              {...getOperatingMetadata(product, index, type)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
