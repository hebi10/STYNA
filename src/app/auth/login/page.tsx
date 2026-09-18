"use client";

import Link from "next/link";
import Button from "../../_components/Button";
import Input from "../../_components/Input";
import styles from "./page.module.css";
import useInput from "@/shared/hooks/useInput";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/authProvider";
import { getSafeRedirectTarget } from "@/shared/utils/safeRedirect";

type DemoLoginRole = "user" | "admin";

export default function LoginPage() {
  const router = useRouter();
  const showDemoLogins =
    process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "true";
  const [redirectTarget, setRedirectTarget] = useState(() => {
    if (typeof window === "undefined") {
      return "/mypage";
    }

    return getSafeRedirectTarget(
      new URLSearchParams(window.location.search).get("redirect"),
      window.location.origin,
    );
  });
  const postLoginTargetRef = useRef(redirectTarget);
  const [values, onChange] = useInput({
    id: "",
    password: "",
  });
  const [isCredentialSubmitting, setIsCredentialSubmitting] = useState(false);
  const [activeDemoRole, setActiveDemoRole] = useState<DemoLoginRole | null>(null);
  const [rememberMe, setRememberMe] = useState(false);

  const { login, loginDemo, error, clearError, user, loading } = useAuth();
  const isSubmitting = isCredentialSubmitting || activeDemoRole !== null;
  const isTransitioning = isSubmitting || (!loading && Boolean(user));

  const transitionTitle = activeDemoRole === "admin"
    ? "관리자 체험 준비 중"
    : activeDemoRole === "user"
      ? "사용자 체험 준비 중"
      : "로그인 확인 중";
  const transitionDescription = activeDemoRole === "admin"
    ? "조회 전용 관리자 화면을 준비하고 있습니다. 잠시만 기다려주세요."
    : activeDemoRole === "user"
      ? "쇼핑 흐름을 체험할 계정을 준비하고 있습니다. 잠시만 기다려주세요."
      : "계정 정보를 확인하고 있습니다. 잠시만 기다려주세요.";

  useEffect(() => {
    const safeTarget = getSafeRedirectTarget(
      new URLSearchParams(window.location.search).get("redirect"),
      window.location.origin,
    );
    setRedirectTarget(safeTarget);
    postLoginTargetRef.current = safeTarget;
  }, []);

  const handleRememberMeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRememberMe(e.target.checked);
  };

  const handleDemoLogin = async (role: DemoLoginRole) => {
    const target = role === "admin" ? "/admin" : redirectTarget;

    setActiveDemoRole(role);
    postLoginTargetRef.current = target;
    clearError();

    try {
      await loginDemo(role);
      window.scrollTo(0, 0);
      router.replace(target);
    } catch (error) {
      console.error("Demo " + role + " login failed:", error);
      setActiveDemoRole(null);
    }
  };

  useEffect(() => {
    if (!loading && user) {
      router.replace(postLoginTargetRef.current);
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!values.id || !values.password) {
      return;
    }

    setIsCredentialSubmitting(true);
    postLoginTargetRef.current = redirectTarget;
    clearError();

    try {
      await login(values.id, values.password, rememberMe);
      window.scrollTo(0, 0);
      router.replace(redirectTarget);
    } catch (error) {
      console.error("Login failed:", error);
      setIsCredentialSubmitting(false);
    }
  };

  return (
    <main className={styles.page} data-auth-page="login">
      {isTransitioning && (
        <div className={styles.transitionOverlay} role="status" aria-live="polite">
          <span className={styles.transitionSpinner} aria-hidden="true" />
          <strong>{transitionTitle}</strong>
          <p>{transitionDescription}</p>
        </div>
      )}

      <section className={styles.authLayout} aria-labelledby="login-title">
        <div className={styles.brandPanel}>
          <div>
            <p className={styles.eyebrow}>STYNA / PORTFOLIO PROJECT</p>
            <h1 className={styles.heroTitle}>
              쇼핑 경험부터
              <br />
              운영 구조까지.
            </h1>
            <p className={styles.heroDescription}>
              상품 탐색, 장바구니, 주문 흐름과 관리자 운영 구조를 직접 확인할 수
              있는 포트폴리오용 패션 커머스 프로젝트입니다.
            </p>
          </div>

          <ul className={styles.featureList} aria-label="포트폴리오 핵심 영역">
            <li>
              <span className={styles.featureIndex}>01</span>
              <div>
                <strong>SHOPPING</strong>
                <p>상품 탐색 · 장바구니 · 주문 흐름</p>
              </div>
            </li>
            <li>
              <span className={styles.featureIndex}>02</span>
              <div>
                <strong>ORDER</strong>
                <p>체크아웃 · 주문내역 · 상태 확인</p>
              </div>
            </li>
            <li>
              <span className={styles.featureIndex}>03</span>
              <div>
                <strong>ADMIN</strong>
                <p>관리자 화면 · 운영 구조 확인</p>
              </div>
            </li>
          </ul>
        </div>

        <div className={styles.formPanel}>
          <div className={styles.formInner}>
            <header className={styles.formHeader}>
              <p className={styles.formEyebrow}>LOGIN</p>
              <h2 id="login-title" className={styles.formTitle}>
                계정으로 로그인
              </h2>
              <p className={styles.formDescription}>
                기존 계정으로 로그인하거나 체험 모드로 서비스를 바로 둘러볼 수
                있습니다.
              </p>
            </header>

            <form className={styles.form} onSubmit={handleSubmit}>
              {error && (
                <div className={styles.errorMessage} role="alert">
                  {error}
                </div>
              )}

              <Input
                label="이메일"
                type="email"
                name="id"
                className={styles.loginInput}
                placeholder="이메일을 입력하세요"
                required
                value={values.id}
                onChange={onChange}
              />

              <Input
                label="비밀번호"
                type="password"
                name="password"
                className={styles.loginInput}
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
                className={styles.loginButton}
                disabled={isSubmitting || !values.id || !values.password}
              >
                {isCredentialSubmitting ? "로그인 중..." : "로그인"}
              </Button>
            </form>

            {showDemoLogins && (
              <section
                id="portfolio-demo-login"
                className={styles.demoPanel}
                aria-labelledby="demo-login-title"
              >
                <div className={styles.demoHeader}>
                  <p className={styles.demoEyebrow}>PORTFOLIO DEMO</p>
                  <h3 id="demo-login-title" className={styles.demoTitle}>
                    체험 모드로 바로 둘러보기
                  </h3>
                  <p className={styles.demoDescription}>
                    별도 계정 입력 없이 일반 쇼핑 흐름과 관리자 화면을 확인할 수
                    있습니다.
                  </p>
                </div>

                <div className={styles.demoActions}>
                  <button
                    type="button"
                    className={styles.demoButton}
                    onClick={() => handleDemoLogin("user")}
                    disabled={isSubmitting}
                    aria-label="일반 사용자 체험"
                    aria-busy={activeDemoRole === "user"}
                  >
                    <span className={styles.demoIndex}>01</span>
                    <span className={styles.demoButtonContent}>
                      <strong>
                        {activeDemoRole === "user"
                          ? "사용자 체험 준비 중..."
                          : "일반 사용자 체험"}
                      </strong>
                      <span>상품 탐색 · 장바구니 · 주문 흐름</span>
                    </span>
                    <span className={styles.demoArrow} aria-hidden="true">
                      →
                    </span>
                  </button>

                  <button
                    type="button"
                    className={styles.demoButton}
                    onClick={() => handleDemoLogin("admin")}
                    disabled={isSubmitting}
                    aria-label="관리자 페이지 체험"
                    aria-busy={activeDemoRole === "admin"}
                  >
                    <span className={styles.demoIndex}>02</span>
                    <span className={styles.demoButtonContent}>
                      <strong>
                        {activeDemoRole === "admin"
                          ? "관리자 체험 준비 중..."
                          : "관리자 페이지 체험"}
                      </strong>
                      <span>조회 전용 · 운영 데이터 변경 없음</span>
                    </span>
                    <span className={styles.demoArrow} aria-hidden="true">
                      →
                    </span>
                  </button>
                </div>

                <p className={styles.demoPolicy}>
                  관리자 체험은 조회 전용입니다. 실제 결제 및 운영 데이터 변경은
                  진행되지 않습니다.
                </p>
              </section>
            )}

            <div className={styles.link}>
              아직 계정이 없으신가요?{" "}
              <Link href="/auth/signup" className={styles.linkText}>
                회원가입
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
