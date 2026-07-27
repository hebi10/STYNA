"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from "react";
import { HybridUserActivityService } from "@/shared/services/hybridUserActivityService";
import { RecentProduct, WishlistItem } from "@/shared/types/userActivity";
import { useAuth } from "./authProvider";

interface UserActivityContextType {
  // 상태
  recentProducts: RecentProduct[];
  wishlistItems: WishlistItem[];
  
  // UI 상태
  loading: boolean;
  error: string | null;
  
  // 액션
  addRecentProduct: (productId: string) => Promise<void>;
  loadRecentProducts: (userId: string) => Promise<void>;
  addToWishlist: (productId: string) => Promise<void>;
  removeFromWishlist: (productId: string) => Promise<void>;
  loadWishlistItems: (userId: string) => Promise<void>;
  isInWishlist: (productId: string) => Promise<boolean>;
  clearUserActivity: () => Promise<void>;
  clearAllRecentProducts: () => Promise<void>;
  clearAllWishlistItems: () => Promise<void>;
}

const UserActivityContext = createContext<UserActivityContextType | undefined>(undefined);

export function useUserActivity() {
  const context = useContext(UserActivityContext);
  if (context === undefined) {
    throw new Error('useUserActivity must be used within a UserActivityProvider');
  }
  return context;
}

export function UserActivityProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  
  // 상태
  const [recentProducts, setRecentProducts] = useState<RecentProduct[]>([]);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  
  // UI 상태
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadGenerationRef = useRef(0);
  const activeUserIdRef = useRef(user?.uid);
  activeUserIdRef.current = user?.uid;

  // 사용자 변경시 데이터 로드
  useEffect(() => {
    const userId = user?.uid;
    const generation = ++loadGenerationRef.current;

    if (!userId) {
      setRecentProducts([]);
      setWishlistItems([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);

    void Promise.allSettled([
      HybridUserActivityService.getRecentProducts(userId),
      HybridUserActivityService.getWishlist(userId),
    ]).then(([recentResult, wishlistResult]) => {
      if (
        loadGenerationRef.current !== generation
        || activeUserIdRef.current !== userId
      ) {
        return;
      }

      if (recentResult.status === 'fulfilled') {
        setRecentProducts(recentResult.value);
      }
      if (wishlistResult.status === 'fulfilled') {
        setWishlistItems(wishlistResult.value);
      }

      const rejectedResult = [recentResult, wishlistResult]
        .find((result) => result.status === 'rejected');
      if (rejectedResult?.status === 'rejected') {
        const message = rejectedResult.reason instanceof Error
          ? rejectedResult.reason.message
          : '사용자 활동을 불러오는데 실패했습니다.';
        setError(message);
        console.error('사용자 활동 로드 실패:', rejectedResult.reason);
      }
      setLoading(false);
    });

    return () => {
      if (loadGenerationRef.current === generation) {
        loadGenerationRef.current += 1;
      }
    };
  }, [user?.uid]);

  // 최근 본 상품 추가
  const addRecentProduct = useCallback(async (productId: string) => {
    if (!user?.uid) return;
    
    try {
      await HybridUserActivityService.addRecentProduct(user.uid, productId);
      
      // 로컬 상태 업데이트
      const userId = user.uid;
      void HybridUserActivityService.getRecentProducts(userId).then((products) => {
        if (activeUserIdRef.current === userId) {
          setRecentProducts(products);
        }
      });
      
    } catch (err) {
      console.error('최근 본 상품 추가 실패:', err);
    }
  }, [user?.uid]);

  // 최근 본 상품 불러오기
  const loadRecentProducts = useCallback(async (userId?: string) => {
    const targetUserId = userId || user?.uid;
    if (!targetUserId) return;
    
    try {
      const products = await HybridUserActivityService.getRecentProducts(targetUserId);
      if (activeUserIdRef.current === targetUserId) {
        setRecentProducts(products);
      }
    } catch (err) {
      console.error('최근 본 상품 로드 실패:', err);
    }
  }, [user?.uid]);  
  
  // 찜하기 추가
  const addToWishlist = useCallback(async (productId: string) => {
    if (!user?.uid) return;
    
    try {
      setError(null);
      
      await HybridUserActivityService.addToWishlist(user.uid, productId);
      
      // 로컬 상태 업데이트
      const userId = user.uid;
      void HybridUserActivityService.getWishlist(userId).then((items) => {
        if (activeUserIdRef.current === userId) {
          setWishlistItems(items);
        }
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '찜하기에 실패했습니다.';
      setError(errorMessage);
      console.error('찜하기 추가 실패:', err);
      throw err;
    }
  }, [user?.uid]);

  // 찜하기 제거
  const removeFromWishlist = useCallback(async (productId: string) => {
    if (!user?.uid) return;
    
    try {
      setError(null);
      
      await HybridUserActivityService.removeFromWishlist(user.uid, productId);
      
      // 로컬 상태 업데이트
      setWishlistItems(prev => prev.filter(item => item.productId !== productId));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '찜하기 제거에 실패했습니다.';
      setError(errorMessage);
      console.error('찜하기 제거 실패:', err);
      throw err;
    }
  }, [user?.uid]);

  // 찜한 상품 로드
  const loadWishlistItems = useCallback(async (userId: string) => {
    try {
      setLoading(true);
      setError(null);

      const items = await HybridUserActivityService.getWishlist(userId);
      if (activeUserIdRef.current === userId) {
        setWishlistItems(items);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '찜한 상품을 불러오는데 실패했습니다.';
      setError(errorMessage);
      console.error('찜한 상품 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 모든 최근 본 상품 삭제
  const clearAllRecentProducts = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      setError(null);
      
      await HybridUserActivityService.clearRecentProducts(user.uid);
      
      // 로컬 상태 업데이트
      setRecentProducts([]);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '최근 본 상품 삭제에 실패했습니다.';
      setError(errorMessage);
      console.error('최근 본 상품 전체 삭제 실패:', err);
      throw err;
    }
  }, [user?.uid]);

  // 모든 찜한 상품 삭제
  const clearAllWishlistItems = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      setError(null);
      
      await HybridUserActivityService.clearWishlist(user.uid);
      
      // 로컬 상태 업데이트
      setWishlistItems([]);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '찜한 상품 삭제에 실패했습니다.';
      setError(errorMessage);
      console.error('찜한 상품 전체 삭제 실패:', err);
      throw err;
    }
  }, [user?.uid]);

  // 찜 여부 확인
  const isInWishlist = useCallback(async (productId: string): Promise<boolean> => {
    if (!user?.uid) return false;
    return await HybridUserActivityService.isInWishlist(user.uid, productId);
  }, [user?.uid]);

  // 사용자 활동 데이터 초기화
  const clearUserActivity = useCallback(async () => {
    if (!user?.uid) return;
    
    await HybridUserActivityService.clearAllUserData(user.uid);
    setRecentProducts([]);
    setWishlistItems([]);
    setError(null);
  }, [user?.uid]);

  const value: UserActivityContextType = {
    // 상태
    recentProducts,
    wishlistItems,
    
    // UI 상태
    loading,
    error,
    
    // 액션
    addRecentProduct,
    loadRecentProducts,
    addToWishlist,
    removeFromWishlist,
    loadWishlistItems,
    isInWishlist,
    clearUserActivity,
    clearAllRecentProducts,
    clearAllWishlistItems,
  };

  return (
    <UserActivityContext.Provider value={value}>
      {children}
    </UserActivityContext.Provider>
  );
}
