'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CouponService } from '@/shared/services/couponService';
import { 
  Coupon, 
  UserCouponView, 
  CouponStats, 
  CouponFilter,
  CouponResponse 
} from '@/shared/types/coupon';
import { useAuth } from './authProvider';
import { couponKeys } from '@/shared/hooks/queryKeys';
import { getCouponAvailability } from '@/shared/utils/orderPricing';

interface CouponContextType {
  // 상태
  userCoupons: UserCouponView[];
  couponStats: CouponStats | null;
  availableCoupons: Coupon[];
  userCouponsReady: boolean;
  loading: boolean;
  error: string | null;

  // 액션
  refreshUserCoupons: () => Promise<void>;
  getUserCouponsWithFilter: (filter: CouponFilter) => Promise<void>;
  getAvailableCouponsForOrder: (orderAmount: number) => Promise<UserCouponView[]>;
  useCoupon: (userCouponId: string, orderId: string) => Promise<CouponResponse>;
  registerCouponByCode: (couponCode: string) => Promise<CouponResponse>;
  
  // 유틸리티
  getDaysUntilExpiry: (expiryDate: string) => number;
  calculateDiscount: (coupon: Coupon, orderAmount: number) => number;
}

const CouponContext = createContext<CouponContextType | undefined>(undefined);

interface CouponProviderProps {
  children: ReactNode;
}

