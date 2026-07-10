'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Event } from '@/shared/types/event';
import { Category } from '@/shared/types/category';
import { EventService } from '@/shared/services/eventService';
import { CategoryService } from '@/shared/services/categoryService';
import Button from '@/app/_components/Button';
import Input from '@/app/_components/Input';
import styles from './EventForm.module.css';

interface Props {
  event?: Event;
  isEdit?: boolean;
}

export default function EventForm({ event, isEdit = false }: Props) {
  const router = useRouter();
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const detailInputRef = useRef<HTMLInputElement>(null);
  
  // 카테고리 관련 상태
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  
  const [formData, setFormData] = useState({
    title: event?.title || '',
    description: event?.description || '',
    content: event?.content || '',
    eventType: event?.eventType || 'sale' as 'sale' | 'coupon' | 'special' | 'new',
    startDate: event?.startDate ? new Date(event.startDate).toISOString().slice(0, 16) : '',
    endDate: event?.endDate ? new Date(event.endDate).toISOString().slice(0, 16) : '',
    isActive: event?.isActive ?? true,
    discountRate: event?.discountRate || 0,
    discountAmount: event?.discountAmount || 0,
    couponCode: event?.couponCode || '',
    rewardCouponId: event?.rewardCouponId || '',
    maxParticipants: event?.maxParticipants || 0,
    hasMaxParticipants: event?.hasMaxParticipants ?? false,
    selectedCategories: event?.targetCategories || [],
    couponType: event?.couponType || (event?.couponCode ? 'manual' : 'auto') as 'auto' | 'manual',
  });

  const [images, setImages] = useState({
    bannerImage: event?.bannerImage || '',
    thumbnailImage: event?.thumbnailImage || '',
    detailImage: event?.detailImage || '',
  });

  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  // 카테고리 로드
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoadingCategories(true);
      const categoryData = await CategoryService.getCategories();
      
      // 중복 제거 (name 기준)
      const uniqueCategories = categoryData.filter((category, index, self) => 
        index === self.findIndex(c => c.name === category.name)
      );
      
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
      alert('카테고리를 불러오는 데 실패했습니다.');
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleInputChange = (field: string, value: string | number | boolean | string[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCategoryToggle = (categoryName: string) => {
    setFormData(prev => {
      const currentCategories = prev.selectedCategories;
      const isSelected = currentCategories.includes(categoryName);
      
      if (categoryName === '전체') {
        // '전체' 선택 시 다른 모든 카테고리 제거하고 '전체'만 선택
        if (isSelected) {
          return {
            ...prev,
            selectedCategories: []
          };
        } else {
          return {
            ...prev,
            selectedCategories: ['전체']
          };
        }
      } else {
        // 다른 카테고리 선택 시 '전체' 제거
        if (isSelected) {
          // 카테고리 제거
          return {
            ...prev,
            selectedCategories: currentCategories.filter(cat => cat !== categoryName)
          };
        } else {
          // 카테고리 추가 (전체 제거)
          const newCategories = currentCategories.filter(cat => cat !== '전체');
          return {
            ...prev,
            selectedCategories: [...newCategories, categoryName]
          };
        }
      }
    });
  };

  const handleImageUpload = async (file: File, type: 'banner' | 'thumbnail' | 'detail') => {
    try {
      setUploading(true);
      const imageUrl = await EventService.uploadImage(file, `events/${type}`);
      setImages(prev => ({
        ...prev,
        [`${type}Image`]: imageUrl
      }));
      alert(`${type === 'banner' ? '배너' : '썸네일'} 이미지가 업로드되었습니다.`);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('이미지 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.description || !formData.startDate || !formData.endDate) {
      alert('필수 항목을 모두 입력해주세요.');
      return;
    }

    if (!images.bannerImage || !images.thumbnailImage) {
      alert('배너 이미지와 썸네일 이미지를 모두 업로드해주세요.');
      return;
    }

    if (formData.eventType === 'coupon' && formData.couponType === 'auto' && !formData.rewardCouponId.trim()) {
      alert('자동 지급 쿠폰 이벤트에는 쿠폰 관리 문서 ID를 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      
      const eventData = {
        title: formData.title,
        description: formData.description,
        content: formData.content,
        eventType: formData.eventType as Event['eventType'],
        startDate: new Date(formData.startDate),
        endDate: new Date(formData.endDate),
        bannerImage: images.bannerImage,
        thumbnailImage: images.thumbnailImage,
        ...(images.detailImage ? { detailImage: images.detailImage } : {}),
        participantCount: event?.participantCount || 0,
        targetCategories: formData.selectedCategories.length > 0 
          ? formData.selectedCategories 
          : ['전체'],
        isActive: formData.isActive,
        discountRate: formData.discountRate,
        discountAmount: formData.discountAmount,
        couponType: formData.couponType,
        couponCode: formData.couponType === 'manual' ? formData.couponCode : '',
        rewardCouponId: formData.couponType === 'auto' ? formData.rewardCouponId.trim() : '',
        hasMaxParticipants: formData.hasMaxParticipants,
        ...(formData.hasMaxParticipants && formData.maxParticipants > 0 
          ? { maxParticipants: formData.maxParticipants } 
          : {}),
      };

      if (isEdit && event) {
        await EventService.updateEvent(event.id, eventData);
        alert('이벤트가 수정되었습니다.');
      } else {
        await EventService.createEvent(eventData);
        alert('이벤트가 생성되었습니다.');
      }
      
      router.push('/admin/events');
    } catch (error) {
      console.error('Error saving event:', error);
      alert('이벤트 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.form}>
        {/* 기본 정보 */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>기본 정보</h3>
          
          <div className={styles.formGroup}>
            <label className={styles.label}>
              이벤트 제목 <span className={styles.required}>*</span>
            </label>
            <Input
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="이벤트 제목을 입력하세요"
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              이벤트 설명 <span className={styles.required}>*</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="이벤트 설명을 입력하세요"
              className={styles.textarea}
              rows={3}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              이벤트 유형 <span className={styles.required}>*</span>
            </label>
            <select
              value={formData.eventType}
              onChange={(e) => handleInputChange('eventType', e.target.value)}
              className={styles.select}
              required
            >
              <option value="sale">세일</option>
              <option value="coupon">쿠폰</option>
              <option value="special">특별</option>
              <option value="new">신상</option>
            </select>
          </div>
        </div>

        {/* 기간 설정 */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>기간 설정</h3>
          
          <div className={styles.dateGroup}>
            <div className={styles.formGroup}>
              <label className={styles.label}>
                시작일 <span className={styles.required}>*</span>
              </label>
              <input
                type="datetime-local"
                value={formData.startDate}
                onChange={(e) => handleInputChange('startDate', e.target.value)}
                className={styles.dateInput}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                종료일 <span className={styles.required}>*</span>
              </label>
              <input
                type="datetime-local"
                value={formData.endDate}
                onChange={(e) => handleInputChange('endDate', e.target.value)}
                className={styles.dateInput}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>상세 이미지</label>
              <div className={styles.imageUpload}>
                {images.detailImage && (
                  <div className={styles.imagePreview}>
                    <Image
                      src={images.detailImage}
                      alt="상세 이미지"
                      width={300}
                      height={150}
                      className={styles.previewImage}
                    />
                  </div>
                )}
                <input
                  ref={detailInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, 'detail');
                  }}
                  className={styles.fileInput}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => detailInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? '업로드 중...' : '상세 이미지 선택'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* 혜택 설정 */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>혜택 설정</h3>
          
          <div className={styles.benefitGroup}>
            <div className={styles.formGroup}>
              <label className={styles.label}>할인율 (%)</label>
              <Input
                type="number"
                value={formData.discountRate}
                onChange={(e) => handleInputChange('discountRate', Number(e.target.value))}
                placeholder="0"
                min="0"
                max="100"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>적립금 (원)</label>
              <Input
                type="number"
                value={formData.discountAmount}
                onChange={(e) => handleInputChange('discountAmount', Number(e.target.value))}
                placeholder="0"
                min="0"
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>쿠폰 지급 방식</label>
            <div className={styles.couponTypeContainer}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="couponType"
                  value="auto"
                  checked={formData.couponType === 'auto'}
                  onChange={(e) => {
                    handleInputChange('couponType', e.target.value);
                    if (e.target.value === 'auto') {
                      handleInputChange('couponCode', '');
                    }
                  }}
                  className={styles.radio}
                />
                <span>자동 지급 (시스템에서 자동으로 쿠폰 생성)</span>
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="couponType"
                  value="manual"
                  checked={formData.couponType === 'manual'}
                  onChange={(e) => handleInputChange('couponType', e.target.value)}
                  className={styles.radio}
                />
                <span>수동 입력 (사용자가 코드 입력 필요)</span>
              </label>
            </div>
            {formData.couponType === 'manual' && (
              <div className={styles.couponCodeInput}>
                <Input
                  value={formData.couponCode}
                  onChange={(e) => handleInputChange('couponCode', e.target.value)}
                  placeholder="쿠폰 코드를 입력하세요 (예: WELCOME20)"
                />
              </div>
            )}
            {formData.couponType === 'auto' && (
              <div className={styles.couponCodeInput}>
                <Input
                  value={formData.rewardCouponId}
                  onChange={(e) => handleInputChange('rewardCouponId', e.target.value)}
                  placeholder="쿠폰 관리 문서 ID를 입력하세요"
                />
                <p className={styles.helpText}>참여 완료 시 이 쿠폰을 한 번만 자동 지급합니다.</p>
              </div>
            )}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>최대 참여자 수</label>
            <div className={styles.maxParticipantsContainer}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.hasMaxParticipants}
                  onChange={(e) => {
                    handleInputChange('hasMaxParticipants', e.target.checked);
                    if (!e.target.checked) {
                      handleInputChange('maxParticipants', 0);
                    }
                  }}
                  className={styles.checkbox}
                />
                <span>최대 참여자 수 제한</span>
              </label>
              {formData.hasMaxParticipants && (
                <Input
                  type="number"
                  value={formData.maxParticipants || ''}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    handleInputChange('maxParticipants', value > 0 ? value : 0);
                  }}
                  placeholder="최대 참여자 수를 입력하세요"
                  min="1"
                />
              )}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>대상 카테고리</label>
            <div className={styles.categoryContainer}>
              {loadingCategories ? (
                <div className={styles.selectedCategories}>카테고리를 불러오는 중...</div>
              ) : (
                <div className={styles.categoryGrid}>
                  <label className={styles.categoryItem}>
                    <input
                      type="checkbox"
                      checked={formData.selectedCategories.includes('전체')}
                      onChange={() => handleCategoryToggle('전체')}
                    />
                    <span>전체</span>
                  </label>
                  {categories.map((category) => (
                    <label key={category.id} className={styles.categoryItem}>
                      <input
                        type="checkbox"
                        checked={formData.selectedCategories.includes(category.name)}
                        onChange={() => handleCategoryToggle(category.name)}
                      />
                      <span>{category.name}</span>
                    </label>
                  ))}
                </div>
              )}
              <div className={styles.selectedCategories}>
                선택된 카테고리: {formData.selectedCategories.length > 0 
                  ? formData.selectedCategories.join(', ') 
                  : '없음'}
              </div>
            </div>
          </div>
        </div>

        {/* 이미지 업로드 */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>이미지</h3>
          
          <div className={styles.imageGroup}>
            <div className={styles.formGroup}>
              <label className={styles.label}>
                배너 이미지 <span className={styles.required}>*</span>
              </label>
              <div className={styles.imageUpload}>
                {images.bannerImage && (
                  <div className={styles.imagePreview}>
                    <Image
                      src={images.bannerImage}
                      alt="배너 이미지"
                      width={300}
                      height={150}
                      className={styles.previewImage}
                    />
                  </div>
                )}
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, 'banner');
                  }}
                  className={styles.fileInput}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => bannerInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? '업로드 중...' : '배너 이미지 선택'}
                </Button>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                썸네일 이미지 <span className={styles.required}>*</span>
              </label>
              <div className={styles.imageUpload}>
                {images.thumbnailImage && (
                  <div className={styles.imagePreview}>
                    <Image
                      src={images.thumbnailImage}
                      alt="썸네일 이미지"
                      width={200}
                      height={150}
                      className={styles.previewImage}
                    />
                  </div>
                )}
                <input
                  ref={thumbnailInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, 'thumbnail');
                  }}
                  className={styles.fileInput}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => thumbnailInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? '업로드 중...' : '썸네일 이미지 선택'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* 상세 내용 */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>상세 내용</h3>
          
          <div className={styles.formGroup}>
            <label className={styles.label}>
              이벤트 상세 내용 (HTML 가능)
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => handleInputChange('content', e.target.value)}
              placeholder="이벤트의 상세 내용을 HTML로 작성할 수 있습니다"
              className={styles.contentTextarea}
              rows={15}
            />
            <div className={styles.htmlNote}>
              HTML 태그를 사용하여 풍부한 내용을 작성할 수 있습니다.
            </div>
          </div>
        </div>

        {/* 설정 */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>설정</h3>
          
          <div className={styles.formGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => handleInputChange('isActive', e.target.checked)}
                className={styles.checkbox}
              />
              이벤트 활성화
            </label>
          </div>
        </div>

        {/* 제출 버튼 */}
        <div className={styles.actions}>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={loading}
          >
            취소
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={loading || uploading}
          >
            {loading ? '저장 중...' : isEdit ? '수정' : '생성'}
          </Button>
        </div>
      </form>
    </div>
  );
}
