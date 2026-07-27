'use client';

import React from 'react';
import Image from 'next/image';
import { useUserActivity } from '@/context/userActivityProvider';
import { useAuth } from '@/context/authProvider';
import { useProductsByIds } from '@/shared/hooks/useProducts';
import Link from 'next/link';
import styles from './RecentProducts.module.css';

interface RecentProductsProps {
  embedded?: boolean;
  limit?: number;
}

export default function RecentProducts({
  embedded = false,
  limit,
}: RecentProductsProps) {
  const { 
    recentProducts, 
    loading, 
    error,
    clearAllRecentProducts
  } = useUserActivity();
  const { user } = useAuth();
  const visibleRecentProducts =
    typeof limit === 'number' ? recentProducts.slice(0, limit) : recentProducts;
  const productQuery = useProductsByIds(
    visibleRecentProducts.map((recentProduct) => recentProduct.productId),
  );

  // 모든 최근 본 상품 삭제 확인
  const handleClearAll = async () => {
    if (window.confirm('모든 최근 본 상품을 삭제하시겠습니까?')) {
      try {
        await clearAllRecentProducts();
      } catch (error) {
        console.error('최근 본 상품 삭제 실패:', error);
        alert('최근 본 상품 삭제에 실패했습니다.');
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
          <h2>최근 본 상품</h2>
          <div className={styles.headerActions}>
            <span className={styles.count}>{recentProducts.length}개</span>
            {recentProducts.length > 0 && (
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
        <div className={styles.loading}>최근 본 상품을 불러오는 중...</div>
      ) : recentProducts.length === 0 ? (
        <div className={styles.empty}>
          <p>최근 본 상품이 없습니다.</p>
          <Link href="/categories" className={styles.shopLink}>
            상품 둘러보기
          </Link>
        </div>
      ) : (
        <div className={styles.productGrid}>
          {visibleRecentProducts.map((recentProduct) => {
            const product = productQuery.productsById.get(recentProduct.productId);
            
            if (!product) {
              const failed = productQuery.failedIds.includes(recentProduct.productId);
              return (
                <div key={recentProduct.id} className={styles.productCard}>
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
              <div key={recentProduct.id} className={styles.productCard}>
                <Link href={`/products/${product.id}`} className={styles.productLink}>
                  <div className={styles.productImage}>
                    <Image
                      src={product.mainImage || product.images[0]}
                      alt={product.name}
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                    <div className={styles.viewedTime}>
                      {recentProduct.viewedAt.toLocaleDateString()}
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
