export const cartKeys = {
  all: ['cart'] as const,
  lists: () => [...cartKeys.all, 'list'] as const,
  list: (userId: string) => [...cartKeys.lists(), userId] as const,
  count: (userId: string) => [...cartKeys.all, 'count', userId] as const,
};

export const pointKeys = {
  all: (userId: string) => ['points', userId] as const,
  balance: (userId: string) => ['points', userId, 'balance'] as const,
  history: (userId: string, limit: number) => ['points', userId, 'history', limit] as const,
};

export const orderKeys = {
  all: (userId: string) => ['orders', userId] as const,
  list: (userId: string, limit: number) => ['orders', userId, 'list', limit] as const,
  count: (userId: string) => ['orders', userId, 'count'] as const,
};

export const categoryKeys = {
  all: ['categories'] as const,
  list: () => [...categoryKeys.all, 'list'] as const,
  withNames: () => [...categoryKeys.all, 'with-names'] as const,
  order: () => [...categoryKeys.all, 'order'] as const,
};

export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...productKeys.lists(), filters] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (productId: string) => [...productKeys.details(), productId] as const,
  home: () => [...productKeys.all, 'home'] as const,
  related: (productId: string, limit: number) => [
    ...productKeys.all,
    'related',
    productId,
    limit,
  ] as const,
  featured: () => [...productKeys.all, 'featured'] as const,
};

export const eventKeys = {
  all: ['events'] as const,
  list: (filters: Record<string, unknown> = {}) => [...eventKeys.all, 'list', filters] as const,
  detail: (eventId: string) => [...eventKeys.all, 'detail', eventId] as const,
};

export const activityKeys = {
  all: (userId: string) => ['activity', userId] as const,
  recent: (userId: string, limit: number) => ['activity', userId, 'recent', limit] as const,
  wishlist: (userId: string) => ['activity', userId, 'wishlist'] as const,
};

export const couponKeys = {
  all: (userId: string) => ['coupons', userId] as const,
  list: (userId: string) => ['coupons', userId, 'list'] as const,
  stats: (userId: string) => ['coupons', userId, 'stats'] as const,
  availableOrderCandidates: (userId: string) => [
    ...couponKeys.all(userId),
    'available-order-candidates',
  ] as const,
  availableOrderCandidatesVersion: (userId: string, revision: number) => [
    ...couponKeys.availableOrderCandidates(userId),
    revision,
  ] as const,
};

export const reviewKeys = {
  all: ['reviews'] as const,
  list: (filters: Record<string, unknown>) => [...reviewKeys.all, 'list', filters] as const,
  product: (productId: string) => [...reviewKeys.all, 'product', productId] as const,
  summary: (productId: string) => [...reviewKeys.all, 'summary', productId] as const,
};
