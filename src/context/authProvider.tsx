"use client";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { User, UserCredential } from "firebase/auth";
import { useAuthUser } from "../shared/hooks/useAuthUser";
import { 
  logout as firebaseLogout, 
  loginOneSession as firebaseSignIn, 
  loginKeepAlive as firebaseLoginKeepAlive, 
  signUp as firebaseSignUp  
} from "../shared/libs/firebase/auth";
import {
  isUserDataNotFoundError,
  useUserData,
} from "../shared/hooks/useUserData";
import { getErrorMessage } from "../shared/utils/authErrorMessages";
import { db } from "../shared/libs/firebase/firebase";
import {
  AUTH_ACCESS_CHANGED_EVENT,
  hasActiveAccount,
  hasStrictAdminAccess,
} from "../shared/utils/authAccess";

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, keepAlive: boolean) => Promise<UserCredential>;
  logout: () => Promise<void>;
  signUp: (
    email: string,
    password: string,
    createProfile: (user: User) => Promise<void>
  ) => Promise<UserCredential>;
  loading: boolean;
  userData: Record<string, unknown> | null | undefined;
  isAdmin: boolean;
  error: string | null;
  clearError: () => void;
  isUserDataLoading: boolean;
}

function getAuthErrorCode(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";
}

function getErrorMessageValue(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: async () => {
    throw new Error("AuthProvider is not mounted.");
  },
  logout: () => Promise.resolve(),
  signUp: async () => {
    throw new Error("AuthProvider is not mounted.");
  },
  loading: true,
  userData: null,
  isAdmin: false,
  error: null,
  clearError: () => {},
  isUserDataLoading: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isUserDataLoading, setIsUserDataLoading] = useState(true);
  const [adminClaimsLoading, setAdminClaimsLoading] = useState(false);
  const [isLoginValidating, setIsLoginValidating] = useState(false);
  const isLoginValidatingRef = useRef(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const isProvisioningRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const login = async (email: string, password: string, keepAlive: boolean) => {
    isLoginValidatingRef.current = true;
    setIsLoginValidating(true);
    let authenticated = false;

    try {
      setError(null);
      let userCredential;
      
      if (keepAlive) {
        userCredential = await firebaseLoginKeepAlive(email, password);
      } else {
        userCredential = await firebaseSignIn(email, password);
      }
      authenticated = true;
      
      // 로그인 성공 후 사용자 상태 확인
      const userDoc = await import('firebase/firestore').then(module => 
        module.getDoc(module.doc(db, 'users', userCredential.user.uid))
      );
      
      const accountData = userDoc.exists() ? userDoc.data() : null;

      if (!hasActiveAccount(accountData)) {
        if (accountData?.status === 'inactive') {
          throw new Error('ACCOUNT_INACTIVE');
        }

        if (accountData?.status === 'banned') {
          throw new Error('ACCOUNT_BANNED');
        }

        throw new Error('ACCOUNT_UNAVAILABLE');
      }

      queryClient.setQueryData(['user', userCredential.user.uid], accountData);
      
      return userCredential;
    } catch (err) {
      if (authenticated) {
        try {
          await firebaseLogout();
        } catch (logoutError) {
          console.error('로그인 계정 검증 실패 후 로그아웃 실패:', logoutError);
        }
      }

      let errorMessage;
      
      if (getErrorMessageValue(err) === 'ACCOUNT_INACTIVE') {
        errorMessage = '이용이 중지된 사용자입니다. 관리자에게 문의하세요.';
      } else if (getErrorMessageValue(err) === 'ACCOUNT_BANNED') {
        errorMessage = '정지된 계정입니다. 관리자에게 문의하세요.';
      } else if (getErrorMessageValue(err) === 'ACCOUNT_UNAVAILABLE') {
        errorMessage = '사용할 수 없는 계정입니다. 관리자에게 문의하세요.';
      } else {
        errorMessage = getErrorMessage(getAuthErrorCode(err));
      }
      
      setError(errorMessage);
      throw err;
    } finally {
      isLoginValidatingRef.current = false;
      setIsLoginValidating(false);
    }
  };

  const logout = async () => {
    try {
      await firebaseLogout();
      // Next.js router 대신 window.location을 사용하여 강제 페이지 이동
      if (typeof window !== 'undefined') {
        window.location.href = "/auth/login";
      }
    } catch (error) {
      console.error("Logout error:", error);
      // 에러가 발생해도 로그인 페이지로 이동
      if (typeof window !== 'undefined') {
        window.location.href = "/auth/login";
      }
    }
  };

  const signUp = async (
    email: string,
    password: string,
    createProfile: (user: User) => Promise<void>
  ) => {
    isProvisioningRef.current = true;
    setIsProvisioning(true);
    let authCreated = false;

    try {
      setError(null);
      const userCredential = await firebaseSignUp(email, password);
      authCreated = true;

      await createProfile(userCredential.user);
      await queryClient.invalidateQueries({
        queryKey: ['user', userCredential.user.uid],
        refetchType: 'none',
      });
      await queryClient.refetchQueries({
        queryKey: ['user', userCredential.user.uid],
        type: 'active',
      });

      return userCredential;
    } catch (err) {
      if (authCreated) {
        try {
          await firebaseLogout();
        } catch (logoutError) {
          console.error('회원가입 프로필 실패 후 로그아웃 실패:', logoutError);
        }
      }

      const errorMessage = getErrorMessage(getAuthErrorCode(err));
      setError(errorMessage);
      throw err;
    } finally {
      isProvisioningRef.current = false;
      setIsProvisioning(false);
    }
  };

  const clearError = () => setError(null);

  const {
    data: userData,
    isLoading: userDataLoading,
    error: userDataError,
  } = useUserData(user?.uid || "");

  useEffect(() => {
    const loginRedirect = !loading && !user && pathname !== "/auth/login" && !pathname.startsWith("/admin") && pathname.includes("/mypage");
    const userRedirect = !loading && user && !pathname.startsWith("/admin") && pathname === "/auth/login";

    if (loginRedirect) {
      router.replace("/auth/login");
    } else if (userRedirect) {
      router.replace("/mypage");
    }
  }, [user, loading, pathname, router]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const handleAccessChanged = (event: Event) => {
      const { userId } = (event as CustomEvent<{ userId?: string }>).detail || {};
      if (userId !== user.uid) {
        return;
      }

      setIsAdmin(false);
      void queryClient.invalidateQueries({ queryKey: ['user', user.uid] });
    };

    window.addEventListener(AUTH_ACCESS_CHANGED_EVENT, handleAccessChanged);
    return () => {
      window.removeEventListener(AUTH_ACCESS_CHANGED_EVENT, handleAccessChanged);
    };
  }, [queryClient, user]);

  useEffect(() => {
    if (
      !user
      || loading
      || userDataLoading
      || isLoginValidating
      || isLoginValidatingRef.current
      || isProvisioning
      || isProvisioningRef.current
    ) {
      return;
    }

    const userDataMissing = isUserDataNotFoundError(userDataError);

    if (userDataError && !userDataMissing) {
      setIsAdmin(false);
      return;
    }

    if (!userData && !userDataMissing) {
      setIsAdmin(false);
      return;
    }

    if (!userDataMissing && hasActiveAccount(userData)) {
      return;
    }

    const blockedStatus = userDataMissing
      || userData?.status === 'inactive'
      || userData?.status === 'banned'
      || userData?.status === 'deleted';

    setIsAdmin(false);
    if (!blockedStatus) {
      return;
    }

    let cancelled = false;
    setError('사용할 수 없는 계정입니다. 관리자에게 문의하세요.');

    void firebaseLogout().catch((logoutError) => {
      if (!cancelled) {
        console.error('비활성 계정 로그아웃 실패:', logoutError);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isLoginValidating, isProvisioning, loading, user, userData, userDataError, userDataLoading]);

  // 관리자 권한은 Custom Claims와 활성 사용자 문서의 관리자 역할을 모두 확인한다.
  useEffect(() => {
    let cancelled = false;

    const loadAdminClaims = async () => {
      if (
        !user
        || isLoginValidating
        || isLoginValidatingRef.current
        || userDataError
        || !hasActiveAccount(userData)
      ) {
        setIsAdmin(false);
        setAdminClaimsLoading(false);
        return;
      }

      setAdminClaimsLoading(true);
      try {
        const tokenResult = await user.getIdTokenResult(true);
        const claims = tokenResult.claims;
        const nextIsAdmin = hasStrictAdminAccess(claims, userData);

        if (!cancelled) {
          setIsAdmin(nextIsAdmin);
        }
      } catch (error) {
        console.error('관리자 권한 토큰 확인 실패:', error);
        if (!cancelled) {
          setIsAdmin(false);
        }
      } finally {
        if (!cancelled) {
          setAdminClaimsLoading(false);
        }
      }
    };

    loadAdminClaims();

    return () => {
      cancelled = true;
    };
  }, [isLoginValidating, user, userData, userDataError]);

  useEffect(() => {
    setIsUserDataLoading(
      userDataLoading
      || loading
      || adminClaimsLoading
      || isLoginValidating
      || isProvisioning
    );
  }, [userDataLoading, loading, adminClaimsLoading, isLoginValidating, isProvisioning]);

  return (
    <AuthContext.Provider value={{ user, login, logout, signUp, userData, loading, isUserDataLoading, isAdmin, error, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}


export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("AuthProvider에서 벗어났습니다.");
  }
  return context;
}
