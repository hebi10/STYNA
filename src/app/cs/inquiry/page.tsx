"use client";

import { useCallback, useState, useEffect } from 'react';
import { useAuth } from '@/context/authProvider';
import { InquiryService } from '@/shared/services/inquiryService';
import { Inquiry, CreateInquiryData } from '@/shared/types/inquiry';
import styles from './page.module.css';

const CATEGORY_LABELS = {
  order: '주문/결제',
  delivery: '배송',
  exchange: '교환/반품',
  product: '상품문의',
  account: '회원정보',
  other: '기타'
} as const;

export default function InquiryPage() {
  const { user, userData, isUserDataLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'write' | 'list'>('write');
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(false);
  const [openItems, setOpenItems] = useState<string[]>([]);
  const accountEmail = typeof userData?.email === 'string' ? userData.email : '';
  const accountName = typeof userData?.name === 'string' ? userData.name : '';
  const hasAuthoritativeIdentity = userData?.status === 'active' &&
    Boolean(accountEmail.trim()) &&
    Boolean(accountName.trim());
  
  // 폼 상태
  const [formData, setFormData] = useState<CreateInquiryData>({
    category: 'order',
    title: '',
    content: ''
  });

  // 사용자 문의 내역 로드
  const loadUserInquiries = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const userInquiries = await InquiryService.getUserInquiries(user.uid);
      setInquiries(userInquiries);
    } catch (error) {
      console.error('문의 내역 로드 실패:', error);
      alert('문의 내역을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && activeTab === 'list') {
      void loadUserInquiries();
    }
  }, [user, activeTab, loadUserInquiries]);

  const toggleItem = (id: string) => {
    setOpenItems(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (isUserDataLoading) {
      alert('회원 정보를 확인하고 있습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    if (!hasAuthoritativeIdentity) {
      alert('회원 정보를 확인할 수 없습니다. 다시 로그인해주세요.');
      return;
    }

    if (!formData.category || !formData.title || !formData.content) {
      alert('모든 필드를 입력해주세요.');
      return;
    }
    
    setLoading(true);
    try {
      await InquiryService.createInquiry(
        user.uid,
        accountEmail,
        accountName,
        formData
      );
      
      alert('문의가 등록되었습니다. 빠른 시일 내에 답변드리겠습니다.');
      setFormData({ category: 'order', title: '', content: '' });
      
      // 문의 내역 탭으로 이동하고 데이터 새로고침
      setActiveTab('list');
      void loadUserInquiries();
    } catch (error) {
      console.error('문의 등록 실패:', error);
      alert('문의 등록에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getStatusText = (status: Inquiry['status']) => {
    switch (status) {
      case 'waiting':
        return '답변대기';
      case 'answered':
        return '답변완료';
      case 'closed':
        return '처리완료';
      default:
        return '알 수 없음';
    }
  };

  const getStatusClass = (status: Inquiry['status']) => {
    switch (status) {
      case 'waiting':
        return styles.statusWaiting;
      case 'answered':
        return styles.statusCompleted;
      case 'closed':
        return styles.statusCompleted;
      default:
        return '';
    }
  };

  if (!user) {
    return (
      <div className={styles.inquiryContainer}>
        <div className={styles.formNote}>
          1:1 문의를 이용하시려면 로그인이 필요합니다.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.inquiryContainer}>
      <div className={styles.tabContainer}>
        <button
          className={`${styles.tab} ${activeTab === 'write' ? styles.active : ''}`}
          onClick={() => setActiveTab('write')}
        >
          문의하기
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'list' ? styles.active : ''}`}
          onClick={() => setActiveTab('list')}
        >
          문의내역
        </button>
      </div>

      {activeTab === 'write' && (
        <div className={styles.inquiryForm}>
          <div className={styles.formNote}>
            문의하신 내용은 마이페이지에서도 확인하실 수 있으며, 답변은 영업일 기준 1-2일 내에 등록됩니다.
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label htmlFor="category" className={styles.label}>
                문의 유형 <span className={styles.required}>*</span>
              </label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className={styles.select}
                required
              >
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="title" className={styles.label}>
                제목 <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className={styles.input}
                placeholder="문의 제목을 입력해주세요"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="content" className={styles.label}>
                문의 내용 <span className={styles.required}>*</span>
              </label>
              <textarea
                id="content"
                name="content"
                value={formData.content}
                onChange={handleInputChange}
                className={styles.textarea}
                placeholder="문의 내용을 자세히 작성해주세요"
                required
              />
            </div>

            <button
              type="submit"
              className={styles.submitButton}
              disabled={
                loading ||
                isUserDataLoading ||
                !hasAuthoritativeIdentity ||
                !formData.category ||
                !formData.title ||
                !formData.content
              }
            >
              {loading ? '등록 중...' : '문의 등록'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'list' && (
        <div className={styles.inquiryList}>
          {loading ? (
            <div className={styles.noInquiries}>
              문의 내역을 불러오는 중...
            </div>
          ) : inquiries.length > 0 ? (
            inquiries.map((inquiry) => (
              <div key={inquiry.id} className={styles.inquiryItem}>
                <div
                  className={styles.inquiryHeader}
                  onClick={() => toggleItem(inquiry.id)}
                >
                  <div className={styles.inquiryTitle}>
                    <span className={styles.titleText}>{inquiry.title}</span>
                    <span className={`${styles.status} ${getStatusClass(inquiry.status)}`}>
                      {getStatusText(inquiry.status)}
                    </span>
                  </div>
                  <div className={styles.inquiryMeta}>
                    <span className={styles.category}>{CATEGORY_LABELS[inquiry.category]}</span>
                    <span>{formatDate(inquiry.createdAt)}</span>
                    <span className={`${styles.icon} ${openItems.includes(inquiry.id) ? styles.iconRotated : ''}`}>
                      ▼
                    </span>
                  </div>
                </div>
                
                {openItems.includes(inquiry.id) && (
                  <div className={styles.inquiryContent}>
                    <div className={styles.questionSection}>
                      <div className={styles.sectionTitle}>문의 내용</div>
                      <div className={styles.questionText}>{inquiry.content}</div>
                    </div>
                    
                    {inquiry.answer && (
                      <div className={styles.answerSection}>
                        <div className={styles.sectionTitle}>
                          답변 ({formatDate(inquiry.answer.answeredAt)})
                        </div>
                        <div className={styles.answerText}>{inquiry.answer.content}</div>
                        <div className={styles.answeredBy}>
                          답변자: {inquiry.answer.answeredBy}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className={styles.noInquiries}>
              등록된 문의가 없습니다.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
