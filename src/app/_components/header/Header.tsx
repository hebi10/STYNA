"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/authProvider";
import { useCartItemCount } from "@/shared/hooks/useCart";
import {
  formatShippingPolicy,
  formatSignupBenefit,
} from "@/shared/constants/commercePolicy";
import { CategoryOrderService } from "@/shared/services/categoryOrderService";
import styles from "./Header.module.css";

interface HeaderCategory {
  id: string;
  name: string;
  href: string;
}

interface HeaderNavItem {
  label: string;
  href: string;
}

const FALLBACK_CATEGORIES: HeaderCategory[] = [{
  id: "all",
  name: "카테고리",
  href: "/categories",
}];

const SUPPORT_LINKS: HeaderNavItem[] = [
  { label: "이벤트", href: "/events" },
  { label: "리뷰", href: "/reviews" },
  { label: "1:1문의", href: "/cs/inquiry" },
  { label: "상품문의", href: "/qna" },
  { label: "도움말", href: "/cs/faq" },
];

const ANNOUNCEMENTS = [
  formatSignupBenefit(),
  formatShippingPolicy(),
  "출고 일정은 주문별 배송 상태에서 확인할 수 있습니다.",
];

const DESKTOP_BREAKPOINT_PX = 960;

function toNavLabel(category: HeaderCategory) {
  return category.name;
}

