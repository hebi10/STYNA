"use client";

import { useEffect, useLayoutEffect } from "react";
import Link from "next/link";
import PageHeader from "../_components/PageHeader";
import styles from "./layout.module.css";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/authProvider";
import { ProfileSection, QuickActions, SidebarMenu } from "./_components";

interface MyPageLayoutProps {
  children: React.ReactNode;
}

function getStringValue(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function getNumberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getMyPageActiveTab(pathname: string): string {
  if (pathname === "/mypage" || pathname === "/mypage/") {
    return "overview";
  }

  const tabMap = {
    "/mypage/order-list": "orders",
    "/mypage/order-detail": "orders",
    "/mypage/qa": "reviews",
    "/mypage/recently-viewed": "wishlist",
    "/mypage/wishlist": "favorite",
    "/mypage/coupons": "coupons",
    "/mypage/point": "point",
    "/mypage/info-edit": "profile",
  };

  const found = Object.entries(tabMap).find(([key]) => pathname.startsWith(key));
  return found?.[1] || "";
}

export default function MyPageLayout({ children }: MyPageLayoutProps) {
  const pathname = usePathname();
  const { user, userData, logout, loading, isUserDataLoading } = useAuth();
  const isPreparingMyPage = loading || Boolean(user && isUserDataLoading);
  const isOverview = pathname === "/mypage" || pathname === "/mypage/";
  const activeTab = getMyPageActiveTab(pathname);

  // 스크롤 복원 방지 (useLayoutEffect로 더 빠르게 실행)
  useLayoutEffect(() => {
    if (typeof window !== 'undefined') {
      // 브라우저의 스크롤 복원 기능 비활성화
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'manual';
      }
      // 페이지 로드 시 스크롤을 맨 위로
      window.scrollTo(0, 0);
    }
  }, []);

  // 경로 변경 시 추가 스크롤 제어
  useEffect(() => {
    const timer = setTimeout(() => {
      window.scrollTo(0, 0);
    }, 50);

    return () => clearTimeout(timer);
  }, [pathname]);

  const header = (
    <PageHeader
      title="마이페이지"
      description="주문, 쿠폰, 관심 상품과 최근 활동을 한곳에서 관리하세요"
      breadcrumb={[
        { label: '홈', href: '/' },
        { label: '마이페이지' }
      ]}
    />
  );

  if (isPreparingMyPage) {
    return (
      <div className={styles.container}>
        {header}

        <div className={styles.content}>
          <section className={styles.loadingPanel} role="status" aria-live="polite">
            <span className={styles.loadingSpinner} aria-hidden="true" />
            <strong>마이페이지 준비 중</strong>
            <p>회원 정보와 최근 활동을 불러오고 있습니다.</p>
          </section>

          <div className={styles.loadingGrid} aria-hidden="true">
            <div className={styles.profileSkeleton}>
              <span className={styles.skeletonAvatar} />
              <div className={styles.skeletonLines}>
                <span />
                <span />
                <span />
              </div>
            </div>
            <div className={styles.quickSkeleton}>
              {Array.from({ length: 4 }).map((_, index) => (
                <span key={index} />
              ))}
            </div>
            <div className={styles.bodySkeleton}>
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.container}>
        {header}

        <div className={styles.content}>
          <section className={styles.loginRequiredPanel}>
            <h2>로그인이 필요합니다</h2>
            <p>주문, 쿠폰, 관심 상품과 최근 활동은 로그인 후 확인할 수 있습니다.</p>
            <Link href="/auth/login" className={styles.loginRequiredButton}>
              로그인 페이지로 이동
            </Link>
          </section>
        </div>
      </div>
    );
  }

  const userInfo = {
    name: getStringValue(userData?.name, "로딩중..."),
    email: getStringValue(userData?.email, "로딩중..."),
    membershipLevel: getStringValue(userData?.membershipLevel, "silver"),
    orders: getNumberValue(userData?.orders),
    reviews: getNumberValue(userData?.reviews),
    coupons: getNumberValue(userData?.coupons)
  };

  const quickActions = [
    { icon: "", title: "주문내역", desc: "주문 현황 확인", href: "/mypage/order-list" },
    { icon: "", title: "문의 관리", desc: "작성한 문의 확인", href: "/mypage/qa" },
    { icon: "", title: "쿠폰함", desc: "사용 가능한 쿠폰", href: "/mypage/coupons" },
    { icon: "", title: "회원정보", desc: "기본 정보 수정", href: "/mypage/info-edit" },
    { icon: "", title: "최근 본 상품", desc: "최근 본 상품 확인", href: "/mypage/recently-viewed" },
    { icon: "", title: "찜한 상품", desc: "관심 상품 관리", href: "/mypage/wishlist" },
    { icon: "", title: "적립금", desc: "포인트 현황 확인", href: "/mypage/point" }
  ];

  return (
    <div className={styles.container}>
      {header}
      
      <div className={styles.content}>
        {isOverview ? (
          <>
            <ProfileSection userInfo={userInfo} />
            <QuickActions actions={quickActions} />
          </>
        ) : null}

        {/* 메인 콘텐츠 */}
        <div className={styles.mainContent}>
          {/* 사이드바 */}
          <SidebarMenu activeTab={activeTab} logout={logout} />

          {/* 콘텐츠 영역 - 여기에 각 페이지의 내용이 들어감 */}
          <div className={styles.contentArea}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
