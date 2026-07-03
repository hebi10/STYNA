'use client';

import { useCallback, useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter, useParams } from 'next/navigation';
import { useQnAAccessCheck } from '@/shared/hooks/useQnaQuery';
import { QnA } from '@/shared/types/qna';
import styles from './page.module.css';

export default function QnADetailPage() {
  const router = useRouter();
  const params = useParams();
  const [qna, setQna] = useState<QnA | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [secretPassword, setSecretPassword] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const { mutateAsync: checkQnAAccess } = useQnAAccessCheck();

  const qnaId = params.id as string;

  const loadQnA = useCallback(async (password?: string) => {
    try {
      setLoading(true);
      setError(null);
      setPasswordError(null);

      const result = await checkQnAAccess({ qnaId, password });

      if (!result.success || !result.qna) {
        if (result.needsPassword) {
          setShowPasswordModal(true);
          return;
        }

        setError(result.error || 'QnA 정보를 불러오지 못했습니다.');
        return;
      }

      setShowPasswordModal(false);
      setQna(result.qna);
    } catch (err) {
      console.error('Error loading QnA:', err);
      setError('QnA를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [checkQnAAccess, qnaId]);

  const handlePasswordSubmit = async () => {
    const result = await checkQnAAccess({ qnaId, password: secretPassword });
    if (!result.success || !result.qna) {
      setPasswordError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setShowPasswordModal(false);
    setQna(result.qna);
  };

  useEffect(() => {
    if (qnaId) {
      loadQnA();
    }
  }, [qnaId, loadQnA]);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getCategoryLabel = (category: string) => {
    const categoryMap: Record<string, string> = {
      product: '상품문의',
      size: '사이즈문의',
      delivery: '배송문의',
      return: '교환/반품',
      payment: '결제문의',
      general: '일반문의',
      other: '기타',
    };
    return categoryMap[category] || category;
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      waiting: '대기중',
      answered: '답변완료',
      closed: '종료',
    };
    return statusMap[status] || status;
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>QnA를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>접근 실패</h2>
          <p>{error}</p>
          <div className={styles.buttonGroup}>
            <button onClick={() => router.back()} className={styles.backButton}>
              돌아가기
            </button>
            <button onClick={() => loadQnA(secretPassword)} className={styles.retryButton}>
              다시 시도
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!qna) {
    return null;
  }

  return (
    <div className={styles.container}>
      {showPasswordModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>비밀글 확인</h3>
            </div>
            <div className={styles.modalContent}>
              <p>이 글은 비밀글입니다. 비밀번호를 입력하세요.</p>
              <input
                type="password"
                value={secretPassword}
                onChange={(e) => setSecretPassword(e.target.value)}
                placeholder="비밀번호 (4자리)"
                maxLength={4}
                className={styles.passwordInput}
                onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              />
              {passwordError && <p className={styles.passwordError}>{passwordError}</p>}
            </div>
            <div className={styles.modalActions}>
              <button onClick={() => router.back()} className={styles.cancelButton}>
                닫기
              </button>
              <button
                onClick={handlePasswordSubmit}
                className={styles.submitButton}
                disabled={!secretPassword.trim()}
              >
                조회
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.header}>
        <button onClick={() => router.back()} className={styles.backButton}>
          뒤로가기
        </button>
        <div className={styles.breadcrumb}>
          <span>QnA</span>
          <span>/</span>
          <span>{getCategoryLabel(qna.category)}</span>
        </div>
      </div>

      <div className={styles.qnaCard}>
        <div className={styles.qnaHeader}>
          <div className={styles.titleSection}>
            <h1 className={styles.title}>{qna.title}</h1>
            <div className={styles.badges}>
              <span className={`${styles.category} ${styles[qna.category]}`}>
                {getCategoryLabel(qna.category)}
              </span>
              <span className={`${styles.status} ${styles[qna.status]}`}>
                {getStatusLabel(qna.status)}
              </span>
              {qna.isSecret && <span className={styles.secretBadge}>비밀글</span>}
            </div>
          </div>
          <div className={styles.metaInfo}>
            <div className={styles.authorInfo}>
              <span className={styles.author}>작성자 {qna.userName}</span>
              <span className={styles.date}>작성일 {formatDate(qna.createdAt)}</span>
            </div>
            <div className={styles.statsInfo}>
              <span className={styles.views}>조회수 {qna.views}</span>
              {qna.productName && <span className={styles.product}>상품 {qna.productName}</span>}
            </div>
          </div>
        </div>

        <div className={styles.qnaContent}>
          <div className={styles.questionSection}>
            <h3>문의 내용</h3>
            <div className={styles.content}>
              {qna.content.split('\n').map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </div>
            {qna.images && qna.images.length > 0 && (
              <div className={styles.images}>
                {qna.images.map((imageUrl, index) => (
                  <Image
                    key={index}
                    src={imageUrl}
                    alt={`첨부 이미지 ${index + 1}`}
                    className={styles.attachedImage}
                    width={720}
                    height={540}
                    sizes="100vw"
                  />
                ))}
              </div>
            )}
          </div>

          {qna.answer && (
            <div className={styles.answerSection}>
              <div className={styles.answerHeader}>
                <h3>답변</h3>
                <div className={styles.answerMeta}>
                  <span className={styles.answeredBy}>답변자 {qna.answer.answeredBy}</span>
                  <span className={styles.answeredDate}>{formatDate(qna.answer.answeredAt)}</span>
                </div>
              </div>
              <div className={styles.answerContent}>
                {qna.answer.content.split('\n').map((line, index) => (
                  <p key={index}>{line}</p>
                ))}
              </div>
            </div>
          )}

          {!qna.answer && qna.status === 'waiting' && (
            <div className={styles.waitingAnswer}>
              <div className={styles.waitingIcon}></div>
              <h3>답변 대기</h3>
              <p>운영자가 확인 후 순차적으로 답변드릴 예정입니다.</p>
            </div>
          )}
        </div>
      </div>

      <div className={styles.actions}>
        <button onClick={() => router.push('/qna')} className={styles.listButton}>
          목록으로
        </button>
      </div>
    </div>
  );
}
