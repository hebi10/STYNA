'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useReview } from '@/context/reviewProvider';
import { useProductsByIds } from '@/shared/hooks/useProducts';
import Link from 'next/link';
import Button from '@/app/_components/Button';
import { formatDate } from '@/shared/utils/dateFormat';
import styles from './ReviewList.module.css';

export default function ReviewList() {
  const { 
    allReviews, 
    loading, 
    error,
    currentPage,
    totalPages,
    totalCount,
    reviewStatistics,
    loadAllReviews 
  } = useReview();
  
  const [ratingFilter, setRatingFilter] = useState<number | undefined>();
  const [sortBy, setSortBy] = useState<'latest' | 'rating' | 'helpful'>('latest');
  const productQuery = useProductsByIds(allReviews.map((review) => review.productId));

  useEffect(() => {
    console.log('리뷰 목록 로딩 시작 - ratingFilter:', ratingFilter, 'sortBy:', sortBy);
    loadAllReviews(1, ratingFilter, sortBy);
  }, [ratingFilter, sortBy, loadAllReviews]);

  const renderStars = (rating: number) => {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  };

  // 페이지 변경 함수
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      loadAllReviews(page, ratingFilter, sortBy);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // 페이지 번호 배열 생성 (모바일에서는 최소화)
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5; // 기본적으로 5개 표시
    
    if (totalPages <= maxVisible) {
      // 총 페이지가 표시할 개수보다 적으면 모두 표시
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // 현재 페이지 주변으로 표시
      const halfVisible = Math.floor(maxVisible / 2);
      let start = Math.max(1, currentPage - halfVisible);
      const end = Math.min(totalPages, start + maxVisible - 1);
      
      // 끝이 조정되면 시작도 조정
      if (end - start + 1 < maxVisible) {
        start = Math.max(1, end - maxVisible + 1);
      }
      
      // 첫 페이지 표시
      if (start > 1) {
        pages.push(1);
        if (start > 2) pages.push('...');
      }
      
      // 중간 페이지들
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      // 마지막 페이지 표시
      if (end < totalPages) {
        if (end < totalPages - 1) pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h3>리뷰 로딩 중 오류가 발생했습니다</h3>
          <p>{error}</p>
          <button 
            onClick={() => loadAllReviews(1, ratingFilter, sortBy)}
            className={styles.retryButton}
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 통계 정보 */}
      {reviewStatistics.totalCount > 0 && (
        <div className={styles.stats}>
          <div className={styles.statItem}>
            <div className={styles.statNumber}>{reviewStatistics.totalCount}</div>
            <div className={styles.statLabel}>전체 리뷰</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statNumber}>
              {reviewStatistics.averageRating.toFixed(1)}
            </div>
            <div className={styles.statLabel}>평균 평점</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statNumber}>
              {reviewStatistics.recommendationRate}%
            </div>
            <div className={styles.statLabel}>추천율</div>
          </div>
        </div>
      )}

      {/* 필터 및 정렬 */}
      <div className={styles.controls}>
        <div className={styles.filters}>
          <button
            className={`${styles.filterButton} ${ratingFilter === undefined ? styles.active : ''}`}
            onClick={() => setRatingFilter(undefined)}
          >
            전체
          </button>
          {[5, 4, 3, 2, 1].map(rating => (
            <button
              key={rating}
              className={`${styles.filterButton} ${ratingFilter === rating ? styles.active : ''}`}
              onClick={() => setRatingFilter(rating)}
            >
              {rating}점
            </button>
          ))}
        </div>

        <div className={styles.sorting}>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'latest' | 'rating' | 'helpful')}
            className={styles.sortSelect}
          >
            <option value="latest">최신순</option>
            <option value="rating">평점순</option>
            <option value="helpful">도움순</option>
          </select>
        </div>
      </div>

      {/* 리뷰 목록 */}
      <div className={styles.reviewList}>
        {loading ? (
          <div className={styles.loading}>리뷰를 불러오는 중...</div>
        ) : allReviews.length === 0 ? (
          <div className={styles.empty}>등록된 리뷰가 없습니다.</div>
        ) : (
          allReviews.map((review) => {
            const product = productQuery.productsById.get(review.productId);
            const productLabel = product?.name
              ?? (productQuery.failedIds.includes(review.productId)
                ? '상품 정보 확인 실패'
                : productQuery.isLoading
                  ? '상품 정보 불러오는 중'
                  : '판매 종료 상품');

            return (
            <div key={review.id} className={styles.reviewItem}>
              {/* 상품 정보 */}
              <div className={styles.productInfo}>
                {product?.mainImage && (
                  <Image
                    src={product.mainImage}
                    alt={product.name || '상품'}
                    className={styles.productImage}
                    width={96}
                    height={96}
                  />
                )}
                <div className={styles.productDetails}>
                  <Link 
                    href={`/products/${review.productId}`}
                    className={styles.productName}
                  >
                    {productLabel}
                  </Link>
                  {(review.size || review.color) && (
                    <div className={styles.productOptions}>
                      {review.size && <span>사이즈: {review.size}</span>}
                      {review.color && <span>색상: {review.color}</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* 리뷰 내용 */}
              <div className={styles.reviewContent}>
                <div className={styles.reviewHeader}>
                  <div className={styles.userInfo}>
                    <span className={styles.userName}>{review.userName}</span>
                    <span className={styles.rating}>{renderStars(review.rating)}</span>
                    {review.isRecommended && (
                      <span className={styles.recommended}>추천</span>
                    )}
                  </div>
                  <span className={styles.reviewDate}>
                    {formatDate(review.createdAt)}
                  </span>
                </div>

                <div className={styles.reviewBody}>
                  <h4 className={styles.reviewTitle}>{review.title}</h4>
                  <p className={styles.reviewText}>{review.content}</p>
                </div>

                <div className={styles.reviewActions}>
                  <Link 
                    href={`/products/${review.productId}`}
                    className={styles.productLink}
                  >
                    상품 보기
                  </Link>
                </div>
              </div>
            </div>
          );
          })
        )}
      </div>

      {/* 페이징 네비게이션 */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={`${styles.pageButton} ${currentPage === 1 ? styles.disabled : ''}`}
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            이전
          </button>

          {getPageNumbers().map((page, index) => (
            <React.Fragment key={index}>
              {typeof page === 'number' ? (
                <button
                  className={`${styles.pageButton} ${currentPage === page ? styles.active : ''}`}
                  onClick={() => handlePageChange(page)}
                >
                  {page}
                </button>
              ) : (
                <span className={styles.ellipsis}>{page}</span>
              )}
            </React.Fragment>
          ))}

          <button
            className={`${styles.pageButton} ${currentPage === totalPages ? styles.disabled : ''}`}
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            다음
          </button>
        </div>
      )}

      {/* 페이지 정보 */}
      {totalCount > 0 && (
        <div className={styles.pageInfo}>
          <span>
            총 {totalCount}개의 리뷰 중 {currentPage}페이지 ({((currentPage - 1) * 10) + 1}~{Math.min(currentPage * 10, totalCount)}번째)
          </span>
        </div>
      )}

      {/* 리뷰 작성 안내 */}
      <div className={styles.writeReview}>
        <p>구매하신 상품에 대한 리뷰를 작성해보세요!</p>
        <Button variant="primary" size="lg">마이페이지에서 리뷰 작성하기</Button>
      </div>
    </div>
  );
}
