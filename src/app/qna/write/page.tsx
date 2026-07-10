'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/authProvider';
import { SimpleQnAService } from '@/shared/services/simpleQnAService';
import { CreateQnAData } from '@/shared/types/qna';
import styles from './page.module.css';

function QnAWritePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateQnAData>({
    category: searchParams.get('productId') ? 'product' : 'general',
    title: '',
    content: '',
    isSecret: false,
    isNotified: true,
    images: [],
    productId: searchParams.get('productId') || undefined,
    productName: searchParams.get('productName') || undefined,
  });

  const categories = [
    { value: 'general', label: '일반문의' },
    { value: 'product', label: '상품문의' },
    { value: 'delivery', label: '배송문의' },
    { value: 'payment', label: '결제문의' },
    { value: 'return', label: '교환/반품' },
    { value: 'other', label: '기타' },
  ];

  const handleInputChange = (
    field: keyof CreateQnAData,
    value: CreateQnAData[keyof CreateQnAData]
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('로그인이 필요합니다.');
      return;
    }

    if (!formData.title.trim()) {
      setError('제목을 입력해주세요.');
      return;
    }

    if (!formData.content.trim()) {
      setError('내용을 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const qnaId = await SimpleQnAService.createQnA(
        user.uid,
        user.email || '',
        user.displayName || user.email || '',
        formData
      );
      
      // 성공 시 mypage로 이동
      router.push(`/mypage/qa?created=${encodeURIComponent(qnaId)}`);
    } catch (err) {
      console.error('Error creating QnA:', err);
      setError('문의 등록에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className={styles.container}>
        <div className={styles.loginRequired}>
          <h2>로그인이 필요합니다</h2>
          <p>문의를 작성하려면 로그인을 해주세요.</p>
          <button 
            onClick={() => router.push('/auth/login')}
            className={styles.loginButton}
          >
            로그인하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>1:1 문의 작성</h1>
        <p className={styles.pageDesc}>궁금한 사항을 작성해주시면 빠르게 답변해드리겠습니다.</p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {error && (
          <div className={styles.errorMessage}>
            {error}
          </div>
        )}

        {/* 문의 유형 */}
        <div className={styles.field}>
          <label className={styles.label}>문의 유형 *</label>
          <select
            value={formData.category}
            onChange={(e) => handleInputChange('category', e.target.value)}
            className={styles.select}
            required
          >
            {categories.map(category => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </div>

        {/* 제목 */}
        <div className={styles.field}>
          <label className={styles.label}>제목 *</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            className={styles.input}
            placeholder="문의 제목을 입력해주세요"
            maxLength={100}
            required
          />
          <div className={styles.charCount}>
            {formData.title.length}/100
          </div>
        </div>

        {/* 내용 */}
        <div className={styles.field}>
          <label className={styles.label}>문의 내용 *</label>
          <textarea
            value={formData.content}
            onChange={(e) => handleInputChange('content', e.target.value)}
            className={styles.textarea}
            placeholder="문의 내용을 자세히 작성해주세요"
            rows={10}
            maxLength={2000}
            required
          />
          <div className={styles.charCount}>
            {formData.content.length}/2000
          </div>
        </div>

        {/* 비밀글 설정 */}
        <div className={styles.field}>
          <div className={styles.checkboxGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.isSecret}
                onChange={(e) => handleInputChange('isSecret', e.target.checked)}
                className={styles.checkbox}
              />
              <span className={styles.checkboxText}>비밀글로 작성</span>
            </label>
          </div>
          {formData.isSecret && (
            <div className={styles.fieldHelp}>
              비밀글은 작성자와 관리자만 확인할 수 있습니다.
            </div>
          )}
        </div>

        {/* 답변 알림 설정 */}
        <div className={styles.field}>
          <div className={styles.checkboxGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.isNotified}
                onChange={(e) => handleInputChange('isNotified', e.target.checked)}
                className={styles.checkbox}
              />
              <span className={styles.checkboxText}>답변 등록 시 이메일 알림 받기</span>
            </label>
          </div>
        </div>

        {/* 작성자 정보 */}
        <div className={styles.authorInfo}>
          <h3 className={styles.authorTitle}>작성자 정보</h3>
          <div className={styles.authorDetails}>
            <div className={styles.authorItem}>
              <span className={styles.authorLabel}>이름:</span>
              <span className={styles.authorValue}>{user.displayName || '사용자'}</span>
            </div>
            <div className={styles.authorItem}>
              <span className={styles.authorLabel}>이메일:</span>
              <span className={styles.authorValue}>{user.email}</span>
            </div>
          </div>
        </div>

        {/* 버튼 */}
        <div className={styles.buttonGroup}>
          <button
            type="button"
            onClick={() => router.back()}
            className={styles.cancelButton}
            disabled={loading}
          >
            취소
          </button>
          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className={styles.spinner}></span>
                등록 중...
              </>
            ) : (
              '문의 등록'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function QnAWritePage() {
  return (
    <Suspense fallback={<div className={styles.container}>문의 작성 화면을 준비하는 중입니다.</div>}>
      <QnAWritePageContent />
    </Suspense>
  );
}
