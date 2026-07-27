import { metadata as adminMetadata } from './admin/layout';
import { metadata as authMetadata } from './auth/layout';
import { metadata as myPageMetadata } from './mypage/layout';
import { metadata as ordersMetadata } from './orders/layout';

jest.mock('@/context/authProvider', () => ({ useAuth: jest.fn() }));
jest.mock('@/context/couponProvider', () => ({
  useCoupon: jest.fn(),
  CouponProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/context/userActivityProvider', () => ({
  UserActivityProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/shared/hooks/useOrders', () => ({ useOrderCount: jest.fn() }));
jest.mock('./mypage/_components', () => ({
  ProfileSection: () => null,
  QuickActions: () => null,
  SidebarMenu: () => null,
}));
jest.mock('./mypage/layout.module.css', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('./auth/layout.module.css', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('./_components/PageHeader', () => () => null);
jest.mock('./admin/_components/adminNav', () => () => null);
jest.mock('./admin/_components/AuthChecking', () => ({ children }: { children: React.ReactNode }) => children);
jest.mock('./admin/layout.module.css', () => ({
  __esModule: true,
  default: {},
}));

describe('private route metadata', () => {
  test.each([
    ['admin', adminMetadata],
    ['auth', authMetadata],
    ['mypage', myPageMetadata],
    ['orders', ordersMetadata],
  ])('%s route is excluded from indexing', (_route, metadata) => {
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates).toBeUndefined();
  });
});
