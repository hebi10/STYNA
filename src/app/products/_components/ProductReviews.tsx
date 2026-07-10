'use client';

import React, { useEffect, useState } from 'react';
import { useReview } from '@/context/reviewProvider';
import { useAuth } from '@/context/authProvider';
import { ReviewEligibilityOption, ReviewService } from '@/shared/services/reviewService';
import { formatDate } from '@/shared/utils/dateFormat';
import styles from './ProductReviews.module.css';

interface ProductReviewsProps {
  productId: string;
}

export default function ProductReviews({ productId }: ProductReviewsProps) {
  const { 
    productReviews, 
    reviewSummary, 
    hasMoreReviews,
    loading, 
    error,
    loadProductReviews,
    loadMoreProductReviews,
    loadReviewSummary,
    createReview,
    deleteReview
  } = useReview();
  
  const { user } = useAuth();
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [eligibleOptions, setEligibleOptions] = useState<ReviewEligibilityOption[]>([]);
  const [selectedOptionKey, setSelectedOptionKey] = useState('');
  const [isLoadingEligibleOptions, setIsLoadingEligibleOptions] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    title: '',
    content: '',
    isRecommended: true
  });

  useEffect(() => {
    loadProductReviews(productId);
    loadReviewSummary(productId);
  }, [productId, loadProductReviews, loadReviewSummary]);

  const getOptionKey = (option: ReviewEligibilityOption) => (
    JSON.stringify([option.orderId, option.productId, option.size, option.color])
  );

  const handleOpenReviewForm = async () => {
    if (showReviewForm) {
      setShowReviewForm(false);
      setSubmitError(null);
      return;
    }

    try {
      setIsLoadingEligibleOptions(true);
      setSubmitError(null);
      const options = await ReviewService.getEligibleReviewOptions(productId);
      setEligibleOptions(options);
      setSelectedOptionKey('');

      if (options.length === 0) {
        setShowReviewForm(false);
        setSubmitError('배송 완료 또는 구매 확정된 주문 상품에서만 리뷰를 작성할 수 있습니다.');
        return;
      }

      setShowReviewForm(true);
    } catch (error) {
      console.error('작성 가능한 주문 옵션 조회 실패:', error);
      setShowReviewForm(false);
      setSubmitError(error instanceof Error ? error.message : '작성 가능한 구매 내역을 불러오지 못했습니다.');
    } finally {
      setIsLoadingEligibleOptions(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    const selectedOption = eligibleOptions.find((option) => getOptionKey(option) === selectedOptionKey);
    if (!selectedOption) {
      setSubmitError('리뷰를 작성할 주문 상품 옵션을 선택해주세요.');
      return;
    }

    try {
      setSubmitError(null);
      await createReview(productId, {
        ...reviewForm,
        orderId: selectedOption.orderId,
        size: selectedOption.size,
        color: selectedOption.color,
        images: [] // 이미지 업로드 기능은 추후 구현
      });
      
      setShowReviewForm(false);
      setReviewForm({
        rating: 5,
        title: '',
        content: '',
        isRecommended: true
      });
      
      alert('리뷰가 등록되었습니다.');
    } catch (error) {
      console.error('리뷰 등록 실패:', error);
      setSubmitError(error instanceof Error ? error.message : '리뷰 등록에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    
    try {
      await deleteReview(productId, reviewId);
      alert('리뷰가 삭제되었습니다.');
    } catch (error) {
      console.error('리뷰 삭제 실패:', error);
    }
  };

  const renderStars = (rating: number) => {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  };

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>상품 리뷰</h3>
        {user && (
          <button 
            className={styles.writeButton}
            onClick={() => void handleOpenReviewForm()}
            aria-expanded={showReviewForm}
            disabled={isLoadingEligibleOptions}
          >
            {isLoadingEligibleOptions ? '구매 내역 확인 중...' : '리뷰 작성'}
          </button>
        )}
      </div>
      {!showReviewForm && submitError && (
        <p className={styles.submitError} role="alert">{submitError}</p>
      )}

      {/* 리뷰 요약 */}
      {reviewSummary && (
        <div className={styles.summary}>
          <div className={styles.averageRating}>
            <span className={styles.rating}>{reviewSummary.averageRating}</span>
            <span className={styles.stars}>{renderStars(Math.round(reviewSummary.averageRating))}</span>
            <span className={styles.count}>({reviewSummary.totalReviews}개 리뷰)</span>
          </div>
          
          <div className={styles.distribution}>
            {Object.entries(reviewSummary.ratingDistribution)
              .reverse()
              .map(([rating, count]) => (
                <div key={rating} className={styles.ratingBar}>
                  <span>{rating}점</span>
                  <div className={styles.bar}>
                    <div 
                      className={styles.fill}
                      style={{ 
                        width: `${reviewSummary.totalReviews > 0 ? (count / reviewSummary.totalReviews) * 100 : 0}%` 
                      }}
                    />
                  </div>
                  <span>{count}</span>
                </div>
              ))}
          </div>
          
          <div className={styles.recommendation}>
            추천율: {reviewSummary.recommendationRate}%
          </div>
        </div>
      )}

      {/* 리뷰 작성 폼 */}
      {showReviewForm && (
        <form className={styles.reviewForm} onSubmit={handleSubmitReview}>
          {submitError && (
            <p className={styles.submitError} role="alert">
              {submitError}
            </p>
          )}
          <div className={styles.formGroup}>
            <label htmlFor="review-order-option">구매 상품 옵션</label>
            <select
              id="review-order-option"
              value={selectedOptionKey}
              onChange={(e) => setSelectedOptionKey(e.target.value)}
              required
            >
              <option value="">배송 완료 주문 상품을 선택하세요</option>
              {eligibleOptions.map((option) => (
                <option key={getOptionKey(option)} value={getOptionKey(option)}>
                  {(option.orderNumber || option.orderId)} / {option.color || '색상 없음'} / {option.size || '사이즈 없음'}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="review-rating">평점</label>
            <select 
              id="review-rating"
              value={reviewForm.rating}
              onChange={(e) => setReviewForm(prev => ({ ...prev, rating: Number(e.target.value) }))}
            >
              {[5, 4, 3, 2, 1].map(rating => (
                <option key={rating} value={rating}>
                  {renderStars(rating)} ({rating}점)
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="review-title">제목</label>
            <input
              id="review-title"
              type="text"
              value={reviewForm.title}
              onChange={(e) => setReviewForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="리뷰 제목을 입력하세요"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="review-content">내용</label>
            <textarea
              id="review-content"
              value={reviewForm.content}
              onChange={(e) => setReviewForm(prev => ({ ...prev, content: e.target.value }))}
              placeholder="리뷰 내용을 입력하세요"
              rows={5}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="review-recommended">
              <input
                id="review-recommended"
                type="checkbox"
                checked={reviewForm.isRecommended}
                onChange={(e) => setReviewForm(prev => ({ ...prev, isRecommended: e.target.checked }))}
              />
              이 상품을 추천합니다
            </label>
          </div>

          <div className={styles.formActions}>
            <button type="button" onClick={() => setShowReviewForm(false)}>
              취소
            </button>
            <button type="submit" disabled={loading}>
              {loading ? '등록 중...' : '리뷰 등록'}
            </button>
          </div>
        </form>
      )}

      {/* 리뷰 목록 */}
      <div className={styles.reviewList}>
        {loading && productReviews.length === 0 ? (
          <div className={styles.loading}>리뷰를 불러오는 중...</div>
        ) : productReviews.length === 0 ? (
          <div className={styles.empty}>아직 리뷰가 없습니다. 첫 리뷰를 작성해보세요!</div>
        ) : (
          <>
            {productReviews.map((review) => (
              <div key={review.id} className={styles.reviewItem}>
                <div className={styles.reviewHeader}>
                  <div className={styles.userInfo}>
                    <span className={styles.userName}>{review.userName}</span>
                    <span className={styles.rating}>{renderStars(review.rating)}</span>
                    {review.isRecommended && (
                      <span className={styles.recommended}>추천</span>
                    )}
                    {review.verifiedPurchase && (
                      <span className={styles.verifiedPurchase}>구매 인증</span>
                    )}
                  </div>
                  <div className={styles.reviewMeta}>
                    <span className={styles.date}>
                      {formatDate(review.createdAt)}
                    </span>
                    {user?.uid === review.userId && (
                      <button 
                        className={styles.deleteButton}
                        onClick={() => handleDeleteReview(review.id)}
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </div>

                <div className={styles.reviewContent}>
                  <h4 className={styles.reviewTitle}>{review.title}</h4>
                  <p className={styles.reviewText}>{review.content}</p>
                  
                  {(review.size || review.color) && (
                    <div className={styles.productInfo}>
                      {review.size && <span>사이즈: {review.size}</span>}
                      {review.color && <span>색상: {review.color}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {hasMoreReviews && (
              <button 
                className={styles.loadMoreButton}
                onClick={() => loadMoreProductReviews(productId)}
                disabled={loading}
              >
                {loading ? '로딩 중...' : '더 보기'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
