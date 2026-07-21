'use client';

import { useCallback, useState, useEffect } from 'react';
import Link from 'next/link';
import { QnAService } from '@/shared/services/qnaService';
import { PublicQnA, PublicQnAFilter } from '@/shared/types/qna';
import styles from './page.module.css';

export default function QnAListPage() {
  const [qnas, setQnas] = useState<PublicQnA[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [stats, setStats] = useState<Record<string, number>>({});

  const categories = [
    { value: 'all', label: '전체' },
    { value: 'product', label: '상품문의' },
    { value: 'delivery', label: '배송문의' },
    { value: 'payment', label: '결제문의' },
    { value: 'general', label: '일반문의' },
  ];

  const loadQnAs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const filters: PublicQnAFilter = {};
      if (selectedCategory !== 'all') {
        filters.category = selectedCategory as PublicQnA['category'];
      }

      const result = await QnAService.getQnAList(filters, 1, 50);

      let filteredQnas = result.qnas;
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        filteredQnas = filteredQnas.filter(qna =>
          qna.title.toLowerCase().includes(searchLower) ||
          qna.content.toLowerCase().includes(searchLower) ||
          qna.userName.toLowerCase().includes(searchLower)
        );
      }

      setQnas(filteredQnas);
    } catch (err) {
      setError('QnA 목록을 불러오지 못했습니다.');
      console.error('Error loading QnAs:', err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedCategory]);

  const loadStats = useCallback(async () => {
    try {
      const statsData: Record<string, number> = {};
      qnas.forEach(qna => {
        statsData[qna.category] = (statsData[qna.category] || 0) + 1;
      });
      setStats(statsData);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }, [qnas]);

  useEffect(() => {
    loadQnAs();
  }, [selectedCategory, loadQnAs]);

  useEffect(() => {
    if (qnas.length > 0) {
      loadStats();
    }
  }, [qnas, loadStats]);

  const handleSearch = () => {
    loadQnAs();
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'waiting':
        return '대기';
      case 'answered':
        return '답변완료';
      case 'closed':
        return '종료';
      default:
        return status;
    }
  };

  const getCategoryLabel = (category: string) => {
    const found = categories.find(cat => cat.value === category);
    return found ? found.label : category;
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>QnA 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1 className={styles.title}>QnA</h1>
          <p className={styles.subtitle}>문의내역과 답변 현황을 확인할 수 있습니다.</p>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <h3>전체 문의</h3>
            <span className={styles.statNumber}>
              {Object.values(stats).reduce((sum, count) => sum + count, 0)}
            </span>
          </div>
          <div className={styles.statCard}>
            <h3>대기중</h3>
            <span className={`${styles.statNumber} ${styles.waiting}`}>
              {qnas.filter(q => q.status === 'waiting').length}
            </span>
          </div>
          <div className={styles.statCard}>
            <h3>답변완료</h3>
            <span className={`${styles.statNumber} ${styles.answered}`}>
              {qnas.filter(q => q.status === 'answered').length}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.filterSection}>
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="제목, 내용, 작성자 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className={styles.searchInput}
          />
          <button onClick={handleSearch} className={styles.searchButton}>
            검색
          </button>
        </div>

        <div className={styles.categoryFilter}>
          {categories.map(category => (
            <button
              key={category.value}
              onClick={() => handleCategoryChange(category.value)}
              className={`${styles.categoryButton} ${
                selectedCategory === category.value ? styles.active : ''
              }`}
            >
              {category.label}
              {category.value !== 'all' && stats[category.value] && (
                <span className={styles.categoryCount}>({stats[category.value]})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.qnaList}>
        {error && (
          <div className={styles.error}>
            <p>{error}</p>
            <button onClick={loadQnAs} className={styles.retryButton}>
              다시 시도
            </button>
          </div>
        )}

        {qnas.length === 0 && !loading && !error && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}></div>
            <h3>등록된 QnA가 없습니다</h3>
            <p>원하시는 문의가 있으면 작성해 주세요.</p>
          </div>
        )}

        {qnas.map((qna) => (
          <div key={qna.id} className={styles.qnaItem}>
            <div className={styles.qnaHeader}>
              <div className={styles.qnaInfo}>
                <span className={`${styles.category} ${styles[qna.category]}`}>
                  {getCategoryLabel(qna.category)}
                </span>
                <span className={`${styles.status} ${styles[qna.status]}`}>
                  {getStatusLabel(qna.status)}
                </span>
                {qna.isSecret && <span className={styles.secretBadge}>비밀글</span>}
              </div>
              <div className={styles.qnaStats}>
                <span className={styles.date}>{formatDate(qna.createdAt)}</span>
              </div>
            </div>

            <div className={styles.qnaContent}>
              <h3 className={styles.qnaTitle}>
                <Link href={`/qna/${qna.id}`} className={styles.titleLink}>
                  {qna.title}
                </Link>
              </h3>
              <div className={styles.qnaDetails}>
                <span className={styles.author}>작성자: {qna.userName}</span>
                {qna.productName && (
                  <span className={styles.product}>상품: {qna.productName}</span>
                )}
              </div>
              {qna.answer && (
                <div className={styles.answerPreview}>
                  <span className={styles.answerLabel}>답변완료</span>
                  <span className={styles.answerDate}>
                    {formatDate(qna.answer.answeredAt)}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.writeSection}>
        <Link href="/qna/write" className={styles.writeButton}>
          문의 작성
        </Link>
      </div>
    </div>
  );
}
