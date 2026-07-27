'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/authProvider';
import { HybridUserActivityService } from '@/shared/services/hybridUserActivityService';
import { activityKeys } from './queryKeys';

const ACTIVITY_STALE_TIME_MS = 60 * 1000;

export function useWishlistActivity() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.uid ?? '';
  const queryKey = activityKeys.wishlist(userId);
  const wishlistQuery = useQuery({
    queryKey,
    queryFn: () => HybridUserActivityService.getWishlist(userId),
    enabled: Boolean(userId),
    staleTime: ACTIVITY_STALE_TIME_MS,
  });

  const addMutation = useMutation({
    mutationFn: async (productId: string) => {
      if (!userId) return;
      await HybridUserActivityService.addToWishlist(userId, productId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  const removeMutation = useMutation({
    mutationFn: async (productId: string) => {
      if (!userId) return;
      await HybridUserActivityService.removeFromWishlist(userId, productId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    wishlistItems: wishlistQuery.data ?? [],
    isLoading: wishlistQuery.isLoading,
    error: wishlistQuery.error,
    addToWishlist: addMutation.mutateAsync,
    removeFromWishlist: removeMutation.mutateAsync,
  };
}

export function useRecentProductTracking() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.uid ?? '';
  const mutation = useMutation({
    mutationFn: async (productId: string) => {
      if (!userId) return;
      await HybridUserActivityService.addRecentProduct(userId, productId);
    },
    onSuccess: () => queryClient.invalidateQueries({
      queryKey: ['activity', userId, 'recent'],
    }),
  });

  return { addRecentProduct: mutation.mutateAsync };
}
