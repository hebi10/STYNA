// 포인트 관련 React Hook
import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import PointService from '@/shared/services/pointService';
import { PointHistory, AddPointRequest, UsePointRequest, RefundPointRequest } from '@/shared/types/point';
import { useAuth } from '@/context/authProvider';

// 포인트 잔액 조회 Hook
export const usePointBalance = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['pointBalance', user?.uid],
    queryFn: () => PointService.getPointBalance(user!.uid),
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5분
  });
};

// 포인트 내역 조회 Hook
export const usePointHistory = (limit: number = 50) => {
  const { user } = useAuth();
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [allHistory, setAllHistory] = useState<PointHistory[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // ref로 로딩 상태 관리
  const isLoadingMoreRef = useRef(false);

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['pointHistory', user?.uid, limit],
    queryFn: () => PointService.getPointHistory(user!.uid, limit),
    enabled: !!user,
  });

  useEffect(() => {
    if (data?.success && data.history && !isInitialized) {
 console.log(' 포인트 내역 초기 로드:', data.history.length);
      setAllHistory(data.history);
      setLastDoc(data.lastDoc);
      setHasMore(data.hasMore);
      setIsInitialized(true);
    }
  }, [data, isInitialized]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMoreRef.current || !lastDoc) {
 console.log(' 포인트 내역 추가 로드 스킵:', { hasMore, isLoading: isLoadingMoreRef.current, lastDoc: !!lastDoc });
      return;
    }

 console.log(' 포인트 내역 추가 로드 시작');
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    
    try {
      const response = await PointService.getPointHistory(user!.uid, limit, lastDoc);
      if (response.success) {
 console.log(' 포인트 내역 추가 로드 완료:', response.history.length);
        setAllHistory(prev => [...prev, ...response.history]);
        setLastDoc(response.lastDoc);
        setHasMore(response.hasMore);
      }
    } catch (error) {
 console.error('포인트 내역 추가 로드 실패:', error);
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [hasMore, lastDoc, user, limit]);

  const reset = useCallback(() => {
    setAllHistory([]);
    setLastDoc(null);
    setHasMore(true);
    setIsInitialized(false);
    refetch();
  }, [refetch]);

  return {
    history: allHistory,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    reset,
  };
};

// 포인트 적립 Hook
export const useAddPoint = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (data: AddPointRequest) => PointService.addPoint(data),
    onSuccess: () => {
      // 포인트 잔액과 내역 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['pointBalance', user?.uid] });
      queryClient.invalidateQueries({ queryKey: ['pointHistory', user?.uid] });
    },
  });
};

// 포인트 사용 Hook
export const useUsePoint = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (data: UsePointRequest) => PointService.spendPoint(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pointBalance', user?.uid] });
      queryClient.invalidateQueries({ queryKey: ['pointHistory', user?.uid] });
    },
  });
};

// 포인트 환불 Hook
export const useRefundPoint = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (data: RefundPointRequest) => PointService.refundPoint(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pointBalance', user?.uid] });
      queryClient.invalidateQueries({ queryKey: ['pointHistory', user?.uid] });
    },
  });
};

// 회원가입 포인트 적립 Hook
export const useSignupPoint = () => {
  return useMutation({
    mutationFn: () => PointService.addSignupPoint(),
  });
};

const pointHooks = {
  usePointBalance,
  usePointHistory,
  useAddPoint,
  useUsePoint,
  useRefundPoint,
  useSignupPoint,
};

export default pointHooks;
