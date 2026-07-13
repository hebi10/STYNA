"use client";

import Link from "next/link";
import Button from "../../_components/Button";
import Input from "../../_components/Input";
import styles from "./page.module.css";
import useInput from "@/shared/hooks/useInput";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/authProvider";

function getSafeRedirectTarget(redirect: string | null): string {
  if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//")) {
    return "/mypage";
  }

  return redirect;
}

export default function LoginPage() {
  const router = useRouter();
  const showDevelopmentLogins = process.env.NODE_ENV === "development";
  const [redirectTarget, setRedirectTarget] = useState(() => {
    if (typeof window === "undefined") {
      return "/mypage";
    }

    return getSafeRedirectTarget(new URLSearchParams(window.location.search).get("redirect"));
  });
  const [values, onChange] = useInput({
    id: '',
    password: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const { login, error, clearError, user, loading } = useAuth();
  const isTransitioning = isSubmitting || (!loading && Boolean(user));

  useEffect(() => {
    setRedirectTarget(getSafeRedirectTarget(new URLSearchParams(window.location.search).get("redirect")));
  }, []);

  const handleRememberMeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRememberMe(e.target.checked);
  };

  // 네이버 로그인 (관리자 계정)
  const handleNaverLogin = async () => {
    setIsSubmitting(true);
    clearError();

    try {
      await login("test@test.com", "testtest", false);
      window.scrollTo(0, 0);
      router.replace(redirectTarget);
    } catch (error) {
      console.error("Naver login failed:", error);
      setIsSubmitting(false);
    }
  };

  // 카카오 로그인 (일반 유저 계정)
  const handleKakaoLogin = async () => {
    setIsSubmitting(true);
    clearError();

    try {
      await login("test01@test.com", "test01test01", false);
      window.scrollTo(0, 0);
      router.replace(redirectTarget);
    } catch (error) {
      console.error("Kakao login failed:", error);
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!loading && user) {
      router.replace(redirectTarget);
    }
  }, [user, loading, router, redirectTarget]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!values.id || !values.password) {
      return;
    }

    setIsSubmitting(true);
    clearError();

    try {
      await login(values.id, values.password, rememberMe);
      window.scrollTo(0, 0);
      router.replace(redirectTarget);
    } catch (error) {
      console.error("Login failed:", error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.formWrapper}>
        {isTransitioning && (
          <div className={styles.transitionOverlay} role="status" aria-live="polite">
            <span className={styles.transitionSpinner} aria-hidden="true" />
            <strong>마이페이지 준비 중</strong>
            <p>계정 정보를 확인하고 있습니다. 잠시만 기다려주세요.</p>
          </div>
        )}

        <h2 className={styles.title}>로그인</h2>

        <form className={styles.form} onSubmit={handleSubmit}>

          {error && (
            <div className={styles.errorMessage}>
              {error}
            </div>
          )}

          <Input
            label="이메일"
            type="email"
            name="id"
            placeholder="이메일을 입력하세요"
            required
            value={values.id}
            onChange={onChange}
          />

          <Input
            label="비밀번호"
            type="password"
            name="password"
            placeholder="비밀번호를 입력하세요"
            required
            value={values.password}
            onChange={onChange}
          />

          <div className={styles.loginStatus}>
            <div className={styles.rememberMe}>
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className={styles.checkboxInput}
                checked={rememberMe}
                onChange={handleRememberMeChange}
              />
              <label htmlFor="remember-me" className={styles.checkboxLabel}>
                로그인 상태 유지
              </label>
            </div>

            <Link href="/auth/find-password" className={styles.linkText}>
              비밀번호 찾기
            </Link>
          </div>

          <Button
            type="submit"
            size="lg"
            style={{ width: '100%' }}
            disabled={isSubmitting || !values.id || !values.password}
          >
            {isSubmitting ? "로그인 중..." : "로그인"}
          </Button>
        </form>

        {showDevelopmentLogins && (
          <>
            <div className={styles.divider}>
              <span className={styles.dividerText}>개발용 빠른 로그인</span>
            </div>

            <div className={styles.socialButtons}>
              <button
                type="button"
                className={styles.socialButton}
                onClick={handleKakaoLogin}
                disabled={isSubmitting}
              >
                <span className={`${styles.socialBtn} ${styles.kakaoIcon}`}>U</span>
                {isSubmitting ? "로그인 중..." : "일반 회원 로그인"}
              </button>
              <button
                type="button"
                className={styles.socialButton}
                onClick={handleNaverLogin}
                disabled={isSubmitting}
              >
                <span className={`${styles.socialBtn} ${styles.naverIcon}`}>A</span>
                {isSubmitting ? "로그인 중..." : "관리자 로그인"}
              </button>
            </div>
          </>
        )}

        <div className={styles.link}>
          아직 계정이 없으신가요?{' '}
          <Link href="/auth/signup" className={styles.linkText}>
            회원가입
          </Link>
        </div>
      </div>
    </div>
  );
}
