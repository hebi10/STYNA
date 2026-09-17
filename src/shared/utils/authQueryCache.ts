import type { QueryClient } from "@tanstack/react-query";
import {
  activityKeys,
  cartKeys,
  couponKeys,
  orderKeys,
  pointKeys,
  userKeys,
} from "@/shared/hooks/queryKeys";

export function clearAuthenticatedUserCache(queryClient: QueryClient, userId: string) {
  queryClient.removeQueries({ queryKey: userKeys.detail(userId) });
  queryClient.removeQueries({ queryKey: cartKeys.list(userId) });
  queryClient.removeQueries({ queryKey: cartKeys.count(userId) });
  queryClient.removeQueries({ queryKey: pointKeys.all(userId) });
  queryClient.removeQueries({ queryKey: orderKeys.all(userId) });
  queryClient.removeQueries({ queryKey: activityKeys.all(userId) });
  queryClient.removeQueries({ queryKey: couponKeys.all(userId) });
}
