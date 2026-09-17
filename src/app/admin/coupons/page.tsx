'use client';

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import { CouponService } from '@/shared/services/couponService';
import { Coupon, CouponStats } from '@/shared/types/coupon';

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [stats, setStats] = useState<CouponStats>({
    total: 0,
    available: 0,
    used: 0,
    expired: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: '할인금액',
    value: 0,
    minOrderAmount: 0,
    expiryDate: '',
    description: '',
    isActive: true,
    couponCode: '',
    isDirectAssign: false,
    usageLimit: 1,
    usedCount: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // 실제 Firebase에서 쿠폰 데이터 로드
      const [couponsData, statsData] = await Promise.all([
        CouponService.getAllCoupons(),
        CouponService.getCouponStats()
      ]);
      
      setCoupons(couponsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const couponData: Omit<Coupon, 'id' | 'createdAt' | 'updatedAt'> = {
        name: formData.name || '',
        type: (formData.type as '할인금액' | '할인율' | '무료배송') || '할인금액',
        value: Number(formData.value) || 0,
        minOrderAmount: Number(formData.minOrderAmount) || 0,
        expiryDate: formData.expiryDate || '',
        description: formData.description || '',
        isActive: formData.isActive ?? true,
        couponCode: formData.couponCode || '',
        isDirectAssign: formData.isDirectAssign ?? false,
        usageLimit: Number(formData.usageLimit) || 1,
        usedCount: 0
      };
      
      await CouponService.createCoupon(couponData);
      await loadData(); // 데이터 새로고침
      resetForm();
      alert('쿠폰이 생성되었습니다.');
    } catch (error) {
      console.error('Error creating coupon:', error);
      alert('쿠폰 생성에 실패했습니다.');
    }
  };

  const handleUpdateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCoupon) return;

    try {
      // undefined 값을 제거하고 updateData 생성
      const updateData: Partial<Coupon> = {};
      
      if (formData.name !== undefined && formData.name !== '') updateData.name = formData.name;
      if (formData.type !== undefined) updateData.type = formData.type as '할인금액' | '할인율' | '무료배송';
      if (formData.value !== undefined) updateData.value = Number(formData.value);
      if (formData.minOrderAmount !== undefined) updateData.minOrderAmount = Number(formData.minOrderAmount);
      if (formData.expiryDate !== undefined && formData.expiryDate !== '') updateData.expiryDate = formData.expiryDate;
      if (formData.description !== undefined) updateData.description = formData.description;
      if (formData.isActive !== undefined) updateData.isActive = formData.isActive;
      if (formData.couponCode !== undefined) updateData.couponCode = formData.couponCode;
      if (formData.isDirectAssign !== undefined) updateData.isDirectAssign = formData.isDirectAssign;
      if (formData.usageLimit !== undefined) updateData.usageLimit = Number(formData.usageLimit);
      if (formData.usedCount !== undefined) updateData.usedCount = Number(formData.usedCount);
      
      await CouponService.updateCoupon(selectedCoupon.id, updateData);
      await loadData(); // 데이터 새로고침
      resetForm();
      alert('쿠폰이 수정되었습니다.');
    } catch (error) {
      console.error('Error updating coupon:', error);
      alert('쿠폰 수정에 실패했습니다.');
    }
  };

  const handleDeleteCoupon = async (couponId: string) => {
    if (!confirm('이 쿠폰을 비활성화하시겠습니까? 이미 발급된 쿠폰 이력은 유지됩니다.')) return;

    try {
      await CouponService.deleteCoupon(couponId);
      await loadData(); // 데이터 새로고침
      alert('쿠폰이 비활성화되었습니다.');
    } catch (error) {
      console.error('Error deleting coupon:', error);
      alert('쿠폰 비활성화에 실패했습니다.');
    }
  };

  const handleToggleStatus = async (coupon: Coupon) => {
    try {
      await CouponService.updateCoupon(coupon.id, { isActive: !coupon.isActive });
      await loadData(); // 데이터 새로고침
    } catch (error) {
      console.error('Error toggling status:', error);
      alert('상태 변경에 실패했습니다.');
    }
  };

  const openEditForm = (coupon: Coupon) => {
    setSelectedCoupon(coupon);
    setFormData({
      name: coupon.name || '',
      type: coupon.type || '할인금액',
      value: coupon.value || 0,
      minOrderAmount: coupon.minOrderAmount || 0,
      expiryDate: coupon.expiryDate || '',
      description: coupon.description || '',
      isActive: coupon.isActive ?? true,
      couponCode: coupon.couponCode || '',
      isDirectAssign: coupon.isDirectAssign ?? false,
      usageLimit: coupon.usageLimit || 1,
      usedCount: coupon.usedCount || 0
    });
    setShowEditForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: '할인금액',
      value: 0,
      minOrderAmount: 0,
      expiryDate: '',
      description: '',
      isActive: true,
      couponCode: '',
      isDirectAssign: false,
      usageLimit: 1,
      usedCount: 0
    });
    setSelectedCoupon(null);
    setShowCreateForm(false);
    setShowEditForm(false);
  };

  if (loading) {
    return <div className={styles.loading}>로딩중...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>쿠폰 관리</h1>
        <button onClick={() => setShowCreateForm(true)} className={styles.createBtn}>
          새 쿠폰 생성
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* 통계 */}
      <div className={styles.stats}>
        <div className={styles.statCard}>
          <h3>전체 쿠폰</h3>
          <p>{stats.total}개</p>
        </div>
        <div className={styles.statCard}>
          <h3>사용 가능</h3>
          <p>{stats.available}개</p>
        </div>
        <div className={styles.statCard}>
          <h3>사용 완료</h3>
          <p>{stats.used}개</p>
        </div>
        <div className={styles.statCard}>
          <h3>만료</h3>
          <p>{stats.expired}개</p>
        </div>
      </div>

      {/* 쿠폰 목록 */}
      <div className={styles.couponList}>
        <div className={styles.listHeader}>
          <h3>쿠폰 목록</h3>
          <div className={styles.totalCount}>총 {coupons.length}개</div>
        </div>
        
        <div className={styles.couponGrid}>
          {coupons.map((coupon) => (
            <div key={coupon.id} className={styles.couponCard}>
              <div className={styles.cardHeader}>
                <div className={styles.couponName}>
                  <h4>{coupon.name}</h4>
                  <div className={styles.couponValue}>
                    {coupon.type === '할인율' ? `${coupon.value}%` : `${coupon.value.toLocaleString()}원`} 할인
                  </div>
                </div>
                <div className={styles.cardActions}>
                  <button data-requires-reauth="true" 
                    onClick={() => handleToggleStatus(coupon)}
                    className={coupon.isActive ? styles.active : styles.inactive}
                  >
                    {coupon.isActive ? '활성' : '비활성'}
                  </button>
                  <div className={styles.actionButtons}>
                    <button onClick={() => openEditForm(coupon)} className={styles.editBtn}>
                      수정
                    </button>
                    <button data-requires-reauth="true" onClick={() => handleDeleteCoupon(coupon.id)} className={styles.deleteBtn}>
                      비활성화
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles.cardBody}>
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>타입</span>
                    <span className={styles.infoValue}>{coupon.type}</span>
                  </div>
                  
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>최소주문</span>
                    <span className={styles.infoValue}>{(coupon.minOrderAmount || 0).toLocaleString()}원</span>
                  </div>
                  
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>만료일</span>
                    <span className={styles.infoValue}>{coupon.expiryDate}</span>
                  </div>
                  
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>사용현황</span>
                    <span className={styles.infoValue}>
                      {coupon.usedCount}/{coupon.usageLimit}
                    </span>
                  </div>
                </div>

                <div className={styles.cardFooter}>
                  <div className={styles.couponCode}>
                    {coupon.couponCode ? (
                      <span className={styles.codeChip}>
                        <span className={styles.codeLabel}>코드:</span>
                        <span className={styles.codeValue}>{coupon.couponCode}</span>
                      </span>
                    ) : (
                      <span className={styles.directAssign}>관리자 직접 할당</span>
                    )}
                  </div>
                  
                  <div className={styles.assignType}>
                    <span className={`${styles.typeChip} ${coupon.isDirectAssign ? styles.direct : styles.code}`}>
                      {coupon.isDirectAssign ? '직접 할당' : '코드 입력'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 생성 폼 모달 */}
      {showCreateForm && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h2>새 쿠폰 생성</h2>
            <form data-requires-reauth="true" onSubmit={handleCreateCoupon}>
              <div className={styles.formGroup}>
                <label>쿠폰명</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              
              <div className={styles.formGroup}>
                <label>할인 타입</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="할인금액">할인금액</option>
                  <option value="할인율">할인율</option>
                </select>
              </div>
              
              <div className={styles.formGroup}>
                <label>할인값</label>
                <input
                  type="number"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                  required
                />
              </div>
              
              <div className={styles.formGroup}>
                <label>최소 주문 금액</label>
                <input
                  type="number"
                  value={formData.minOrderAmount}
                  onChange={(e) => setFormData({ ...formData, minOrderAmount: Number(e.target.value) })}
                  required
                />
              </div>
              
              <div className={styles.formGroup}>
                <label>만료일</label>
                <input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  required
                />
              </div>
              
              <div className={styles.formGroup}>
                <label>설명</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              
              <div className={styles.formGroup}>
                <label>배포 방식</label>
                <select
                  value={formData.isDirectAssign ? 'direct' : 'code'}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    isDirectAssign: e.target.value === 'direct',
                    couponCode: e.target.value === 'direct' ? '' : formData.couponCode
                  })}
                >
                  <option value="code">쿠폰 코드 입력</option>
                  <option value="direct">관리자 직접 할당</option>
                </select>
              </div>
              
              {!formData.isDirectAssign && (
                <div className={styles.formGroup}>
                  <label>쿠폰 코드</label>
                  <input
                    type="text"
                    value={formData.couponCode}
                    onChange={(e) => setFormData({ ...formData, couponCode: e.target.value })}
                    placeholder="사용자가 입력할 쿠폰 코드"
                    required={!formData.isDirectAssign}
                  />
                  <small>사용자가 쿠폰 등록 시 입력할 코드입니다.</small>
                </div>
              )}
              
              <div className={styles.formGroup}>
                <label>사용 제한 횟수</label>
                <input
                  type="number"
                  value={formData.usageLimit}
                  onChange={(e) => setFormData({ ...formData, usageLimit: Number(e.target.value) })}
                  min="1"
                  required
                />
                <small>이 쿠폰을 총 몇 번까지 사용할 수 있는지 설정합니다.</small>
              </div>
              
              <div className={styles.formGroup}>
                <label>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  활성화
                </label>
              </div>
              
              <div className={styles.formActions}>
                <button type="button" onClick={resetForm}>취소</button>
                <button type="submit">생성</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 수정 폼 모달 */}
      {showEditForm && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h2>쿠폰 수정</h2>
            <form data-requires-reauth="true" onSubmit={handleUpdateCoupon}>
              <div className={styles.formGroup}>
                <label>쿠폰명</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              
              <div className={styles.formGroup}>
                <label>할인 타입</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="할인금액">할인금액</option>
                  <option value="할인율">할인율</option>
                </select>
              </div>
              
              <div className={styles.formGroup}>
                <label>할인값</label>
                <input
                  type="number"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                  required
                />
              </div>
              
              <div className={styles.formGroup}>
                <label>최소 주문 금액</label>
                <input
                  type="number"
                  value={formData.minOrderAmount}
                  onChange={(e) => setFormData({ ...formData, minOrderAmount: Number(e.target.value) })}
                  required
                />
              </div>
              
              <div className={styles.formGroup}>
                <label>만료일</label>
                <input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  required
                />
              </div>
              
              <div className={styles.formGroup}>
                <label>설명</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              
              <div className={styles.formGroup}>
                <label>배포 방식</label>
                <select
                  value={formData.isDirectAssign ? 'direct' : 'code'}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    isDirectAssign: e.target.value === 'direct',
                    couponCode: e.target.value === 'direct' ? '' : formData.couponCode
                  })}
                >
                  <option value="code">쿠폰 코드 입력</option>
                  <option value="direct">관리자 직접 할당</option>
                </select>
              </div>
              
              {!formData.isDirectAssign && (
                <div className={styles.formGroup}>
                  <label>쿠폰 코드</label>
                  <input
                    type="text"
                    value={formData.couponCode}
                    onChange={(e) => setFormData({ ...formData, couponCode: e.target.value })}
                    placeholder="사용자가 입력할 쿠폰 코드"
                    required={!formData.isDirectAssign}
                  />
                  <small>사용자가 쿠폰 등록 시 입력할 코드입니다.</small>
                </div>
              )}
              
              <div className={styles.formGroup}>
                <label>사용 제한 횟수</label>
                <input
                  type="number"
                  value={formData.usageLimit}
                  onChange={(e) => setFormData({ ...formData, usageLimit: Number(e.target.value) })}
                  min="1"
                  required
                />
                <small>이 쿠폰을 총 몇 번까지 사용할 수 있는지 설정합니다.</small>
              </div>
              
              <div className={styles.formGroup}>
                <label>사용된 횟수</label>
                <input
                  type="number"
                  value={formData.usedCount}
                  onChange={(e) => setFormData({ ...formData, usedCount: Number(e.target.value) })}
                  min="0"
                />
                <small>현재까지 사용된 횟수입니다.</small>
              </div>
              
              <div className={styles.formGroup}>
                <label>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  활성화
                </label>
              </div>
              
              <div className={styles.formActions}>
                <button type="button" onClick={resetForm}>취소</button>
                <button type="submit">수정</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
