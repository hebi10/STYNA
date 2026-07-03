'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QnAService } from '@/shared/services/qnaService';
import type { CreateQnAData, QnA, QnAAnswer, QnAFilter } from '@/shared/types/qna';

export const qnaKeys = {
  all: ['qna'] as const,
  list: (filter: QnAFilter, page: number, limitCount: number) =>
    [...qnaKeys.all, 'list', filter, page, limitCount] as const,
  admin: (limitCount: number) => [...qnaKeys.all, 'admin', limitCount] as const,
  user: (userId: string) => [...qnaKeys.all, 'user', userId] as const,
  detail: (qnaId: string, password?: string) => [...qnaKeys.all, 'detail', qnaId, password || ''] as const,
};

export function useQnAList(filters: QnAFilter, page = 1, limitCount = 50) {
  return useQuery({
    queryKey: qnaKeys.list(filters, page, limitCount),
    queryFn: () => QnAService.getQnAList(filters, page, limitCount),
    staleTime: 60 * 1000,
  });
}

export function useAdminQnAs(limitCount = 100) {
  return useQuery({
    queryKey: qnaKeys.admin(limitCount),
    queryFn: async () => {
      const { qnas } = await QnAService.getQnAList({}, 1, limitCount);
      return qnas;
    },
    staleTime: 60 * 1000,
  });
}

export function useUserSimpleQnAs(userId: string | null) {
  return useQuery({
    queryKey: qnaKeys.user(userId || ''),
    queryFn: () => QnAService.getUserQnAs(userId!),
    enabled: !!userId,
    staleTime: 60 * 1000,
  });
}

export function useQnAWithAccess(qnaId: string | null, password?: string) {
  return useQuery({
    queryKey: qnaKeys.detail(qnaId || '', password),
    queryFn: () => QnAService.getQnAWithAccessCheck(qnaId!, password),
    enabled: !!qnaId,
    staleTime: 30 * 1000,
  });
}

export function useCreateSimpleQnA(
  user: { uid: string; email?: string | null; displayName?: string | null } | null
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateQnAData) =>
      QnAService.createQnA(user!.uid, user!.email || '', user!.displayName || 'User', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qnaKeys.all });
    },
  });
}

export function useQnAAccessCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ qnaId, password }: { qnaId: string; password?: string }) =>
      QnAService.getQnAWithAccessCheck(qnaId, password),
    onSuccess: (result, variables) => {
      if (result.qna) {
        queryClient.setQueryData(qnaKeys.detail(variables.qnaId, variables.password), result);
      }
    },
  });
}

export function useAnswerQnA() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ qnaId, answer }: { qnaId: string; answer: Omit<QnAAnswer, 'answeredAt'> }) =>
      QnAService.answerQnA(qnaId, answer),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qnaKeys.all });
    },
  });
}

export type { QnA };
