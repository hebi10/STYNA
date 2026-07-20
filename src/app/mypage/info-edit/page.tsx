"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import styles from "./page.module.css";
import useInputs from "@/shared/hooks/useInput";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/shared/libs/firebase/firebase";
import { useAuth } from "@/context/authProvider";
import { FirebaseError } from "firebase/app";
import { updatePassword, updateEmail, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";

interface InfoEditFormData {
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  name: string;
  phone: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  gender: string;
  marketingAgree: boolean;
}

function getStringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getBooleanValue(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

export default function InfoEditPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, userData } = useAuth();
  const [rawFormData, onChange, setFormData] = useInputs<InfoEditFormData>({
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    name: "",
    phone: "",
    birthYear: "",
    birthMonth: "",
    birthDay: "",
    gender: "",
    marketingAgree: false,
  });
  const formData = rawFormData as unknown as InfoEditFormData;

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 사용자 데이터 로드
  useEffect(() => {
    const loadUserData = async () => {
      if (user && userData) {
        const birth = userData.birth as { year?: unknown; month?: unknown; day?: unknown } | undefined;
        setFormData({
          email: getStringValue(userData.email),
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
          name: getStringValue(userData.name),
          phone: getStringValue(userData.phone),
          birthYear: getStringValue(birth?.year),
          birthMonth: getStringValue(birth?.month),
          birthDay: getStringValue(birth?.day),
          gender: getStringValue(userData.gender),
          marketingAgree: getBooleanValue(userData.marketingAgree),
        });
        setIsLoading(false);
      }
    };

    loadUserData();
  }, [user, userData, setFormData]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // 이메일 검증
    if (!formData.email) {
      newErrors.email = "이메일을 입력해주세요.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "올바른 이메일 형식을 입력해주세요.";
    }

    // 비밀번호 변경 시 검증
    if (formData.newPassword) {
      if (!formData.currentPassword) {
        newErrors.currentPassword = "현재 비밀번호를 입력해주세요.";
      }
      if (formData.newPassword.length < 8) {
        newErrors.newPassword = "새 비밀번호는 8자 이상이어야 합니다.";
      }
      if (formData.newPassword !== formData.confirmPassword) {
        newErrors.confirmPassword = "비밀번호가 일치하지 않습니다.";
      }
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !user) {
      return;
    }

    setIsSubmitting(true);

    try {
      // 이메일이나 비밀번호 변경이 있는 경우 재인증 필요
      if (formData.email !== userData?.email || formData.newPassword) {
        if (!formData.currentPassword) {
          setErrors({ currentPassword: "현재 비밀번호를 입력해주세요." });
          setIsSubmitting(false);
          return;
        }

        const credential = EmailAuthProvider.credential(
          user.email!,
          formData.currentPassword
        );
        await reauthenticateWithCredential(user, credential);
      }

      // 이메일 업데이트
      if (formData.email !== userData?.email) {
        await updateEmail(user, formData.email);
        await user.getIdToken(true);
      }

      // 비밀번호 업데이트
      if (formData.newPassword) {
        await updatePassword(user, formData.newPassword);
      }

      // Firestore 사용자 정보 업데이트
      await updateDoc(doc(db, "users", user.uid), {
        email: formData.email,
        name: formData.name,
        phone: formData.phone,
        birth: {
          year: formData.birthYear,
          month: formData.birthMonth,
          day: formData.birthDay
        },
        gender: formData.gender,
        marketingAgree: formData.marketingAgree,
        updatedAt: serverTimestamp(),
      });

      await queryClient.invalidateQueries({ queryKey: ["user", user.uid] });

      alert("정보가 성공적으로 업데이트되었습니다!");
      router.push("/mypage");
    } catch (error) {
      console.error("Update failed:", error);
      
      // Firebase 에러 메시지 처리
      if (error instanceof FirebaseError && error.code === "auth/wrong-password") {
        setErrors({ currentPassword: "현재 비밀번호가 올바르지 않습니다." });
      } else if (error instanceof FirebaseError && error.code === "auth/email-already-in-use") {
        setErrors({ email: "이미 사용 중인 이메일입니다." });
      } else {
        setErrors({ general: "정보 업데이트에 실패했습니다. 다시 시도해주세요." });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 년도 옵션 생성
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingCard}>
          <div className={styles.loading}>정보를 불러오는 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 배경 애니메이션 요소들 */}
      <div className={styles.floatingShape}></div>
      <div className={styles.floatingShape}></div>
      <div className={styles.floatingShape}></div>

      <div className={styles.infoEditCard}>
        <div className={styles.header}>
          <h1 className={styles.title}>개인정보 수정</h1>
          <p className={styles.subtitle}>회원정보를 안전하게 관리하세요</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.infoEditForm}>
          {/* 일반 에러 메시지 */}
          {errors.general && (
            <div className={styles.errorMessage}>
              {errors.general}
            </div>
          )}
          
          {/* 이메일 */}
          <div className={styles.formGroup}>
            <label className={styles.label}>
              이메일 <span className={styles.required}>*</span>
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={onChange}
              placeholder="example@hebimall.com"
              className={styles.input}
            />
            {errors.email && <div className={styles.errorText}>{errors.email}</div>}
          </div>

          {/* 현재 비밀번호 */}
          <div className={styles.formGroup}>
            <label className={styles.label}>
              현재 비밀번호
            </label>
            <input
              type="password"
              name="currentPassword"
              value={formData.currentPassword}
              onChange={onChange}
              placeholder="이메일이나 비밀번호 변경 시 필요"
              className={styles.input}
            />
            {errors.currentPassword && <div className={styles.errorText}>{errors.currentPassword}</div>}
          </div>

          {/* 새 비밀번호 */}
          <div className={styles.formGroup}>
            <label className={styles.label}>
              새 비밀번호
            </label>
            <input
              type="password"
              name="newPassword"
              value={formData.newPassword}
              onChange={onChange}
              placeholder="변경을 원할 때만 입력 (8자 이상)"
              className={styles.input}
            />
            {errors.newPassword && <div className={styles.errorText}>{errors.newPassword}</div>}
          </div>

          {/* 새 비밀번호 확인 */}
          <div className={styles.formGroup}>
            <label className={styles.label}>
              새 비밀번호 확인
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={onChange}
              placeholder="새 비밀번호를 다시 입력해주세요"
              className={styles.input}
            />
            {errors.confirmPassword && <div className={styles.errorText}>{errors.confirmPassword}</div>}
          </div>

          {/* 이름 */}
          <div className={styles.formGroup}>
            <label className={styles.label}>
              이름 <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={onChange}
              placeholder="실명을 입력해주세요"
              className={styles.input}
            />
            {errors.name && <div className={styles.errorText}>{errors.name}</div>}
          </div>

          {/* 전화번호 */}
          <div className={styles.formGroup}>
            <label className={styles.label}>
              전화번호 <span className={styles.required}>*</span>
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={onChange}
              placeholder="010-1234-5678"
              className={styles.input}
            />
            {errors.phone && <div className={styles.errorText}>{errors.phone}</div>}
          </div>

          {/* 생년월일 */}
          <div className={styles.formGroup}>
            <label className={styles.label}>
              생년월일 <span className={styles.required}>*</span>
            </label>
            <div className={styles.birthGroup}>
              <select
                name="birthYear"
                value={formData.birthYear}
                onChange={onChange}
                className={styles.select}
              >
                <option value="">년도</option>
                {years.map(year => (
                  <option key={year} value={year}>{year}년</option>
                ))}
              </select>
              <select
                name="birthMonth"
                value={formData.birthMonth}
                onChange={onChange}
                className={styles.select}
              >
                <option value="">월</option>
                {months.map(month => (
                  <option key={month} value={month}>{month}월</option>
                ))}
              </select>
              <select
                name="birthDay"
                value={formData.birthDay}
                onChange={onChange}
                className={styles.select}
              >
                <option value="">일</option>
                {days.map(day => (
                  <option key={day} value={day}>{day}일</option>
                ))}
              </select>
            </div>
            {errors.birth && <div className={styles.errorText}>{errors.birth}</div>}
          </div>

          {/* 성별 */}
          <div className={styles.formGroup}>
            <label className={styles.label}>
              성별 <span className={styles.required}>*</span>
            </label>
            <div className={styles.genderGroup}>
              <label className={styles.radioItem}>
                <input
                  type="radio"
                  name="gender"
                  value="male"
                  checked={formData.gender === "male"}
                  onChange={onChange}
                />
                <span>남성</span>
              </label>
              <label className={styles.radioItem}>
                <input
                  type="radio"
                  name="gender"
                  value="female"
                  checked={formData.gender === "female"}
                  onChange={onChange}
                />
                <span>여성</span>
              </label>
            </div>
            {errors.gender && <div className={styles.errorText}>{errors.gender}</div>}
          </div>

          {/* 마케팅 정보 수신 동의 */}
          <div className={styles.agreementSection}>
            <label className={styles.label}>마케팅 정보 수신</label>
            <div className={styles.agreementGroup}>
              <div className={styles.checkboxItem}>
                <input
                  type="checkbox"
                  name="marketingAgree"
                  checked={formData.marketingAgree}
                  onChange={onChange}
                />
                <label className={styles.checkboxLabel}>
                  마케팅 정보 수신에 동의합니다 (선택)
                </label>
              </div>
            </div>
          </div>

          {/* 수정 버튼 */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={styles.submitButton}
          >
            {isSubmitting ? "정보 업데이트 중..." : "정보 수정"}
          </button>
        </form>

        {/* 돌아가기 버튼 */}
        <div className={styles.backSection}>
          <button
            type="button"
            onClick={() => router.push("/mypage")}
            className={styles.backButton}
          >
            마이페이지로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}
