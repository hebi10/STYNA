"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import useInputs from "@/shared/hooks/useInput";
import { setDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/shared/libs/firebase/firebase";
import { useAuth } from "@/context/authProvider";
import { buildDemoDataNotice, formatSignupBenefit } from "@/shared/constants/commercePolicy";
import PointService from "@/shared/services/pointService";
import { buildSignupUserDocument } from "./signupUserDocument";

const SIGNUP_ERROR_CONTROL_IDS: Record<string, string> = {
  email: "signup-email",
  password: "signup-password",
  confirmPassword: "signup-confirm-password",
  name: "signup-name",
  phone: "signup-phone",
  birth: "signup-birth-year",
  gender: "signup-gender-male",
  terms: "signup-terms-agree",
  privacy: "signup-privacy-agree",
};

export default function SignupPage() {
  const router = useRouter();
  const { signUp, error, clearError } = useAuth();
  const [formData, onChange] = useInputs({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
    phone: "",
    birthYear: "",
    birthMonth: "",
    birthDay: "",
    gender: "",
    termsAgree: false,
    privacyAgree: false,
    marketingAgree: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signupCompleted, setSignupCompleted] = useState(false);
  const [bonusSyncFailed, setBonusSyncFailed] = useState(false);

  const focusFirstError = (fieldErrors: Record<string, string>) => {
    const firstErrorKey = Object.keys(SIGNUP_ERROR_CONTROL_IDS).find(
      (key) => fieldErrors[key]
    );

    if (!firstErrorKey) {
      return;
    }

    window.requestAnimationFrame(() => {
      document.getElementById(SIGNUP_ERROR_CONTROL_IDS[firstErrorKey])?.focus();
    });
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // 이메일 검증
    if (!formData.email) {
      newErrors.email = "이메일을 입력해주세요.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "올바른 이메일 형식을 입력해주세요.";
    }

    // 비밀번호 검증
    if (!formData.password) {
      newErrors.password = "비밀번호를 입력해주세요.";
    } else if (formData.password.length < 8) {
      newErrors.password = "비밀번호는 8자 이상이어야 합니다.";
    }

    // 비밀번호 확인
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "비밀번호 확인을 입력해주세요.";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "비밀번호가 일치하지 않습니다.";
    }

    // 이름 검증
    if (!formData.name) {
      newErrors.name = "이름을 입력해주세요.";
    }

    // 전화번호 검증
    if (!formData.phone) {
      newErrors.phone = "전화번호를 입력해주세요.";
    } else if (!/^01[0-9]-?[0-9]{4}-?[0-9]{4}$/.test(formData.phone)) {
      newErrors.phone = "올바른 전화번호 형식을 입력해주세요.";
    }

    // 생년월일 검증
    if (!formData.birthYear || !formData.birthMonth || !formData.birthDay) {
      newErrors.birth = "생년월일을 모두 선택해주세요.";
    }

    // 성별 검증
    if (!formData.gender) {
      newErrors.gender = "성별을 선택해주세요.";
    }

    // 필수 안내 확인 검증
    if (!formData.termsAgree) {
      newErrors.terms = "포트폴리오 데모 이용 안내를 확인해주세요.";
    }

    if (!formData.privacyAgree) {
      newErrors.privacy = "개인정보 안내를 확인해주세요.";
    }

    setErrors(newErrors);
    focusFirstError(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (signupCompleted) {
      return;
    }
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    clearError(); // 기존 에러 클리어

    try {
      // Auth 생성과 사용자 프로필 생성을 하나의 프로비저닝 흐름으로 처리
      await signUp(
        formData.email,
        formData.password,
        async (user) => {
          await setDoc(
            doc(db, "users", user.uid),
            buildSignupUserDocument(user.uid, formData, serverTimestamp())
          );
        }
      );

      setSignupCompleted(true);

      try {
        await PointService.addSignupPoint();
      } catch (pointError) {
        console.error("회원가입 보너스 포인트 동기화 실패:", pointError);
        setBonusSyncFailed(true);
        return;
      }

      alert("회원가입과 5,000P 지급이 완료되었습니다!");
      router.push("/mypage");
    } catch (error) {
      console.error("Signup failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBonusRetry = async () => {
    setIsSubmitting(true);

    try {
      await PointService.addSignupPoint();
      setBonusSyncFailed(false);
      alert("회원가입과 5,000P 지급이 완료되었습니다!");
      router.push("/mypage");
    } catch (pointError) {
      console.error("회원가입 보너스 포인트 재동기화 실패:", pointError);
      setBonusSyncFailed(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 년도 옵션 생성
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className={styles.container}>
      {/* 배경 애니메이션 요소들 */}
      <div className={styles.floatingShape}></div>
      <div className={styles.floatingShape}></div>
      <div className={styles.floatingShape}></div>

      <div className={styles.signupCard}>
        <div className={styles.header}>
          <h1 className={styles.title}>회원가입</h1>
          <p className={styles.subtitle}>회원 정보를 입력해주세요</p>
        </div>

        <form noValidate onSubmit={handleSubmit} className={styles.signupForm}>
          {/* Firebase 에러 메시지 */}
          {error && (
            <div className={styles.firebaseError} role="alert">
              {error}
            </div>
          )}
          
          {/* 이메일 */}
          <div className={styles.formGroup}>
            <label htmlFor="signup-email" className={styles.label}>
              이메일 <span aria-hidden="true" className={styles.required}>*</span>
            </label>
            <input
              id="signup-email"
              type="email"
              name="email"
              value={formData.email}
              onChange={onChange}
              required
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "signup-email-error" : undefined}
              placeholder="example@hebimall.com"
              className={styles.input}
            />
            {errors.email && (
              <p id="signup-email-error" role="alert" className={styles.errorMessage}>
                {errors.email}
              </p>
            )}
          </div>

          {/* 비밀번호 */}
          <div className={styles.formGroup}>
            <label htmlFor="signup-password" className={styles.label}>
              비밀번호 <span aria-hidden="true" className={styles.required}>*</span>
            </label>
            <input
              id="signup-password"
              type="password"
              name="password"
              value={formData.password}
              onChange={onChange}
              required
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "signup-password-error" : undefined}
              placeholder="8자 이상 입력해주세요"
              className={styles.input}
            />
            {errors.password && (
              <p id="signup-password-error" role="alert" className={styles.errorMessage}>
                {errors.password}
              </p>
            )}
          </div>

          {/* 비밀번호 확인 */}
          <div className={styles.formGroup}>
            <label htmlFor="signup-confirm-password" className={styles.label}>
              비밀번호 확인 <span aria-hidden="true" className={styles.required}>*</span>
            </label>
            <input
              id="signup-confirm-password"
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={onChange}
              required
              autoComplete="new-password"
              aria-invalid={Boolean(errors.confirmPassword)}
              aria-describedby={errors.confirmPassword ? "signup-confirm-password-error" : undefined}
              placeholder="비밀번호를 다시 입력해주세요"
              className={styles.input}
            />
            {errors.confirmPassword && (
              <p id="signup-confirm-password-error" role="alert" className={styles.errorMessage}>
                {errors.confirmPassword}
              </p>
            )}
          </div>

          {/* 이름 */}
          <div className={styles.formGroup}>
            <label htmlFor="signup-name" className={styles.label}>
              이름 <span aria-hidden="true" className={styles.required}>*</span>
            </label>
            <input
              id="signup-name"
              type="text"
              name="name"
              value={formData.name}
              onChange={onChange}
              required
              autoComplete="name"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "signup-name-error" : undefined}
              placeholder="실명을 입력해주세요"
              className={styles.input}
            />
            {errors.name && (
              <p id="signup-name-error" role="alert" className={styles.errorMessage}>
                {errors.name}
              </p>
            )}
          </div>

          {/* 전화번호 */}
          <div className={styles.formGroup}>
            <label htmlFor="signup-phone" className={styles.label}>
              전화번호 <span aria-hidden="true" className={styles.required}>*</span>
            </label>
            <input
              id="signup-phone"
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={onChange}
              required
              autoComplete="tel"
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? "signup-phone-error" : undefined}
              placeholder="010-1234-5678"
              className={styles.input}
            />
            {errors.phone && (
              <p id="signup-phone-error" role="alert" className={styles.errorMessage}>
                {errors.phone}
              </p>
            )}
          </div>

          {/* 생년월일 */}
          <fieldset
            className={`${styles.formGroup} ${styles.fieldset}`}
            aria-invalid={Boolean(errors.birth)}
            aria-describedby={errors.birth ? "signup-birth-error" : undefined}
          >
            <legend className={styles.label}>
              생년월일 <span aria-hidden="true" className={styles.required}>*</span>
            </legend>
            <div style={{ display: 'flex', gap: '10px' }}>
              <select
                id="signup-birth-year"
                name="birthYear"
                value={formData.birthYear}
                onChange={onChange}
                required
                autoComplete="bday-year"
                aria-label="생년월일 연도"
                aria-invalid={Boolean(errors.birth)}
                aria-describedby={errors.birth ? "signup-birth-error" : undefined}
                className={styles.select}
                style={{ flex: 1 }}
              >
                <option value="">년도</option>
                {years.map(year => (
                  <option key={year} value={year}>{year}년</option>
                ))}
              </select>
              <select
                id="signup-birth-month"
                name="birthMonth"
                value={formData.birthMonth}
                onChange={onChange}
                required
                autoComplete="bday-month"
                aria-label="생년월일 월"
                aria-invalid={Boolean(errors.birth)}
                aria-describedby={errors.birth ? "signup-birth-error" : undefined}
                className={styles.select}
                style={{ flex: 1 }}
              >
                <option value="">월</option>
                {months.map(month => (
                  <option key={month} value={month}>{month}월</option>
                ))}
              </select>
              <select
                id="signup-birth-day"
                name="birthDay"
                value={formData.birthDay}
                onChange={onChange}
                required
                autoComplete="bday-day"
                aria-label="생년월일 일"
                aria-invalid={Boolean(errors.birth)}
                aria-describedby={errors.birth ? "signup-birth-error" : undefined}
                className={styles.select}
                style={{ flex: 1 }}
              >
                <option value="">일</option>
                {days.map(day => (
                  <option key={day} value={day}>{day}일</option>
                ))}
              </select>
            </div>
            {errors.birth && (
              <p id="signup-birth-error" role="alert" className={styles.errorMessage}>
                {errors.birth}
              </p>
            )}
          </fieldset>

          {/* 성별 */}
          <fieldset
            className={`${styles.formGroup} ${styles.fieldset}`}
            aria-invalid={Boolean(errors.gender)}
            aria-describedby={errors.gender ? "signup-gender-error" : undefined}
          >
            <legend className={styles.label}>
              성별 <span aria-hidden="true" className={styles.required}>*</span>
            </legend>
            <div className={styles.genderGroup}>
              <label className={styles.radioItem}>
                <input
                  id="signup-gender-male"
                  type="radio"
                  name="gender"
                  value="male"
                  checked={formData.gender === "male"}
                  onChange={onChange}
                  required
                  autoComplete="sex"
                  aria-describedby={errors.gender ? "signup-gender-error" : undefined}
                />
                <span>남성</span>
              </label>
              <label className={styles.radioItem}>
                <input
                  id="signup-gender-female"
                  type="radio"
                  name="gender"
                  value="female"
                  checked={formData.gender === "female"}
                  onChange={onChange}
                  required
                  autoComplete="sex"
                  aria-describedby={errors.gender ? "signup-gender-error" : undefined}
                />
                <span>여성</span>
              </label>
            </div>
            {errors.gender && (
              <p id="signup-gender-error" role="alert" className={styles.errorMessage}>
                {errors.gender}
              </p>
            )}
          </fieldset>

          {/* 데모 안내 확인 */}
          <fieldset
            className={`${styles.agreementSection} ${styles.fieldset}`}
            aria-describedby={[
              errors.terms ? "signup-terms-error" : undefined,
              errors.privacy ? "signup-privacy-error" : undefined,
            ].filter(Boolean).join(" ") || undefined}
          >
            <legend className={styles.label}>필수 안내 확인</legend>
            <div className={styles.agreementGroup}>
              <div className={styles.checkboxItem}>
                <input
                  id="signup-terms-agree"
                  type="checkbox"
                  name="termsAgree"
                  checked={formData.termsAgree}
                  onChange={onChange}
                  required
                  autoComplete="off"
                  aria-invalid={Boolean(errors.terms)}
                  aria-describedby={errors.terms ? "signup-terms-error" : undefined}
                />
                <label htmlFor="signup-terms-agree" className={`${styles.checkboxLabel} ${styles.required}`}>
                  포트폴리오 데모 이용 안내에 동의합니다 (필수)
                </label>
                <Link href="/legal/terms" target="_blank" className={styles.linkButton}>
                  데모 이용 안내 보기
                </Link>
              </div>
              <div className={styles.checkboxItem}>
                <input
                  id="signup-privacy-agree"
                  type="checkbox"
                  name="privacyAgree"
                  checked={formData.privacyAgree}
                  onChange={onChange}
                  required
                  autoComplete="off"
                  aria-invalid={Boolean(errors.privacy)}
                  aria-describedby={errors.privacy ? "signup-privacy-error" : undefined}
                />
                <label htmlFor="signup-privacy-agree" className={`${styles.checkboxLabel} ${styles.required}`}>
                  개인정보 안내를 확인했습니다 (필수)
                </label>
                <Link href="/legal/privacy" target="_blank" className={styles.linkButton}>
                  개인정보 안내 보기
                </Link>
              </div>
              <div className={styles.checkboxItem}>
                <input
                  id="signup-marketing-agree"
                  type="checkbox"
                  name="marketingAgree"
                  checked={formData.marketingAgree}
                  onChange={onChange}
                  autoComplete="off"
                  aria-invalid="false"
                />
                <label htmlFor="signup-marketing-agree" className={styles.checkboxLabel}>
                  마케팅 정보 수신에 동의합니다 (선택)
                </label>
              </div>
            </div>
            {errors.terms && (
              <p id="signup-terms-error" role="alert" className={styles.errorMessage}>
                {errors.terms}
              </p>
            )}
            {errors.privacy && (
              <p id="signup-privacy-error" role="alert" className={styles.errorMessage}>
                {errors.privacy}
              </p>
            )}
          </fieldset>

          <p className={styles.subtitle}>{formatSignupBenefit()}</p>
          <p className={styles.subtitle}>{buildDemoDataNotice()}</p>

          {bonusSyncFailed && (
            <div className={styles.firebaseError} role="alert">
              <p>회원가입은 완료되었지만 5,000P 지급 확인에 실패했습니다.</p>
              <p>아래 버튼으로 안전하게 다시 확인할 수 있으며 중복 지급되지 않습니다.</p>
              <button
                type="button"
                disabled={isSubmitting}
                className={styles.submitButton}
                onClick={handleBonusRetry}
              >
                {isSubmitting ? "지급 확인 중..." : "5,000P 지급 다시 확인"}
              </button>
            </div>
          )}

          {/* 회원가입 버튼 */}
          <button
            type="submit"
            disabled={isSubmitting || signupCompleted}
            className={styles.submitButton}
          >
            {signupCompleted ? "회원가입 완료" : isSubmitting ? "가입 처리 중..." : "회원가입"}
          </button>
        </form>

        {/* 로그인 링크 */}
        <div className={styles.loginSection}>
          <span className={styles.loginText}>이미 계정이 있으신가요?</span>
          <Link href="/auth/login" className={styles.loginLink}>
            로그인
          </Link>
        </div>
      </div>
    </div>
  );
}
