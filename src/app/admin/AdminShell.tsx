'use client';

import { ReactNode, useEffect, useState } from 'react';
import styles from './layout.module.css';
import AdminNav from './_components/adminNav';
import AuthChecking from './_components/AuthChecking';
import DemoAdminDashboard from './_components/DemoAdminDashboard';
import AdminReauthentication from './_components/AdminReauthentication';
import { useAuth } from '@/context/authProvider';

interface AdminShellProps {
  children: ReactNode;
}

export default function AdminShell({ children }: AdminShellProps) {
  const { logout, isDemoAdmin } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isReauthOpen, setIsReauthOpen] = useState(false);
  const [hasWriteAccess, setHasWriteAccess] = useState(false);

  useEffect(() => {
    if (!hasWriteAccess) return;
    const timeoutId = window.setTimeout(() => setHasWriteAccess(false), 5 * 60 * 1000);
    return () => window.clearTimeout(timeoutId);
  }, [hasWriteAccess]);

  const requestWriteAccess = (event: React.MouseEvent<HTMLElement> | React.FormEvent<HTMLElement>) => {
    if (isDemoAdmin || hasWriteAccess) return;

    const target = event.target as HTMLElement;
    const submitter = event.type === 'submit'
      ? (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null
      : null;
    const actionElement = submitter || target.closest('button');
    if (!actionElement) return;
    const label = (actionElement.getAttribute('aria-label') || actionElement.textContent || '').trim();
    if (!/(저장|수정|삭제|등록|추가|발급|승인|취소|상태 변경|답변|활성|비활성|권한|포인트|순서)/.test(label)) {
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
            onClick={() => setIsMenuOpen(false)}
            aria-label="관리자 메뉴 닫기"
          />
        )}

        {/* 사이드바 */}
        <aside className={`${styles.sidebar} ${isMenuOpen ? styles.open : ''}`}>
          <div className={styles.logo}>
            <h2>Admin Panel</h2>
            <button
              className={styles.sidebarClose}
              onClick={() => setIsMenuOpen(false)}
              aria-label="관리자 메뉴 닫기"
            >
              ×
            </button>
          </div>
          {!isDemoAdmin && <AdminNav onNavigate={() => setIsMenuOpen(false)} />}
        </aside>

        {/* 메인 컨텐츠 */}
        <div className={styles.mainContent}>
          <header className={styles.header}>
            <div className={styles.headerLeft}>
              <button
                className={styles.menuButton}
                onClick={() => setIsMenuOpen(true)}
                aria-label="관리자 메뉴 열기"
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
          >
            {isDemoAdmin ? <DemoAdminDashboard /> : children}
          </main>
        </div>
      </div>
    </AuthChecking>
  );
}
