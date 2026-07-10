import { DashboardService } from './dashboardService';
import { CouponService } from './couponService';
import { EventService } from './eventService';
import { AdminUserService } from './adminUserService';
import { SimpleQnAService } from './simpleQnAService';
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

jest.mock('./simpleQnAService', () => ({
  SimpleQnAService: {
    getAllQnAs: jest.fn(),
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
    jest.mocked(SimpleQnAService.getAllQnAs).mockResolvedValue([]);
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

  it('excludes cancelled, returned, and exchanged orders from net sales aggregates', async () => {
    const now = new Date();
    const baseOrder = {
      userId: 'user-1',
      orderNumber: 'ORD-1',
      products: [{
        id: 'item-1',
        productId: 'product-1',
        productName: '테스트 상품',
        productImage: '',
        size: 'M',
        color: 'black',
        quantity: 1,
        price: 10000,
        discountAmount: 0,
        brand: 'TEST',
      }],
      createdAt: now,
      updatedAt: now,
    };

    jest.mocked(ProductService.getAllProducts).mockResolvedValue([{
      id: 'product-1',
      name: '테스트 상품',
      description: '테스트 상품 설명',
      brand: 'TEST',
      price: 10000,
      category: 'tops',
      images: [],
      sizes: [],
      colors: [],
      stock: 10,
      rating: 0,
      reviewCount: 0,
      isNew: false,
      isSale: false,
      saleRate: 0,
      tags: [],
      details: {
        material: '',
        origin: '',
        manufacturer: '',
        precautions: '',
        sizes: {},
      },
      createdAt: now,
      updatedAt: now,
    }]);
    jest.mocked(OrderService.getAllOrders).mockResolvedValue([
      { ...baseOrder, id: 'confirmed', status: 'confirmed', finalAmount: 10000 },
      { ...baseOrder, id: 'cancelled', status: 'cancelled', finalAmount: 20000 },
      { ...baseOrder, id: 'returned', status: 'returned', finalAmount: 30000 },
      { ...baseOrder, id: 'exchanged', status: 'exchanged', finalAmount: 40000 },
    ]);

    const stats = await DashboardService.getDashboardStats();

    expect(stats.totalOrders).toBe(4);
    expect(stats.totalRevenue).toBe(10000);
    expect(stats.excludedRevenueOrderCount).toBe(3);
    expect(stats.categoryBreakdown).toEqual([{ categoryId: 'tops', value: 1 }]);
    expect(stats.topSellingProducts.map((product) => product.id)).toEqual(['product-1']);
  });
});
