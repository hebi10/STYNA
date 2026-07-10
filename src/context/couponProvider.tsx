'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { CouponService } from '@/shared/services/couponService';
import { 
  Coupon, 
  UserCouponView, 
  CouponStats, 
  CouponFilter,
  CouponResponse 
} from '@/shared/types/coupon';
import { useAuth } from './authProvider';

interface CouponContextType {
  // 상태
  userCoupons: UserCouponView[];
  couponStats: CouponStats | null;
  availableCoupons: Coupon[];
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
  
  // 상태
  const [userCoupons, setUserCoupons] = useState<UserCouponView[]>([]);
  const [couponStats, setCouponStats] = useState<CouponStats | null>(null);
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // 사용자 쿠폰 목록 새로고침
  const refreshUserCoupons = useCallback(async (): Promise<void> => {
    const userUID = user?.uid;
    if (!userUID) return;

    try {
      setLoading(true);
      setError(null);

      // 사용자 쿠폰 목록과 통계만 새로고침 (활성 쿠폰은 제외)
      const [coupons, stats] = await Promise.all([
        CouponService.getUserCoupons(userUID),
        CouponService.getUserCouponStats(userUID)
      ]);

      setUserCoupons(coupons);
      setCouponStats(stats);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '쿠폰을 불러오는데 실패했습니다.';
      setError(errorMessage);
      console.error('사용자 쿠폰 새로고침 실패:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  // 필터를 적용한 사용자 쿠폰 조회
  const getUserCouponsWithFilter = useCallback(async (filter: CouponFilter): Promise<void> => {
    const userUID = user?.uid || null;

    if (!userUID) return;

    try {
      setLoading(true);
      setError(null);

      const coupons = await CouponService.getUserCoupons(userUID, filter);
      setUserCoupons(coupons);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '쿠폰을 불러오는데 실패했습니다.';
      setError(errorMessage);
      console.error('필터링된 쿠폰 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  // 주문에 사용 가능한 쿠폰 조회
  const getAvailableCouponsForOrder = async (orderAmount: number): Promise<UserCouponView[]> => {
    if (!user?.uid) return [];

    try {
      return await CouponService.getAvailableCouponsForOrder(user.uid, orderAmount);
    } catch (err) {
      console.error('주문 가능 쿠폰 조회 실패:', err);
      return [];
    }
  };

  // 쿠폰 사용
  const useCoupon = async (userCouponId: string, orderId: string): Promise<CouponResponse> => {
    if (!user?.uid) {
      throw new Error('로그인이 필요합니다.');
    }

    try {
      setLoading(true);
      const response = await CouponService.redeemCoupon(userCouponId, orderId, user.uid);
      
      if (response.success) {
        // 성공시 쿠폰 목록 새로고침
        await refreshUserCoupons();
      }
      
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '쿠폰 사용에 실패했습니다.';
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 쿠폰 코드로 등록
  const registerCouponByCode = async (couponCode: string): Promise<CouponResponse> => {
    if (!user?.uid) {
      throw new Error('로그인이 필요합니다.');
    }

    try {
      setLoading(true);
      const response = await CouponService.registerCouponByCode(user.uid, couponCode);
      
      if (response.success) {
        // 성공시 쿠폰 목록 새로고침
        await refreshUserCoupons();
      }
      
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '쿠폰 등록에 실패했습니다.';
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
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

    if (userUID) {
      // 사용자가 로그인한 경우 쿠폰 데이터 로드
      const loadUserData = async () => {
        try {
          setLoading(true);
          setError(null);

          // 각각 개별적으로 처리하여 하나가 실패해도 다른 것은 로드되도록 함
          const promises: [
            Promise<UserCouponView[]>,
            Promise<CouponStats | null>,
            Promise<Coupon[]>
          ] = [
            CouponService.getUserCoupons(userUID).catch(err => {
              console.warn('사용자 쿠폰 조회 실패:', err);
              return [] as UserCouponView[];
            }),
            CouponService.getUserCouponStats(userUID).catch(err => {
              console.warn('쿠폰 통계 조회 실패:', err);
              return null;
            }),
            CouponService.getActiveCoupons().catch(err => {
              console.warn('활성 쿠폰 조회 실패 (인덱스 필요):', err);
              return [] as Coupon[];
            })
          ];

          const [coupons, stats, activeCoupons] = await Promise.all(promises);

          setUserCoupons(coupons);
          setCouponStats(stats);
          setAvailableCoupons(activeCoupons);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : '쿠폰을 불러오는데 실패했습니다.';
          setError(errorMessage);
          console.error('쿠폰 데이터 로드 실패:', err);
        } finally {
          setLoading(false);
        }
      };

      loadUserData();
    } else {
      // 로그아웃시 상태 초기화
      setUserCoupons([]);
      setCouponStats(null);
      setAvailableCoupons([]);
      setError(null);
    }
  }, [user?.uid]); // user?.uid만 의존성으로 설정

  const value: CouponContextType = {
    // 상태
    userCoupons,
    couponStats,
    availableCoupons,
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
