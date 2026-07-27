'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CartService } from '../services/cartService';
import { AddToCartRequest, UpdateCartItemRequest } from '../types/cart';
import { Product } from '../types/product';
import { cartKeys } from './queryKeys';

export { cartKeys } from './queryKeys';

/**
 * 사용자 장바구니 조회 훅
 */
export function useCart(userId: string | null) {
  return useQuery({
    queryKey: cartKeys.list(userId || ''),
    queryFn: () => {
      if (!userId) return null;
      return CartService.getUserCart(userId);
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5분
    gcTime: 1000 * 60 * 10, // 10분
  });
}

/**
 * 장바구니 아이템 개수 조회 훅
 */
export function useCartItemCount(userId: string | null) {
  return useQuery({
    queryKey: cartKeys.count(userId || ''),
    queryFn: () => {
      if (!userId) return 0;
      return CartService.getCartItemCount(userId);
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // 2분
    gcTime: 1000 * 60 * 5, // 5분
  });
}

/**
 * 장바구니 추가 훅
 */
export function useAddToCart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      userId, 
      product, 
      request 
    }: { 
      userId: string; 
      product: Product; 
      request: AddToCartRequest; 
    }) => {
      return CartService.addToCart(userId, product, request);
    },
    onSuccess: (_, variables) => {
      // 장바구니 데이터 무효화 및 새로고침
      queryClient.invalidateQueries({ queryKey: cartKeys.list(variables.userId) });
      queryClient.invalidateQueries({ queryKey: cartKeys.count(variables.userId) });
    },
    onError: (error) => {
      console.error('장바구니 추가 실패:', error);
    },
  });
}

/**
 * 장바구니 아이템 수량 업데이트 훅
 */
export function useUpdateCartItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      userId, 
      request 
    }: { 
      userId: string; 
      request: UpdateCartItemRequest; 
    }) => {
      return CartService.updateCartItem(userId, request);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: cartKeys.list(variables.userId) });
      queryClient.invalidateQueries({ queryKey: cartKeys.count(variables.userId) });
    },
    onError: (error) => {
      console.error('장바구니 아이템 업데이트 실패:', error);
    },
  });
}

/**
 * 장바구니 아이템 제거 훅
 */
export function useRemoveFromCart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      userId, 
      cartItemId 
    }: { 
      userId: string; 
      cartItemId: string; 
    }) => {
      return CartService.removeFromCart(userId, cartItemId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: cartKeys.list(variables.userId) });
      queryClient.invalidateQueries({ queryKey: cartKeys.count(variables.userId) });
    },
    onError: (error) => {
      console.error('장바구니 아이템 제거 실패:', error);
    },
  });
}

/**
 * 장바구니 비우기 훅
 */
export function useClearCart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => {
      return CartService.clearCart(userId);
    },
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: cartKeys.list(userId) });
      queryClient.invalidateQueries({ queryKey: cartKeys.count(userId) });
    },
    onError: (error) => {
      console.error('장바구니 비우기 실패:', error);
    },
  });
}

/**
 * 장바구니 유효성 검사 훅
 */
export function useValidateCart(userId: string | null) {
  return useQuery({
    queryKey: [...cartKeys.list(userId || ''), 'validate'],
    queryFn: () => {
      if (!userId) return null;
      return CartService.validateCart(userId);
    },
    enabled: !!userId,
    staleTime: 1000 * 60, // 1분
    gcTime: 1000 * 60 * 3, // 3분
  });
}
