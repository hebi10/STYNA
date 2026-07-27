'use client';

import React, { useEffect, useLayoutEffect } from 'react';
import { useAuth } from '@/context/authProvider';
import { useCoupon } from '@/context/couponProvider';
import { useUserActivity } from '@/context/userActivityProvider';
import { useOrderCount } from '@/shared/hooks/useOrders';
import RecentProducts from './_components/RecentProducts';
import WishlistProducts from './_components/WishlistProducts';
import Link from 'next/link';
import styles from './page.module.css';

export default function MyPage() {
  const { user } = useAuth();
  const { recentProducts, wishlistItems } = useUserActivity();
  const {
    data: orderCount,
    isLoading: isOrderCountLoading,
    isError: isOrderCountError,
  } = useOrderCount(user?.uid || null);
  const {
    couponStats,
    userCouponsReady,
    loading: isCouponLoading,
    error: couponError,
  } = useCoupon();
  const isCouponCountError = Boolean(user && !isCouponLoading && couponError);
  const isCouponCountLoading = Boolean(
    user && !isCouponCountError && (!userCouponsReady || isCouponLoading),
  );

  // 마이페이지 접속 시 스크롤을 맨 위로 이동 (useLayoutEffect로 더 빠르게)
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // 추가적인 스크롤 제어
  useEffect(() => {
    const timer = setTimeout(() => {
      window.scrollTo(0, 0);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  if (!user) {
    return (
      <div className={styles.contentArea}>
        <div className={styles.notLoggedIn}>
          <div className={styles.loginPrompt}>
            <span className={styles.promptEyebrow}>Member Access</span>
            <h2>로그인이 필요합니다</h2>
            <p>주문, 쿠폰, 찜한 상품 등 나의 쇼핑 기록을 확인하려면 로그인해주세요.</p>
            <Link href="/auth/login" className={styles.loginButton}>
              로그인하기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dashboardContainer}>
      <section className={styles.dashboardHeader}>
        <span className={styles.eyebrow}>Account Overview</span>
        <div className={styles.headerBody}>
          <h2>나의 쇼핑 현황</h2>
          <p>주문, 관심 상품, 쿠폰 현황을 한 화면에서 확인하고 최근 활동을 이어서 살펴보세요.</p>
        </div>
      </section>

      <div className={styles.statsGrid}>
        <Link href="/mypage/order-list" className={styles.statCard}>
          <span className={styles.statLabel}>주문내역</span>
          <strong className={styles.statNumber} aria-busy={isOrderCountLoading || undefined}>
            {isOrderCountError ? '확인 실패' : isOrderCountLoading ? '-' : orderCount ?? 0}
          </strong>
          <span className={styles.statDescription}>주문 현황과 상세 내역 확인</span>
        </Link>

        <Link href="/mypage/recently-viewed" className={styles.statCard}>
          <span className={styles.statLabel}>최근 본 상품</span>
          <strong className={styles.statNumber}>{recentProducts.length}</strong>
          <span className={styles.statDescription}>최근 확인한 상품 다시 보기</span>
        </Link>

        <Link href="/mypage/wishlist" className={styles.statCard}>
          <span className={styles.statLabel}>찜한 상품</span>
          <strong className={styles.statNumber}>{wishlistItems.length}</strong>
          <span className={styles.statDescription}>관심 상품과 저장 목록 확인</span>
        </Link>

        <Link href="/mypage/coupons" className={styles.statCard}>
          <span className={styles.statLabel}>보유 쿠폰</span>
          <strong className={styles.statNumber} aria-busy={isCouponCountLoading || undefined}>
            {isCouponCountError ? '확인 실패' : isCouponCountLoading ? '-' : couponStats?.available ?? 0}
          </strong>
          <span className={styles.statDescription}>사용 가능한 혜택 확인</span>
        </Link>
      </div>

      <div className={styles.recentActivity}>
        <section className={styles.activitySection}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionCopy}>
              <span className={styles.sectionEyebrow}>Recently Viewed</span>
              <h3>최근 본 상품</h3>
              <p>최근 확인한 상품을 이어서 살펴보세요.</p>
            </div>
            <Link href="/mypage/recently-viewed" className={styles.viewAllLink}>
              전체보기
            </Link>
          </div>
          <div className={styles.compactView}>
            <RecentProducts embedded limit={4} />
          </div>
        </section>
        
        <section className={styles.activitySection}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionCopy}>
              <span className={styles.sectionEyebrow}>Wishlist</span>
              <h3>찜한 상품</h3>
              <p>관심 있는 상품을 정리해두고 비교해보세요.</p>
            </div>
            <Link href="/mypage/wishlist" className={styles.viewAllLink}>
              전체보기
            </Link>
          </div>
          <div className={styles.compactView}>
            <WishlistProducts embedded limit={4} />
          </div>
        </section>
      </div>
    </div>
  );
}
