'use client';

import { useEffect, useState } from 'react';
import { Review } from '@/shared/types/review';
import Button from '@/app/_components/Button';
import { ReviewService } from '@/shared/services/reviewService';
import styles from './AdminReviewList.module.css';

export default function AdminReviewList() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [sortBy, setSortBy] = useState<'latest' | 'rating' | 'reported'>('latest');
  const [filterRating, setFilterRating] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReviews, setSelectedReviews] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadReviews = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const result = await ReviewService.getAllReviews(1, 100, undefined, 'latest');
        if (!isMounted) {
          return;
        }

        setReviews(result.reviews);
      } catch {
        if (!isMounted) {
          return;
        }

        setLoadError('리뷰 데이터를 불러오지 못했습니다. 잠시 후 다시 확인해주세요.');
        setReviews([]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadReviews();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredReviews = reviews.filter(review => {
    const matchesRating = filterRating === null || review.rating === filterRating;
    const matchesSearch = searchTerm === '' || 
      review.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.userName.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesRating && matchesSearch;
  });

  const sortedReviews = [...filteredReviews].sort((a, b) => {
    switch (sortBy) {
      case 'rating':
        return a.rating - b.rating; // 낮은 평점부터
      case 'reported':
        return a.rating - b.rating;
      case 'latest':
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedReviews(sortedReviews.map(review => review.id));
    } else {
      setSelectedReviews([]);
    }
  };

  const handleSelectReview = (reviewId: string, checked: boolean) => {
    if (checked) {
      setSelectedReviews([...selectedReviews, reviewId]);
    } else {
      setSelectedReviews(selectedReviews.filter(id => id !== reviewId));
    }
  };

  const handleDeleteReviews = () => {
    if (selectedReviews.length === 0) {
      alert('삭제할 리뷰를 선택해주세요.');
      return;
    }

    alert('리뷰 삭제는 서버 검증 API 연결 후 사용할 수 있습니다.');
  };

  const handleHideReview = (reviewId: string) => {
    void reviewId;
    alert('리뷰 숨김 처리는 서버 검증 API 연결 후 사용할 수 있습니다.');
  };

  return (
    <div className={styles.container}>
      <div className={styles.notice}>
        리뷰 목록은 Firestore 데이터를 기준으로 표시됩니다. 삭제와 숨김 처리는 서버 검증 API 연결 후
        활성화됩니다.
      </div>

      {loadError && (
        <div className={styles.errorNotice} role="alert">
          {loadError}
        </div>
      )}

      {/* 통계 정보 */}
      <div className={styles.stats}>
        <div className={styles.statItem}>
          <div className={styles.statNumber}>{reviews.length}</div>
          <div className={styles.statLabel}>전체 리뷰</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statNumber}>
            {reviews.length > 0
              ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
              : '0.0'}
          </div>
          <div className={styles.statLabel}>평균 평점</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statNumber}>
            {reviews.filter(r => r.rating <= 2).length}
          </div>
          <div className={styles.statLabel}>저평점 리뷰</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statNumber}>
            {reviews.length > 0
              ? Math.round((reviews.filter(r => r.isRecommended).length / reviews.length) * 100)
              : 0}%
          </div>
          <div className={styles.statLabel}>추천율</div>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className={styles.controls}>
        <div className={styles.searchSection}>
          <input
            type="text"
            placeholder="리뷰 제목, 내용, 작성자로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.filters}>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'latest' | 'rating' | 'reported')}
            className={styles.sortSelect}
          >
            <option value="latest">최신순</option>
            <option value="rating">평점 낮은순</option>
            <option value="reported">신고순</option>
          </select>

          <select
            value={filterRating || ''}
            onChange={(e) => setFilterRating(e.target.value ? Number(e.target.value) : null)}
            className={styles.ratingFilter}
          >
            <option value="">전체 평점</option>
            <option value="1">1점</option>
            <option value="2">2점</option>
            <option value="3">3점</option>
            <option value="4">4점</option>
            <option value="5">5점</option>
          </select>
        </div>
      </div>

      {/* 일괄 작업 */}
      <div className={styles.bulkActions}>
        <label className={styles.selectAll}>
          <input
            type="checkbox"
            checked={selectedReviews.length === sortedReviews.length && sortedReviews.length > 0}
            onChange={(e) => handleSelectAll(e.target.checked)}
          />
          전체 선택 ({selectedReviews.length}개 선택됨)
        </label>

        <div className={styles.actionButtons}>
          <Button data-requires-reauth="true"
            variant="outline"
            onClick={handleDeleteReviews}
            disabled={selectedReviews.length === 0}
          >
            선택 삭제
          </Button>
        </div>
      </div>

      {/* 리뷰 목록 */}
      {isLoading && (
        <div className={styles.emptyState}>
          <p>리뷰 데이터를 불러오는 중입니다.</p>
        </div>
      )}

      <div className={styles.reviewList}>
        {!isLoading && sortedReviews.map(review => (
          <div key={review.id} className={styles.reviewItem}>
            <div className={styles.reviewHeader}>
              <label className={styles.reviewSelect}>
                <input
                  type="checkbox"
                  checked={selectedReviews.includes(review.id)}
                  onChange={(e) => handleSelectReview(review.id, e.target.checked)}
                />
              </label>

              <div className={styles.reviewMeta}>
                <div className={styles.userInfo}>
                  <span className={styles.userName}>{review.userName}</span>
                  <div className={styles.reviewStars}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <span key={i} className={i < review.rating ? styles.filled : styles.empty}>
                        ★
                      </span>
                    ))}
                  </div>
                </div>
                <div className={styles.reviewDate}>
                  {review.createdAt.toLocaleDateString()}
                </div>
              </div>

              <div className={styles.reviewActions}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleHideReview(review.id)}
                >
                  숨김
                </Button>
              </div>
            </div>

            <div className={styles.reviewContent}>
              <h4 className={styles.reviewTitle}>{review.title}</h4>
              <p className={styles.reviewText}>{review.content}</p>
            </div>

            <div className={styles.reviewInfo}>
              <div className={styles.productInfo}>
                <span className={styles.productId}>상품 ID: {review.productId}</span>
                <span className={styles.option}>사이즈: {review.size}</span>
                <span className={styles.option}>색상: {review.color}</span>
              </div>
              
              <div className={styles.reviewStatus}>
                {review.isRecommended ? (
                  <span className={styles.recommended}>추천</span>
                ) : (
                  <span className={styles.notRecommended}>비추천</span>
                )}
                {review.rating <= 2 && (
                  <span className={styles.lowRating}>저평점</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {!isLoading && sortedReviews.length === 0 && (
        <div className={styles.emptyState}>
          <p>조건에 맞는 리뷰가 없습니다.</p>
        </div>
      )}
    </div>
  );
}