export function CouponProvider({ children }: CouponProviderProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const currentUserUid = user?.uid ?? null;
  const activeUserUidRef = useRef<string | null>(currentUserUid);
  const previousUserUidRef = useRef<string | null>(currentUserUid);
  const overviewGenerationRef = useRef(0);
  const listGenerationRef = useRef(0);
  const availableCandidateRevisionRef = useRef(0);
  activeUserUidRef.current = currentUserUid;
  
  // 상태
  const [userCoupons, setUserCoupons] = useState<UserCouponView[]>([]);
  const [couponStats, setCouponStats] = useState<CouponStats | null>(null);
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
  const [loadedUserUid, setLoadedUserUid] = useState<string | null>(null);
  const [availableCandidateRevision, setAvailableCandidateRevision] = useState(0);
  const [pendingOperationCount, setPendingOperationCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const loading = pendingOperationCount > 0;

  const beginPendingOperation = useCallback(() => {
    let finished = false;
    setPendingOperationCount((count) => count + 1);

    return () => {
      if (finished) return;
      finished = true;
      setPendingOperationCount((count) => Math.max(0, count - 1));
    };
  }, []);
  const userCouponsReady = Boolean(currentUserUid && loadedUserUid === currentUserUid);

  const cacheCompleteOverviewCandidates = useCallback((
    userUID: string,
    coupons: UserCouponView[],
    isTruncated: boolean,
    revision: number,
  ) => {
    if (isTruncated || availableCandidateRevisionRef.current !== revision) {
      return;
    }

    const queryKey = couponKeys.availableOrderCandidatesVersion(userUID, revision);
    if (queryClient.getQueryData(queryKey) !== undefined) {
      return;
    }

    queryClient.setQueryDefaults(
      couponKeys.availableOrderCandidates(userUID),
      { staleTime: Infinity, gcTime: Infinity },
    );
    queryClient.setQueryData(
      queryKey,
      coupons.filter((coupon) => coupon.status === '사용가능'),
    );
  }, [queryClient]);

  const invalidateAvailableCandidateCache = useCallback((userUID: string) => {
    const revision = availableCandidateRevisionRef.current + 1;
    availableCandidateRevisionRef.current = revision;
    queryClient.removeQueries({
      queryKey: couponKeys.availableOrderCandidates(userUID),
    });
    return revision;
  }, [queryClient]);
  
  // 사용자 쿠폰 목록 새로고침
  const refreshUserCoupons = useCallback(async (): Promise<void> => {
    const userUID = user?.uid;
    if (!userUID) return;
    const candidateRevision = invalidateAvailableCandidateCache(userUID);
    const generation = ++overviewGenerationRef.current;
    const listGenerationAtStart = ++listGenerationRef.current;
    const isCurrentRequest = () => (
      overviewGenerationRef.current === generation && activeUserUidRef.current === userUID
    );
    const finishPendingOperation = beginPendingOperation();

    try {
      setError(null);

      // 목록과 통계를 같은 user_coupons snapshot에서 새로고침한다.
      const overview = await CouponService.getUserCouponOverview(userUID);

      if (!isCurrentRequest()) return;
      if (listGenerationRef.current === listGenerationAtStart) {
        setUserCoupons(overview.coupons);
      }
      setCouponStats(overview.stats);
      setLoadedUserUid(userUID);
      cacheCompleteOverviewCandidates(
        userUID,
        overview.coupons,
        overview.isTruncated,
        candidateRevision,
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '쿠폰을 불러오는데 실패했습니다.';
      if (isCurrentRequest()) {
        setLoadedUserUid(null);
        setError(errorMessage);
        console.error('사용자 쿠폰 새로고침 실패:', err);
      }
      throw err;
    } finally {
      if (isCurrentRequest() && availableCandidateRevisionRef.current === candidateRevision) {
        setAvailableCandidateRevision(candidateRevision);
      }
      finishPendingOperation();
    }
  }, [
    beginPendingOperation,
    cacheCompleteOverviewCandidates,
    invalidateAvailableCandidateCache,
    user?.uid,
  ]);

  // 필터를 적용한 사용자 쿠폰 조회
  const getUserCouponsWithFilter = useCallback(async (filter: CouponFilter): Promise<void> => {
    const userUID = user?.uid || null;

    if (!userUID) return;
    const generation = ++listGenerationRef.current;
    const isCurrentRequest = () => (
      listGenerationRef.current === generation && activeUserUidRef.current === userUID
    );
    const finishPendingOperation = beginPendingOperation();

    try {
      setError(null);

      const coupons = await CouponService.getUserCoupons(userUID, filter);
      if (!isCurrentRequest()) return;
      setUserCoupons(coupons);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '쿠폰을 불러오는데 실패했습니다.';
      if (isCurrentRequest()) {
        setError(errorMessage);
        console.error('필터링된 쿠폰 조회 실패:', err);
      }
    } finally {
      finishPendingOperation();
    }
  }, [beginPendingOperation, user?.uid]);

  // 주문에 사용 가능한 쿠폰 조회
  const getAvailableCouponsForOrder = useCallback(async (orderAmount: number): Promise<UserCouponView[]> => {
    if (!currentUserUid) return [];
    const userUID = currentUserUid;
    if (activeUserUidRef.current !== userUID) {
      return [];
    }
    const revision = Math.max(
      availableCandidateRevision,
      availableCandidateRevisionRef.current,
    );
    const queryKey = couponKeys.availableOrderCandidatesVersion(userUID, revision);
    const cachedCandidates = queryClient.getQueryData<UserCouponView[]>(queryKey);
    if (cachedCandidates) {
      return cachedCandidates.filter((coupon) => getCouponAvailability(coupon, orderAmount).usable);
    }

    const finishPendingOperation = beginPendingOperation();
    try {
      const candidates = await queryClient.ensureQueryData({
        queryKey,
        queryFn: () => CouponService.getUserCoupons(
          userUID,
          { status: '사용가능' },
          Number.MAX_SAFE_INTEGER,
        ),
        staleTime: Infinity,
        gcTime: Infinity,
      });
      if (activeUserUidRef.current !== userUID) {
        return [];
      }
      return candidates.filter((userCoupon) => getCouponAvailability(userCoupon, orderAmount).usable);
    } finally {
      finishPendingOperation();
    }
  }, [
    beginPendingOperation,
    availableCandidateRevision,
    currentUserUid,
    queryClient,
  ]);

  // 쿠폰 사용
  const useCoupon = async (userCouponId: string, orderId: string): Promise<CouponResponse> => {
    const userUID = user?.uid;
    if (!userUID) {
      throw new Error('로그인이 필요합니다.');
    }
    const finishPendingOperation = beginPendingOperation();

    try {
      const response = await CouponService.redeemCoupon(userCouponId, orderId, userUID);
      
      if (response.success) {
        try {
          await refreshUserCoupons();
        } catch (refreshError) {
          console.error('쿠폰 사용 후 새로고침 실패:', refreshError);
        }
      }
      
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '쿠폰 사용에 실패했습니다.';
      throw new Error(errorMessage);
    } finally {
      finishPendingOperation();
    }
  };

  // 쿠폰 코드로 등록
  const registerCouponByCode = async (couponCode: string): Promise<CouponResponse> => {
    const userUID = user?.uid;
    if (!userUID) {
      throw new Error('로그인이 필요합니다.');
    }
    const finishPendingOperation = beginPendingOperation();

    try {
      const response = await CouponService.registerCouponByCode(userUID, couponCode);
      
      if (response.success) {
        try {
          await refreshUserCoupons();
        } catch (refreshError) {
          console.error('쿠폰 등록 후 새로고침 실패:', refreshError);
        }
      }
      
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '쿠폰 등록에 실패했습니다.';
      throw new Error(errorMessage);
    } finally {
      finishPendingOperation();
    }
  };

  // 유틸리티 함수들
  const getDaysUntilExpiry = (expiryDate: string): number => {
    return CouponService.getDaysUntilExpiry(expiryDate);
  };

  const calculateDiscount = (coupon: Coupon, orderAmount: number): number => {
    return CouponService.calculateDiscount(coupon, orderAmount);
  };

  // 사용자 변경시 쿠폰 목록 초기화 및 새로고침
  useEffect(() => {
    const userUID = user?.uid;
    const previousUserUID = previousUserUidRef.current;
    previousUserUidRef.current = userUID ?? null;
    if (previousUserUID && previousUserUID !== userUID) {
      queryClient.removeQueries({
        queryKey: couponKeys.availableOrderCandidates(previousUserUID),
      });
    }
    const generation = ++overviewGenerationRef.current;
    listGenerationRef.current += 1;
    const listGenerationAtStart = listGenerationRef.current;
    const isCurrentRequest = () => (
      overviewGenerationRef.current === generation
      && activeUserUidRef.current === (userUID ?? null)
    );

    setUserCoupons([]);
    setCouponStats(null);
    setAvailableCoupons([]);
    setLoadedUserUid(null);
    setError(null);

    if (userUID) {
      // 사용자가 로그인한 경우 쿠폰 데이터 로드
      const loadUserData = async () => {
        const finishPendingOperation = beginPendingOperation();
        try {
          const [overviewResult, activeCouponsResult] = await Promise.allSettled([
            CouponService.getUserCouponOverview(userUID),
            CouponService.getActiveCoupons(),
          ]);

          if (!isCurrentRequest()) return;

          if (overviewResult.status === 'fulfilled') {
            if (listGenerationRef.current === listGenerationAtStart) {
              setUserCoupons(overviewResult.value.coupons);
            }
            setCouponStats(overviewResult.value.stats);
            setLoadedUserUid(userUID);
            cacheCompleteOverviewCandidates(
              userUID,
              overviewResult.value.coupons,
              overviewResult.value.isTruncated,
              availableCandidateRevisionRef.current,
            );
          } else {
            const errorMessage = overviewResult.reason instanceof Error
              ? overviewResult.reason.message
              : '쿠폰을 불러오는데 실패했습니다.';
            setError(errorMessage);
            console.warn('사용자 쿠폰 조회 실패:', overviewResult.reason);
          }

          if (activeCouponsResult.status === 'fulfilled') {
            setAvailableCoupons(activeCouponsResult.value);
          } else {
            console.warn('활성 쿠폰 조회 실패 (인덱스 필요):', activeCouponsResult.reason);
          }
        } catch (err) {
          if (!isCurrentRequest()) return;
          const errorMessage = err instanceof Error ? err.message : '쿠폰을 불러오는데 실패했습니다.';
          setError(errorMessage);
          console.error('쿠폰 데이터 로드 실패:', err);
        } finally {
          finishPendingOperation();
        }
      };

      void loadUserData();
    }

    return () => {
      if (overviewGenerationRef.current === generation) {
        overviewGenerationRef.current += 1;
      }
      if (userUID) {
        queryClient.removeQueries({
          queryKey: couponKeys.availableOrderCandidates(userUID),
        });
      }
    };
  }, [
    beginPendingOperation,
    cacheCompleteOverviewCandidates,
    queryClient,
    user?.uid,
  ]); // user?.uid만 의존성으로 설정

  const value: CouponContextType = {
    // 상태
    userCoupons: userCouponsReady ? userCoupons : [],
    couponStats: userCouponsReady ? couponStats : null,
    availableCoupons: userCouponsReady ? availableCoupons : [],
    userCouponsReady,
    loading,
    error,

    // 액션
    refreshUserCoupons,
    getUserCouponsWithFilter,
    getAvailableCouponsForOrder,
    useCoupon,
    registerCouponByCode,

    // 유틸리티
    getDaysUntilExpiry,
    calculateDiscount
  };

  return (
    <CouponContext.Provider value={value}>
      {children}
    </CouponContext.Provider>
  );
}

// 커스텀 훅
export function useCoupon() {
  const context = useContext(CouponContext);
  if (context === undefined) {
    throw new Error('useCoupon은 반드시 CouponProvider 내부에서 사용해야 합니다.');
  }
  return context;
}
