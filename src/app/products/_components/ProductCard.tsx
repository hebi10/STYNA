'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useUserActivity } from '@/context/userActivityProvider';
import { getProductPricing } from '@/shared/utils/productPricing';
import styles from './ProductCard.module.css';
import { useAuthUser } from '@/shared/hooks/useAuthUser';

interface ProductCardProps {
  id: string;
  name: string;
  brand: string;
  price: number;
  originalPrice?: number;
  image?: string;
  isNew?: boolean;
  isSale?: boolean;
  saleRate?: number;
  rating?: number;
  reviewCount?: number;
  stock?: number;
  badgePlacement?: 'default' | 'belowRank';
  operationLabel?: string;
  shippingLabel?: string;
  reviewLabel?: string;
  mdComment?: string;
}

export default function ProductCard({
  id,
  name,
  brand,
  price,
  originalPrice,
  image,
  isNew,
  isSale,
  saleRate,
  rating,
  reviewCount,
  stock = 0,
  badgePlacement = 'default',
  operationLabel,
  shippingLabel,
  reviewLabel,
  mdComment,
}: ProductCardProps) {
  const { wishlistItems, addToWishlist, removeFromWishlist } = useUserActivity();
  const { user } = useAuthUser();

  // 찜하기 상태는 실제 데이터에서 가져오기
  const isWishlisted = wishlistItems.some(item => item.productId === id);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR').format(price) + '원';
  };

  const pricing = getProductPricing({ price, originalPrice, saleRate });
  const discountRate = pricing.discountRate;
  const displayPrice = pricing.salePrice;
  const inStock = stock > 0;

  const displayRating = rating || 0;
  const displayReviewCount = reviewCount ?? 0;

  const handleWishlistClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if(!user) {
      alert('로그인이 필요한 서비스입니다.');
      return;
    }
    
    try {
      if (isWishlisted) {
        await removeFromWishlist(id);
      } else {
        await addToWishlist(id);
      }
    } catch (error) {
      console.error('찜하기 처리 실패:', error);
    }
  };

  return (
    <Link
      href={`/products/${id}`}
      className={[
        styles.card,
        badgePlacement === 'belowRank' ? styles.cardBadgeBelowRank : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={styles.imageContainer}>
        {image ? (
          <Image
            src={image}
            alt={name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className={styles.image}
          />
        ) : (
          <div className={styles.placeholder}>
            <span>이미지 준비중</span>
          </div>
        )}
        
        {/* 배지들 */}
        <div className={styles.badges}>
          {operationLabel && (
            <span className={`${styles.badge} ${styles.badgeOperation}`}>{operationLabel}</span>
          )}
          {isNew && (
            <span className={`${styles.badge} ${styles.badgeNew}`}>NEW</span>
          )}
          {isSale && discountRate > 0 && (
            <span className={`${styles.badge} ${styles.badgeSale}`}>
              -{discountRate}%
            </span>
          )}
          {!inStock && (
            <span className={`${styles.badge} ${styles.badgeOutOfStock}`}>SOLD OUT</span>
          )}
        </div>

        {/* 위시리스트 버튼 */}
        <button
          className={`${styles.wishlistButton} ${isWishlisted ? styles.wishlisted : ''}`}
          onClick={handleWishlistClick}
          aria-label="위시리스트에 추가"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill={isWishlisted ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>
      
      <div className={styles.info}>
        <p className={styles.brand}>{brand}</p>
        <h3 className={styles.name}>{name}</h3>

        {(shippingLabel || reviewLabel) && (
          <div className={styles.operatingLabels}>
            {shippingLabel && <span>{shippingLabel}</span>}
            {reviewLabel && <span>{reviewLabel}</span>}
          </div>
        )}

        {mdComment && <p className={styles.mdComment}>{mdComment}</p>}
        
        <div className={styles.priceContainer}>
          {pricing.listPrice > pricing.salePrice && (
            <span className={styles.originalPrice}>
              {formatPrice(pricing.listPrice)}
            </span>
          )}
          <span className={styles.price}>
            {formatPrice(displayPrice)}
          </span>
        </div>
        
        {displayRating > 0 && displayReviewCount > 0 && (
          <div className={styles.rating}>
            <span className={styles.ratingValue}>★ {displayRating}</span>
            <span className={styles.reviewCount}>({displayReviewCount})</span>
          </div>
        )}

        {/* 재고 상태 */}
        {!inStock && (
          <div className={styles.stockStatus}>
            <span className={styles.outOfStock}>품절</span>
          </div>
        )}
      </div>
    </Link>
  );
}
