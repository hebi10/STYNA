'use client';

import { ReactNode, SyntheticEvent, useEffect, useRef, useState } from 'react';
import styles from './layout.module.css';
import AdminNav from './_components/adminNav';
import AuthChecking from './_components/AuthChecking';
import DemoAdminDashboard from './_components/DemoAdminDashboard';
import AdminReauthentication from './_components/AdminReauthentication';
import { useAuth } from '@/context/authProvider';

interface AdminShellProps {
  children: ReactNode;
}

export function requiresAdminReauthentication(
  target: EventTarget | null,
  submitter: HTMLElement | null = null,
) {
  const targetElement = target instanceof HTMLElement ? target : null;
  const actionElement = submitter || targetElement;
  return Boolean(actionElement?.closest('[data-requires-reauth="true"]'));
}

export default function AdminShell({ children }: AdminShellProps) {
  const { logout, isDemoAdmin } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isReauthOpen, setIsReauthOpen] = useState(false);
  const [hasWriteAccess, setHasWriteAccess] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!hasWriteAccess) return;
    const timeoutId = window.setTimeout(() => setHasWriteAccess(false), 5 * 60 * 1000);
    return () => window.clearTimeout(timeoutId);
  }, [hasWriteAccess]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      setIsMenuOpen(false);
      menuButtonRef.current?.focus();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen]);

  const closeMenu = () => {
    setIsMenuOpen(false);
    menuButtonRef.current?.focus();
  };

  const requestWriteAccess = (event: SyntheticEvent<HTMLElement>) => {
    if (isDemoAdmin || hasWriteAccess) return;

    const submitter = event.type === 'submit'
      ? (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null
      : null;

    if (!requiresAdminReauthentication(event.target, submitter)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setIsReauthOpen(true);
  };

  return (
    <AuthChecking>
      <div className={styles.adminContainer}>
        {isMenuOpen && (
          <button
            className={styles.mobileOverlay}
            onClick={closeMenu}
            aria-label="관리자 메뉴 닫기"
            tabIndex={-1}
          />
        )}

        <aside
          id="admin-navigation"
          className={`${styles.sidebar} ${isMenuOpen ? styles.open : ''}`}
          role={isMenuOpen ? 'dialog' : undefined}
          aria-modal={isMenuOpen ? true : undefined}
          aria-label={isMenuOpen ? '관리자 메뉴' : undefined}
        >
          <div className={styles.logo}>
            <h2>Admin Panel</h2>
            <button
              ref={closeButtonRef}
              className={styles.sidebarClose}
              onClick={closeMenu}
              aria-label="관리자 메뉴 닫기"
            >
              ×
            </button>
          </div>
          {!isDemoAdmin && <AdminNav onNavigate={closeMenu} />}
        </aside>

        <div className={styles.mainContent}>
          <header className={styles.header}>
            <div className={styles.headerLeft}>
              <button
                ref={menuButtonRef}
                className={styles.menuButton}
                onClick={() => setIsMenuOpen(true)}
                aria-label="관리자 메뉴 열기"
                aria-expanded={isMenuOpen}
                aria-controls="admin-navigation"
              >
                ☰
              </button>
              <h1>{isDemoAdmin ? '관리자 데모' : '관리자 패널'}</h1>
            </div>
            <div className={styles.userInfo}>
              <span>{isDemoAdmin ? '읽기 전용 데모' : '관리자님 환영합니다'}</span>
              {!isDemoAdmin && (
                <AdminReauthentication
                  isOpen={isReauthOpen}
                  onOpenChange={setIsReauthOpen}
                  onVerified={() => setHasWriteAccess(true)}
                />
              )}
              <button className={styles.logoutBtn} onClick={logout}>로그아웃</button>
            </div>
          </header>
          <main
            className={styles.content}
            onClickCapture={requestWriteAccess}
            onSubmitCapture={requestWriteAccess}
            onChangeCapture={requestWriteAccess}
          >
            {isDemoAdmin ? <DemoAdminDashboard /> : children}
          </main>
        </div>
      </div>
    </AuthChecking>
  );
}
