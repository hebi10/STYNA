"use client";

import { useEffect, useState } from 'react';
import { FaqContent, SiteContentService } from '@/shared/services/siteContentService';
import styles from './page.module.css';

export default function FAQPage() {
  const [faqs, setFaqs] = useState<FaqContent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [openItems, setOpenItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    SiteContentService.getFaqs()
      .then(setFaqs)
      .catch((err) => {
        console.error('FAQ 조회 실패:', err);
        setError('FAQ를 불러오지 못했습니다.');
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredFAQs = faqs.filter((faq) => {
    const keyword = searchTerm.toLowerCase();
    return (
      faq.question.toLowerCase().includes(keyword) ||
      faq.answer.toLowerCase().includes(keyword) ||
      faq.category.toLowerCase().includes(keyword)
    );
  });

  const toggleItem = (id: string) => {
    setOpenItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const categoryStats = faqs.reduce((acc, faq) => {
    acc[faq.category] = (acc[faq.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className={styles.faqContainer}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>자주 묻는 질문</h2>
        <p className={styles.pageSubtitle}>STYNA 이용 중 궁금한 점을 빠르게 확인해보세요</p>
      </div>

      <div className={styles.statsContainer}>
        <div className={styles.statItem}>
          <span className={styles.statNumber}>{faqs.length}</span>
          <span className={styles.statLabel}>전체 FAQ</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statNumber}>{Object.keys(categoryStats).length}</span>
          <span className={styles.statLabel}>카테고리</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statNumber}>{filteredFAQs.length}</span>
          <span className={styles.statLabel}>검색 결과</span>
        </div>
      </div>

      <div className={styles.searchContainer}>
        <div className={styles.searchIcon}></div>
        <input
          type="text"
          aria-label="FAQ 검색"
          placeholder="궁금한 내용을 검색해보세요..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      <div className={styles.faqList}>
        {loading && <div className={styles.noResults}>FAQ를 불러오는 중입니다.</div>}
        {error && <div className={styles.noResults}>{error}</div>}
        {!loading && !error && filteredFAQs.length > 0 && filteredFAQs.map((faq) => {
          const isOpen = openItems.includes(faq.id);
          const questionId = `faq-question-${faq.id}`;
          const answerId = `faq-answer-${faq.id}`;

          return (
            <div key={faq.id} className={styles.faqItem}>
              <button
                id={questionId}
                type="button"
                className={styles.question}
                onClick={() => toggleItem(faq.id)}
                aria-expanded={isOpen}
                aria-controls={answerId}
              >
                <div className={styles.questionText}>
                  <div className={styles.category}>{faq.category}</div>
                  {faq.question}
                </div>
                <span className={`${styles.icon} ${isOpen ? styles.iconRotated : ''}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </button>
              {isOpen && (
                <div
                  id={answerId}
                  className={styles.answer}
                  role="region"
                  aria-labelledby={questionId}
                >
                  {faq.answer}
                </div>
              )}
            </div>
          );
        })}
        {!loading && !error && filteredFAQs.length === 0 && (
          <div className={styles.noResults}>
            <div className={styles.noResultsIcon}></div>
            <h3>검색 결과가 없습니다</h3>
            <p>다른 검색어로 검색해보세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}