export default function Header() {
  const { user, isAdmin, logout } = useAuth();
  const { data: cartItemCount = 0 } = useCartItemCount(user?.uid || null);
  const [categories, setCategories] = useState<HeaderCategory[]>(FALLBACK_CATEGORIES);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadCategories = async () => {
      try {
        const sortedCategories = await CategoryOrderService.getSortedCategories();
        const headerCategories: HeaderCategory[] = sortedCategories.map((category) => ({
          id: category.id,
          name: category.name,
          href: `/categories/${category.id}`,
        }));

        if (isActive && headerCategories.length > 0) {
          setCategories(headerCategories);
        }
      } catch (error) {
        console.error("헤더 카테고리 로딩 실패:", error);
        if (isActive) {
          setCategories(FALLBACK_CATEGORIES);
        }
      }
    };

    loadCategories();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const mobileMenuButton = mobileMenuButtonRef.current;
    const mobileMenu = mobileMenuRef.current;
    let shouldRestoreFocus = true;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsMobileMenuOpen(false);
        return;
      }

      if (event.key !== "Tab" || !mobileMenuButton || !mobileMenu) {
        return;
      }

      const menuFocusables = Array.from(mobileMenu.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      const firstMenuControl = menuFocusables[0];
      const lastMenuControl = menuFocusables.at(-1);
      const activeElement = document.activeElement;

      if (!firstMenuControl || !lastMenuControl) {
        event.preventDefault();
        mobileMenuButton.focus();
        return;
      }

      if (activeElement === mobileMenuButton) {
        event.preventDefault();
        (event.shiftKey ? lastMenuControl : firstMenuControl).focus();
      } else if (!event.shiftKey && activeElement === lastMenuControl) {
        event.preventDefault();
        mobileMenuButton.focus();
      } else if (event.shiftKey && activeElement === firstMenuControl) {
        event.preventDefault();
        mobileMenuButton.focus();
      } else if (!mobileMenu.contains(activeElement)) {
        event.preventDefault();
        mobileMenuButton.focus();
      }
    };
    const handleResize = () => {
      if (window.innerWidth >= DESKTOP_BREAKPOINT_PX) {
        shouldRestoreFocus = false;
        mobileMenuButton?.blur();
        setIsMobileMenuOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
      document.body.style.overflow = previousOverflow;
      if (shouldRestoreFocus) {
        mobileMenuButton?.focus();
      }
    };
  }, [isMobileMenuOpen]);

  const safeCartItemCount = isMounted ? cartItemCount : 0;
  const featuredCategories = categories.slice(0, 1);
  const primaryNavItems: HeaderNavItem[] = [
    { label: "전체 상품", href: "/products" },
    { label: "신상", href: "/recommend?filter=new" },
    { label: "베스트", href: "/recommend?filter=review" },
    ...featuredCategories.map((category) => ({
      label: toNavLabel(category),
      href: category.href,
    })),
    { label: "세일", href: "/main/sale" },
    { label: "브랜드", href: "/brand" },
  ].slice(0, 6);
  const secondaryNavItems: HeaderNavItem[] = [
    { label: "추천", href: "/recommend" },
    ...SUPPORT_LINKS.filter((item) => item.href !== "/cs/faq"),
  ];

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <header
      className={`${styles.header} ${isMobileMenuOpen ? styles.headerMenuOpen : ""}`}
      role={isMobileMenuOpen ? "dialog" : undefined}
      aria-modal={isMobileMenuOpen || undefined}
      aria-label={isMobileMenuOpen ? "모바일 메뉴" : undefined}
    >
      <div
        className={styles.announcementBar}
        aria-label="쇼핑 안내"
        aria-hidden={isMobileMenuOpen || undefined}
        inert={isMobileMenuOpen}
      >
        <div className={styles.announcementViewport}>
          {ANNOUNCEMENTS.map((message, index) => (
            <span
              key={message}
              className={styles.announcementMessage}
              style={{ animationDelay: `${index * 3}s` }}
            >
              {message}
            </span>
          ))}
        </div>
      </div>
      <div className={styles.container}>
        <div className={styles.headerContent}>
          <div
            className={styles.logo}
            aria-hidden={isMobileMenuOpen || undefined}
            inert={isMobileMenuOpen}
          >
            <Link href="/" className={styles.logoLink} aria-label="STYNA home">
              <span className={styles.logoTopRow}>
                <span className={styles.logoWordmark}>STYNA</span>
              </span>
              <span className={styles.logoMeta}>스타일나우 스토어</span>
            </Link>
          </div>

          <button
            ref={mobileMenuButtonRef}
            className={styles.mobileMenuButton}
            onClick={toggleMobileMenu}
            aria-label={isMobileMenuOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-navigation"
          >
            <span
              className={`${styles.hamburgerLine} ${isMobileMenuOpen ? styles.line1Active : ""}`}
            ></span>
            <span
              className={`${styles.hamburgerLine} ${isMobileMenuOpen ? styles.line2Active : ""}`}
            ></span>
            <span
              className={`${styles.hamburgerLine} ${isMobileMenuOpen ? styles.line3Active : ""}`}
            ></span>
          </button>

          <nav
            className={styles.nav}
            aria-label="Primary"
            aria-hidden={isMobileMenuOpen || undefined}
            inert={isMobileMenuOpen}
          >
            <div className={styles.navList}>
              {primaryNavItems.map((item) => (
                <Link key={item.label} href={item.href} className={styles.navLink}>
                  {item.label}
                </Link>
              ))}
            </div>

            <div className={styles.secondaryNav} aria-label="Quick links">
              <div className={styles.secondaryNavList}>
                {secondaryNavItems.map((item) => (
                  <Link key={item.label} href={item.href} className={styles.secondaryLink}>
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </nav>

          <div
            className={styles.userMenu}
            aria-hidden={isMobileMenuOpen || undefined}
            inert={isMobileMenuOpen}
          >
            <Link href="/search" className={styles.userLink}>
              검색
            </Link>
            <Link href="/orders/cart" className={styles.userLink}>
              장바구니
              {safeCartItemCount > 0 && (
                <span className={styles.cartBadge}>{safeCartItemCount}</span>
              )}
            </Link>
            {user ? (
              <Link href="/mypage" className={styles.userLink}>
                마이페이지
              </Link>
            ) : (
              <Link href="/auth/login" className={styles.userLink}>
                로그인
              </Link>
            )}
            {isAdmin && (
              <Link href="/admin" className={styles.userLink}>
                관리자
              </Link>
            )}
          </div>
        </div>

        <div
          ref={mobileMenuRef}
          id="mobile-navigation"
          className={`${styles.mobileMenu} ${isMobileMenuOpen ? styles.mobileMenuOpen : ""}`}
          aria-hidden={!isMobileMenuOpen}
          inert={!isMobileMenuOpen}
        >
          <div className={styles.mobileMenuContent}>
            <div className={styles.mobileBrandBlock}>
              <span className={styles.mobileBrandWordmark}>STYNA</span>
              <p className={styles.mobileBrandText}>
                의류, 가방, 액세서리를 한곳에서 둘러보는 포트폴리오 쇼핑몰입니다.
              </p>
            </div>

            <div className={styles.mobileNavGroup}>
              <h3 className={styles.mobileGroupTitle}>메인 메뉴</h3>
              <div className={styles.mobileNavList}>
                {primaryNavItems.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={styles.mobileNavLink}
                    onClick={closeMobileMenu}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className={styles.mobileCategory}>
              <h3 className={styles.mobileGroupTitle}>카테고리</h3>
              <div className={styles.mobileCategoryList}>
                {categories.map((category) => (
                  <Link
                    key={category.id}
                    href={category.href}
                    className={styles.mobileCategoryItem}
                    onClick={closeMobileMenu}
                  >
                    {toNavLabel(category)}
                  </Link>
                ))}
              </div>
            </div>

            <div className={styles.mobileSupport}>
              <h3 className={styles.mobileGroupTitle}>고객지원</h3>
              <div className={styles.mobileSupportList}>
                {SUPPORT_LINKS.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={styles.mobileSupportLink}
                    onClick={closeMobileMenu}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className={styles.mobileUserMenu}>
              <Link
                href="/search"
                className={styles.mobileUserLink}
                onClick={closeMobileMenu}
              >
                검색
              </Link>
              <Link
                href="/orders/cart"
                className={styles.mobileUserLink}
                onClick={closeMobileMenu}
              >
                장바구니
                {safeCartItemCount > 0 && (
                  <span className={styles.cartBadge}>{safeCartItemCount}</span>
                )}
              </Link>
              {user ? (
                <Link
                  href="/mypage"
                  className={styles.mobileUserLink}
                  onClick={closeMobileMenu}
                >
                  마이페이지
                </Link>
              ) : (
                <Link
                  href="/auth/login"
                  className={styles.mobileUserLink}
                  onClick={closeMobileMenu}
                >
                  로그인
                </Link>
              )}
              {isAdmin && (
                <Link
                  href="/admin"
                  className={styles.mobileUserLink}
                  onClick={closeMobileMenu}
                >
                  관리자
                </Link>
              )}
              {user && (
                <button
                  className={styles.menuItem}
                  onClick={() => {
                    logout();
                    closeMobileMenu();
                  }}
                >
                  로그아웃
                </button>
              )}
            </div>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div
            className={styles.mobileMenuOverlay}
            aria-hidden="true"
            onClick={closeMobileMenu}
          ></div>
        )}
      </div>
    </header>
  );
}
