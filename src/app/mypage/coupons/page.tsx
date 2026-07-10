'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';
import { useCoupon } from '@/context/couponProvider';
import { CouponFilter } from '@/shared/types/coupon';
import { summarizeAvailableCouponBenefits } from '@/shared/utils/couponBenefitSummary';
import CouponRegister from '../_components/CouponRegister';

type CouponStatusFilter = NonNullable<CouponFilter['status']>;

const STATUS_OPTIONS: CouponStatusFilter[] = ['전체', '사용가능', '사용완료', '기간만료'];

function formatCouponValue(type: string, value: number): string {
  if (type === '할인율') return `${value}% 할인`;
  if (type === '무료배송') return '무료배송';
  return `${value.toLocaleString()}원 할인`;
}

export default function CouponsPage() {
  const {
    userCoupons,
    couponStats,
    loading,
    error,
    getUserCouponsWithFilter,
    registerCouponByCode,
    getDaysUntilExpiry,
  } = useCoupon();
  const [selectedStatus, setSelectedStatus] = useState<CouponStatusFilter>('전체');

  useEffect(() => {
    void getUserCouponsWithFilter({
      status: selectedStatus === '전체' ? undefined : selectedStatus,
      sortBy: 'issuedDate',
      sortOrder: 'desc',
    });
  }, [getUserCouponsWithFilter, selectedStatus]);

  const benefitSummary = useMemo(
    () => summarizeAvailableCouponBenefits(userCoupons),
    [userCoupons],
  );

  async function handleCouponRegistration(couponCode: string): Promise<boolean> {
    if (!couponCode.trim()) return false;

    try {
      const response = await registerCouponByCode(couponCode.trim());
      if (!response.success) return false;

      await getUserCouponsWithFilter({
        status: selectedStatus === '전체' ? undefined : selectedStatus,
        sortBy: 'issuedDate',
        sortOrder: 'desc',
      });
      return true;
    } catch (registrationError) {
      console.error('쿠폰 등록 실패:', registrationError);
      return false;
    }
  }

  if (loading && userCoupons.length === 0) {
    return <div className={styles.loadingContainer}>쿠폰을 불러오는 중...</div>;
  }

  if (error) {
    return <div className={styles.errorContainer}><p className={styles.errorMessage}>{error}</p></div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>쿠폰함</h2>
        <p className={styles.pageDesc}>보유 쿠폰을 확인하고 주문서에서 적용할 수 있습니다.</p>
      </header>

      <section className={styles.statsGrid} aria-label="쿠폰 요약">
        <div className={styles.statCard}>
          <div className={styles.statContent}>
            <div className={styles.statNumber}>{couponStats?.total ?? 0}</div>
            <div className={styles.statLabel}>전체 쿠폰</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statContent}>
            <div className={styles.statNumber}>{couponStats?.available ?? 0}</div>
            <div className={styles.statLabel}>사용 가능</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statContent}>
            <div className={styles.statNumber}>{benefitSummary.valueText}</div>
            <div className={styles.statLabel}>{benefitSummary.label}</div>
            <p className={styles.benefitDescription}>{benefitSummary.description}</p>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statContent}>
            <div className={styles.statNumber}>
              {userCoupons.filter((userCoupon) => {
                const days = getDaysUntilExpiry(userCoupon.coupon.expiryDate);
                return userCoupon.status === '사용가능' && days > 0 && days <= 7;
              }).length}장
            </div>
            <div className={styles.statLabel}>7일 내 만료</div>
          </div>
        </div>
      </section>

      <section className={styles.filterSection} aria-label="쿠폰 필터">
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>쿠폰 상태</span>
          <div className={styles.filterButtons}>
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status}
                type="button"
                className={`${styles.filterButton} ${selectedStatus === status ? styles.active : ''}`}
                aria-pressed={selectedStatus === status}
                onClick={() => setSelectedStatus(status)}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </section>

      <CouponRegister onRegister={handleCouponRegistration} />

      <section className={styles.couponsSection}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>보유 쿠폰</h3>
          <span className={styles.resultCount}>총 {userCoupons.length}장</span>
        </div>

        <div className={styles.couponsList}>
          {userCoupons.length > 0 ? userCoupons.map((userCouponView) => {
            const daysUntilExpiry = getDaysUntilExpiry(userCouponView.coupon.expiryDate);
            const isExpiringSoon = userCouponView.status === '사용가능' && daysUntilExpiry > 0 && daysUntilExpiry <= 7;

            return (
              <article key={userCouponView.id} className={styles.couponCard}>
                <div className={styles.couponMain}>
                  <div className={styles.couponLeft}>
                    <div className={styles.couponInfo}>
                      <h4 className={styles.couponName}>{userCouponView.coupon.name}</h4>
                      <div className={styles.couponValue}>
                        {formatCouponValue(userCouponView.coupon.type, userCouponView.coupon.value)}
                      </div>
                      {userCouponView.coupon.minOrderAmount ? (
                        <div className={styles.minOrder}>
                          {userCouponView.coupon.minOrderAmount.toLocaleString()}원 이상 구매 시 사용 가능
                        </div>
                      ) : null}
                      {userCouponView.coupon.description ? (
                        <div className={styles.couponDescription}>{userCouponView.coupon.description}</div>
                      ) : null}
                    </div>
                  </div>

                  <div className={styles.couponRight}>
                    <span className={styles.couponStatus}>{userCouponView.status}</span>
                    <div className={styles.couponExpiry}>
                      {userCouponView.status === '사용완료' ? (
                        <span className={styles.usedDate}>사용일: {userCouponView.usedDate ?? '-'}</span>
                      ) : (
                        <>
                          <span className={styles.expiryLabel}>만료일</span>
                          <span className={styles.expiryDate}>{userCouponView.coupon.expiryDate}</span>
                          {isExpiringSoon ? <span className={styles.expiryWarning}>{daysUntilExpiry}일 후 만료</span> : null}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {userCouponView.status === '사용가능' ? (
                  <div className={styles.couponFooter}>
                    <Link href="/orders/cart" className={styles.useCouponButton}>
                      장바구니에서 쿠폰 적용하기
                    </Link>
                  </div>
                ) : null}
              </article>
            );
          }) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyTitle}>보유 쿠폰이 없습니다</div>
              <div className={styles.emptyDesc}>쿠폰 코드를 등록하거나 이벤트에 참여해 쿠폰을 받아보세요.</div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
