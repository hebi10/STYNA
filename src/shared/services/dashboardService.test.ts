import { DashboardService } from './dashboardService';
import { CouponService } from './couponService';
import { EventService } from './eventService';
import { AdminUserService } from './adminUserService';
import { QnAService } from './qnaService';
import { InquiryService } from './inquiryService';
import { ProductService } from './productService';
import { OrderService } from './orderService';

jest.mock('./couponService', () => ({
  CouponService: {
    getActiveCoupons: jest.fn(),
  },
}));

jest.mock('./eventService', () => ({
  EventService: {
    getActiveEvents: jest.fn(),
  },
}));

jest.mock('./adminUserService', () => ({
  AdminUserService: {
    getAllUsersSimple: jest.fn(),
  },
}));

jest.mock('./qnaService', () => ({
  QnAService: {
    getQnAList: jest.fn(),
  },
}));

jest.mock('./inquiryService', () => ({
  InquiryService: {
    getAllInquiries: jest.fn(),
  },
}));

jest.mock('./productService', () => ({
  ProductService: {
    getAllProducts: jest.fn(),
  },
}));

jest.mock('./orderService', () => ({
  OrderService: {
    getAllOrders: jest.fn(),
  },
}));

describe('DashboardService', () => {
  beforeEach(() => {
    jest.mocked(CouponService.getActiveCoupons).mockResolvedValue([]);
    jest.mocked(EventService.getActiveEvents).mockResolvedValue([]);
    jest.mocked(AdminUserService.getAllUsersSimple).mockResolvedValue([]);
    jest.mocked(QnAService.getQnAList).mockResolvedValue({
      qnas: [],
      pagination: {
        page: 1,
        limit: 100,
        totalCount: 0,
        totalPages: 0,
      },
    });
    jest.mocked(InquiryService.getAllInquiries).mockResolvedValue([]);
    jest.mocked(ProductService.getAllProducts).mockResolvedValue([]);
    jest.mocked(OrderService.getAllOrders).mockResolvedValue([]);
  });

  it('supports detached query function calls', async () => {
    const getDashboardStats = DashboardService.getDashboardStats;

    await expect(getDashboardStats()).resolves.toMatchObject({
      totalUsers: 0,
      totalProducts: 0,
      totalCoupons: 0,
      totalOrders: 0,
      recentActivities: [
        expect.objectContaining({
          id: 'system-check',
        }),
      ],
    });
  });
});
