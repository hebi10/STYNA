"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/authProvider";
import { useCartItemCount } from "@/shared/hooks/useCart";
import {
  formatShippingPolicy,
  formatSignupBenefit,
} from "@/shared/constants/commercePolicy";
import { CategoryOrderService } from "@/shared/services/categoryOrderService";
import {
  buildHeaderNavGroups,
  getHeaderNavHref,
  type HeaderCategory,
  type HeaderNavDisclosure,
  type HeaderNavGroup,
} from "./navigation";
import styles from "./Header.module.css";

const FALLBACK_CATEGORIES: HeaderCategory[] = [];

const ANNOUNCEMENTS = [
  formatSignupBenefit(),
  formatShippingPolicy(),
  "출고 일정은 주문별 배송 상태에서 확인할 수 있습니다.",
];

const DESKTOP_BREAKPOINT_PX = 960;

export default function Header() {
  const pathname = usePathname();
  const { user, isAdmin, logout } = useAuth();
  const { data: cartItemCount = 0 } = useCartItemCount(user?.uid || null);
  const [categories, setCategories] = useState<HeaderCategory[]>(FALLBACK_CATEGORIES);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openDesktopGroup, setOpenDesktopGroup] = useState<HeaderNavGroup["id"] | null>(null);
  const [openMobileGroup, setOpenMobileGroup] = useState<HeaderNavGroup["id"] | null>(null);
  const [openDesktopDisclosure, setOpenDesktopDisclosure] = useState<HeaderNavDisclosure["id"] | null>(null);
  const [openMobileDisclosure, setOpenMobileDisclosure] = useState<HeaderNavDisclosure["id"] | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const previousPathnameRef = useRef(pathname);
  const desktopTriggerRefs = useRef<Partial<Record<HeaderNavGroup["id"], HTMLButtonElement | null>>>({});
  const desktopDisclosureTriggerRefs = useRef<
    Partial<Record<HeaderNavDisclosure["id"], HTMLButtonElement | null>>
  >({});

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (previousPathnameRef.current === pathname) return;

    previousPathnameRef.current = pathname;
    setOpenDesktopGroup(null);
    setOpenDesktopDisclosure(null);
    setIsMobileMenuOpen(false);
    setOpenMobileGroup(null);
    setOpenMobileDisclosure(null);
  }, [pathname]);

  useEffect(() => {
    let isActive = true;

    const loadCategories = async () => {
      try {
        const sortedCategories = await CategoryOrderService.getSortedCategories();
        const headerCategories = sortedCategories.map((category) => ({
          id: category.id,
          name: category.name,
          href: `/categories/${category.id}`,
        }));

        if (isActive && headerCategories.length > 0) {
          setCategories(headerCategories);
        }
      } catch (error) {
        console.error("헤더 카테고리 로딩 실패:", error);
        if (isActive) setCategories(FALLBACK_CATEGORIES);
      }
    };

    loadCategories();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!openDesktopGroup) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      event.preventDefault();
      if (openDesktopDisclosure) {
        const disclosureTrigger = desktopDisclosureTriggerRefs.current[openDesktopDisclosure];
        setOpenDesktopDisclosure(null);
        disclosureTrigger?.focus();
        return;
      }

      const trigger = desktopTriggerRefs.current[openDesktopGroup];
      setOpenDesktopGroup(null);
      trigger?.focus();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [openDesktopDisclosure, openDesktopGroup]);

  useEffect(() => {
    const handleResponsiveResize = () => {
      if (window.innerWidth < DESKTOP_BREAKPOINT_PX) {
        setOpenDesktopGroup(null);
        setOpenDesktopDisclosure(null);
        return;
      }

      setOpenMobileGroup(null);
      setOpenMobileDisclosure(null);
    };

    window.addEventListener("resize", handleResponsiveResize);
    return () => window.removeEventListener("resize", handleResponsiveResize);
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const pageSurfaceStates = Array.from(
      document.querySelectorAll<HTMLElement>(
        'main, footer, [data-testid="chat-widget"], [data-testid="site-guide-manager"]',
      ),
    ).map((element) => ({
      element,
      ariaHidden: element.getAttribute("aria-hidden"),
      inert: element.getAttribute("inert"),
    }));
    const mobileMenuButton = mobileMenuButtonRef.current;
    const mobileMenu = mobileMenuRef.current;
    let shouldRestoreFocus = true;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsMobileMenuOpen(false);
        setOpenMobileGroup(null);
        setOpenMobileDisclosure(null);
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
        setOpenMobileGroup(null);
        setOpenMobileDisclosure(null);
      }
    };

    document.body.style.overflow = "hidden";
    pageSurfaceStates.forEach(({ element }) => {
      element.setAttribute("aria-hidden", "true");
      element.setAttribute("inert", "");
    });
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
      document.body.style.overflow = previousOverflow;
      pageSurfaceStates.forEach(({ element, ariaHidden, inert }) => {
        if (ariaHidden === null) {
          element.removeAttribute("aria-hidden");
        } else {
          element.setAttribute("aria-hidden", ariaHidden);
        }

        if (inert === null) {
          element.removeAttribute("inert");
        } else {
          element.setAttribute("inert", inert);
        }
      });
      if (shouldRestoreFocus) {
        mobileMenuButton?.focus();
      }
    };
  }, [isMobileMenuOpen]);

  const navGroups = buildHeaderNavGroups(categories);
  const safeCartItemCount = isMounted ? cartItemCount : 0;

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((isOpen) => !isOpen);
    setOpenDesktopGroup(null);
    setOpenMobileGroup(null);
    setOpenDesktopDisclosure(null);
    setOpenMobileDisclosure(null);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
    setOpenMobileGroup(null);
    setOpenMobileDisclosure(null);
  };

  const closeDesktopNavigation = () => {
    setOpenDesktopGroup(null);
    setOpenDesktopDisclosure(null);
  };

  const toggleDesktopGroup = (groupId: HeaderNavGroup["id"]) => {
    setOpenDesktopDisclosure(null);
    setOpenDesktopGroup((current) => current === groupId ? null : groupId);
  };

  const toggleMobileGroup = (groupId: HeaderNavGroup["id"]) => {
    setOpenMobileDisclosure(null);
    setOpenMobileGroup((current) => current === groupId ? null : groupId);
  };

  const toggleDesktopDisclosure = (disclosureId: HeaderNavDisclosure["id"]) => {
    setOpenDesktopDisclosure((current) => current === disclosureId ? null : disclosureId);
  };

  const toggleMobileDisclosure = (disclosureId: HeaderNavDisclosure["id"]) => {
    setOpenMobileDisclosure((current) => current === disclosureId ? null : disclosureId);
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
            <Link
              href="/"
              className={styles.logoLink}
              aria-label="STYNA home"
              onClick={closeDesktopNavigation}
            >
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
            <span className={`${styles.hamburgerLine} ${isMobileMenuOpen ? styles.line1Active : ""}`}></span>
            <span className={`${styles.hamburgerLine} ${isMobileMenuOpen ? styles.line2Active : ""}`}></span>
            <span className={`${styles.hamburgerLine} ${isMobileMenuOpen ? styles.line3Active : ""}`}></span>
          </button>

          <nav
            className={styles.nav}
            aria-label="Primary"
            aria-hidden={isMobileMenuOpen || undefined}
            inert={isMobileMenuOpen}
          >
            <div className={styles.navList}>
              {navGroups.map((group) => {
                if (group.items.length > 0) {
                  return (
                    <div className={styles.desktopNavGroup} key={group.id}>
                  <button
                    ref={(element) => { desktopTriggerRefs.current[group.id] = element; }}
                    type="button"
                    className={`${styles.navTrigger} ${openDesktopGroup === group.id ? styles.navTriggerOpen : ""}`}
                    aria-label={`${group.label} 메뉴 ${openDesktopGroup === group.id ? "닫기" : "열기"}`}
                    aria-expanded={openDesktopGroup === group.id}
                    aria-controls={`desktop-nav-${group.id}`}
                    onClick={() => toggleDesktopGroup(group.id)}
                  >
                    {group.label}
                  </button>
                  {openDesktopGroup === group.id && (
                    <div id={`desktop-nav-${group.id}`} className={styles.desktopDropdown}>
                      {group.items.map((item) => {
                        if ("items" in item) {
                          return (
                            <div className={styles.dropdownDisclosure} key={item.id}>
                              <button
                                ref={(element) => {
                                  desktopDisclosureTriggerRefs.current[item.id] = element;
                                }}
                                type="button"
                                className={`${styles.dropdownTrigger} ${
                                  openDesktopDisclosure === item.id
                                    ? styles.dropdownTriggerOpen
                                    : ""
                                }`}
                                aria-label={`${item.label} 하위 메뉴 ${
                                  openDesktopDisclosure === item.id ? "닫기" : "열기"
                                }`}
                                aria-expanded={openDesktopDisclosure === item.id}
                                aria-controls={`desktop-nav-${group.id}-${item.id}`}
                                onClick={() => toggleDesktopDisclosure(item.id)}
                              >
                                {item.label}
                              </button>
                              {openDesktopDisclosure === item.id && (
                                <div
                                  id={`desktop-nav-${group.id}-${item.id}`}
                                  className={styles.desktopNestedDisclosure}
                                >
                                  {item.items.map((nestedItem) => (
                                    <Link
                                      key={nestedItem.href}
                                      href={nestedItem.href}
                                      className={styles.dropdownLink}
                                      onClick={closeDesktopNavigation}
                                    >
                                      {nestedItem.label}
                                    </Link>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        }

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={styles.dropdownLink}
                            onClick={closeDesktopNavigation}
                          >
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                    </div>
                  );
                }

                const href = getHeaderNavHref(group);
                return href ? (
                  <Link
                    key={group.id}
                    href={href}
                    className={styles.navLink}
                    onClick={closeDesktopNavigation}
                  >
                    {group.label}
                  </Link>
                ) : null;
              })}
            </div>
          </nav>

          <div
            className={styles.userMenu}
            aria-hidden={isMobileMenuOpen || undefined}
            inert={isMobileMenuOpen}
          >
            <Link href="/search" className={styles.userLink} onClick={closeDesktopNavigation}>검색</Link>
            <Link href="/orders/cart" className={styles.userLink} onClick={closeDesktopNavigation}>
              장바구니
              {safeCartItemCount > 0 && <span className={styles.cartBadge}>{safeCartItemCount}</span>}
            </Link>
            {user ? (
              <Link href="/mypage" className={styles.userLink} onClick={closeDesktopNavigation}>마이페이지</Link>
            ) : (
              <Link href="/auth/login" className={styles.userLink} onClick={closeDesktopNavigation}>로그인</Link>
            )}
            {isAdmin && (
              <Link href="/admin" className={styles.userLink} onClick={closeDesktopNavigation}>
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
            <nav className={styles.mobileNavList} aria-label="모바일 주요 메뉴">
              {navGroups.map((group) => {
                if (group.items.length > 0) {
                  return (
                    <div className={styles.mobileNavGroup} key={group.id}>
                  <button
                    type="button"
                    className={`${styles.mobileNavTrigger} ${openMobileGroup === group.id ? styles.mobileNavTriggerOpen : ""}`}
                    aria-label={`${group.label} 메뉴 ${openMobileGroup === group.id ? "닫기" : "열기"}`}
                    aria-expanded={openMobileGroup === group.id}
                    aria-controls={`mobile-nav-${group.id}`}
                    onClick={() => toggleMobileGroup(group.id)}
                  >
                    {group.label}
                  </button>
                  {openMobileGroup === group.id && (
                    <div id={`mobile-nav-${group.id}`} className={styles.mobileDisclosureList}>
                      {group.items.map((item) => {
                        if ("items" in item) {
                          return (
                            <div className={styles.mobileNestedGroup} key={item.id}>
                              <button
                                type="button"
                                className={`${styles.mobileNavTrigger} ${
                                  openMobileDisclosure === item.id
                                    ? styles.mobileNavTriggerOpen
                                    : ""
                                }`}
                                aria-label={`${item.label} 하위 메뉴 ${
                                  openMobileDisclosure === item.id ? "닫기" : "열기"
                                }`}
                                aria-expanded={openMobileDisclosure === item.id}
                                aria-controls={`mobile-nav-${group.id}-${item.id}`}
                                onClick={() => toggleMobileDisclosure(item.id)}
                              >
                                {item.label}
                              </button>
                              {openMobileDisclosure === item.id && (
                                <div
                                  id={`mobile-nav-${group.id}-${item.id}`}
                                  className={styles.mobileNestedDisclosure}
                                >
                                  {item.items.map((nestedItem) => (
                                    <Link
                                      key={nestedItem.href}
                                      href={nestedItem.href}
                                      className={styles.mobileNavLink}
                                      onClick={closeMobileMenu}
                                    >
                                      {nestedItem.label}
                                    </Link>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        }

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={styles.mobileNavLink}
                            onClick={closeMobileMenu}
                          >
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                    </div>
                  );
                }

                const href = getHeaderNavHref(group);
                return href ? (
                  <Link key={group.id} href={href} className={styles.mobileNavLink} onClick={closeMobileMenu}>
                    {group.label}
                  </Link>
                ) : null;
              })}
            </nav>

            <div className={styles.mobileUserMenu}>
              <Link href="/search" className={styles.mobileUserLink} onClick={closeMobileMenu}>검색</Link>
              <Link href="/orders/cart" className={styles.mobileUserLink} onClick={closeMobileMenu}>
                장바구니
                {safeCartItemCount > 0 && <span className={styles.cartBadge}>{safeCartItemCount}</span>}
              </Link>
              {user ? (
                <Link href="/mypage" className={styles.mobileUserLink} onClick={closeMobileMenu}>마이페이지</Link>
              ) : (
                <Link href="/auth/login" className={styles.mobileUserLink} onClick={closeMobileMenu}>로그인</Link>
              )}
              {isAdmin && <Link href="/admin" className={styles.mobileUserLink} onClick={closeMobileMenu}>관리자</Link>}
              {user && (
                <button className={styles.menuItem} onClick={() => { logout(); closeMobileMenu(); }}>
                  로그아웃
                </button>
              )}
            </div>
          </div>
        </div>

        {isMobileMenuOpen && <div className={styles.mobileMenuOverlay} aria-hidden="true" onClick={closeMobileMenu}></div>}
      </div>
    </header>
  );
}
