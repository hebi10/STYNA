'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useUserActivity } from '@/context/userActivityProvider';
import { useAuth } from '@/context/authProvider';
import { useProductsByIds } from '@/shared/hooks/useProducts';
import { WishlistItem } from '@/shared/types/userActivity';
import Link from 'next/link';
import styles from './WishlistProducts.module.css';

interface WishlistProductsProps {
  embedded?: boolean;
  limit?: number;
}

export default function WishlistProducts({
  embedded = false,
  limit,
}: WishlistProductsProps) {
  const { 
    wishlistItems, 
    loading, 
    error,
    removeFromWishlist,
    clearAllWishlistItems
  } = useUserActivity();
  
  const { user } = useAuth();
  const [removing, setRemoving] = useState<string | null>(null);
  const visibleWishlistItems =
    typeof limit === 'number' ? wishlistItems.slice(0, limit) : wishlistItems;
  const productQuery = useProductsByIds(
    visibleWishlistItems.map((wishlistItem) => wishlistItem.productId),
  );

  const handleRemoveFromWishlist = async (wishlistId: string, productId: string) => {
    if (!user?.uid) return;
    
    setRemoving(wishlistId);
    try {
      await removeFromWishlist(productId);
    } catch (error) {
      console.error('찜 목록에서 제거 실패:', error);
    }
    setRemoving(null);
  };

  // 모든 찜한 상품 삭제 확인
  const handleClearAll = async () => {
    if (window.confirm('모든 찜한 상품을 삭제하시겠습니까?')) {
      try {
        await clearAllWishlistItems();
      } catch (error) {
        console.error('찜한 상품 삭제 실패:', error);
        alert('찜한 상품 삭제에 실패했습니다.');
      }
    }
  };

  if (!user) {
    return (
      <div className={styles.notLoggedIn}>
        <p>로그인이 필요한 서비스입니다.</p>
        <Link href="/auth/login" className={styles.loginLink}>
          로그인하기
        </Link>
      </div>
    );
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  return (
    <div className={`${styles.container} ${embedded ? styles.embedded : ''}`}>
      {!embedded ? (
        <div className={styles.header}>
          <h2>찜한 상품</h2>
          <div className={styles.headerActions}>
            <span className={styles.count}>{wishlistItems.length}개</span>
            {wishlistItems.length > 0 && (
              <button 
                className={styles.clearButton}
                onClick={handleClearAll}
                type="button"
              >
                전체 삭제
              </button>
            )}
          </div>
        </div>
      ) : null}

      {loading || productQuery.isLoading ? (
        <div className={styles.loading}>찜한 상품을 불러오는 중...</div>
      ) : wishlistItems.length === 0 ? (
        <div className={styles.empty}>
          <p>찜한 상품이 없습니다.</p>
          <Link href="/categories" className={styles.shopLink}>
            상품 둘러보기
          </Link>
        </div>
      ) : (
        <div className={styles.productGrid}>
          {visibleWishlistItems.map((wishlistItem: WishlistItem) => {
            const product = productQuery.productsById.get(wishlistItem.productId);
            
            if (!product) {
              const failed = productQuery.failedIds.includes(wishlistItem.productId);
              return (
                <div key={wishlistItem.id} className={styles.productCard}>
                  <div className={styles.productInfo}>
                    <p>{failed ? '상품 정보를 불러오지 못했습니다.' : '더 이상 판매하지 않는 상품입니다.'}</p>
                    {failed ? (
                      <button type="button" onClick={() => void productQuery.refetch()}>
                        다시 시도
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            }
            
            return (
              <div key={wishlistItem.id} className={styles.productCard}>
                <div className={styles.removeButton}>
                  <button
                    onClick={() => handleRemoveFromWishlist(wishlistItem.id, wishlistItem.productId)}
                    disabled={removing === wishlistItem.id}
                    className={styles.removeBtn}
                  >
                    {removing === wishlistItem.id ? '삭제중...' : 'X'}
                  </button>
                </div>
                
                <Link href={`/products/${product.id}`} className={styles.productLink}>
                  <div className={styles.productImage}>
                    <Image
                      src={product.mainImage || product.images[0]}
                      alt={product.name}
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                    <div className={styles.addedTime}>
                      {wishlistItem.addedAt.toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div className={styles.productInfo}>
                    <h3 className={styles.productName}>{product.name}</h3>
                    <p className={styles.productBrand}>{product.brand}</p>
                    
                    <div className={styles.priceInfo}>
                      {product.saleRate && product.saleRate > 0 ? (
                        <>
                          <span className={styles.saleRate}>{product.saleRate}%</span>
                          <span className={styles.salePrice}>
                            {product.price.toLocaleString()}원
                          </span>
                          {product.originalPrice && (
                            <span className={styles.originalPrice}>
                              {product.originalPrice.toLocaleString()}원
                            </span>
                          )}
                        </>
                      ) : (
                        <span className={styles.price}>
                          {product.price.toLocaleString()}원
                        </span>
                      )}
                    </div>
                    
                    <div className={styles.productStats}>
                      <span className={styles.rating}>⭐ {product.rating.toFixed(1)}</span>
                      <span className={styles.reviews}>리뷰 {product.reviewCount}개</span>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
