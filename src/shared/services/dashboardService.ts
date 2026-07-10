import { CouponService } from './couponService';
import { EventService } from './eventService';
import { AdminUserData, AdminUserService } from './adminUserService';
import { SimpleQnAService } from './simpleQnAService';
import { InquiryService } from './inquiryService';
import { OrderService } from './orderService';
import { ProductService } from './productService';
import { Coupon } from '@/shared/types/coupon';
import { Event } from '@/shared/types/event';
import { QnA } from '@/shared/types/qna';
import { Inquiry } from '@/shared/types/inquiry';
import { Order } from '@/shared/types/order';
import { Product } from '@/shared/types/product';

export interface DashboardStats {
  totalUsers: number;
  totalProducts: number;
  totalCoupons: number;
  activeEvents: number;
  totalQnAs: number;
  totalInquiries: number;
  totalOrders: number;
  totalRevenue: number;
  excludedRevenueOrderCount: number;
  qnaStats: {
    waiting: number;
    answered: number;
    closed: number;
  };
  inquiryStats: {
    waiting: number;
    answered: number;
    closed: number;
  };
  monthlyGrowth: {
    users: number;
    products: number;
    coupons: number;
    events: number;
    qnas: number;
    inquiries: number;
    orders: number;
    revenue: number;
  };
  recentActivities: DashboardActivity[];
  lowStockProducts: Product[];
  topSellingProducts: Product[];
  orderStatusStats: Record<string, number>;
  revenueByMonth: { month: string; revenue: number }[];
  categoryBreakdown: { categoryId: string; value: number }[];
  categoryBreakdownType: 'sales' | 'products';
  dataAvailability: {
    users: boolean;
    products: boolean;
    coupons: boolean;
    events: boolean;
    qnas: boolean;
    inquiries: boolean;
    orders: boolean;
  };
}

export interface DashboardActivity {
  id: string;
  type: 'order' | 'user' | 'product' | 'coupon' | 'event';
  title: string;
  description: string;
  timestamp: Date;
  priority: 'low' | 'medium' | 'high';
}

export class DashboardService {
  static async getDashboardStats(): Promise<DashboardStats> {
    const [
      couponsResult,
      eventsResult,
      usersResult,
      qnasResult,
      inquiriesResult,
      productsResult,
      ordersResult,
    ] = await Promise.allSettled([
      CouponService.getActiveCoupons(),
      EventService.getActiveEvents(),
      AdminUserService.getAllUsersSimple(),
      SimpleQnAService.getAllQnAs(100),
      InquiryService.getAllInquiries(100),
      ProductService.getAllProducts(),
      OrderService.getAllOrders(1000),
    ]);

    const coupons = DashboardService.resolveSettledValue(couponsResult, '쿠폰', []);
    const events = DashboardService.resolveSettledValue(eventsResult, '이벤트', []);
    const users = DashboardService.resolveSettledValue(usersResult, '사용자', []);
    const qnas = DashboardService.resolveSettledValue(qnasResult, 'QnA', []);
    const inquiries = DashboardService.resolveSettledValue(inquiriesResult, '문의', []);
    const products = DashboardService.resolveSettledValue(productsResult, '상품', []);
    const orders = DashboardService.resolveSettledValue(ordersResult, '주문', []);

    const dataAvailability = {
      users: usersResult.status === 'fulfilled',
      products: productsResult.status === 'fulfilled',
      coupons: couponsResult.status === 'fulfilled',
      events: eventsResult.status === 'fulfilled',
      qnas: qnasResult.status === 'fulfilled',
      inquiries: inquiriesResult.status === 'fulfilled',
      orders: ordersResult.status === 'fulfilled',
    };

    const qnaStats = {
      waiting: qnas.filter((qna) => qna.status === 'waiting').length,
      answered: qnas.filter((qna) => qna.status === 'answered').length,
      closed: qnas.filter((qna) => qna.status === 'closed').length,
    };

    const inquiryStats = {
      waiting: inquiries.filter((inquiry) => inquiry.status === 'waiting').length,
      answered: inquiries.filter((inquiry) => inquiry.status === 'answered').length,
      closed: inquiries.filter((inquiry) => inquiry.status === 'closed').length,
    };

    const revenueOrders = DashboardService.getRevenueOrders(orders);
    const categoryBreakdown = DashboardService.getCategoryBreakdown(products, revenueOrders);

    return {
      totalUsers: users.length,
      totalProducts: products.length,
      totalCoupons: coupons.length,
      activeEvents: events.length,
      totalQnAs: qnas.length,
      totalInquiries: inquiries.length,
      totalOrders: orders.length,
      totalRevenue: revenueOrders.reduce((sum, order) => sum + order.finalAmount, 0),
      excludedRevenueOrderCount: orders.length - revenueOrders.length,
      qnaStats,
      inquiryStats,
      monthlyGrowth: {
        users: DashboardService.calculateGrowthForCount(users, (user) => user.createdAt),
        products: DashboardService.calculateGrowthForCount(products, (product) => product.createdAt),
        coupons: DashboardService.calculateGrowthForCount(coupons, (coupon) => coupon.createdAt),
        events: DashboardService.calculateGrowthForCount(events, (event) => event.createdAt),
        qnas: DashboardService.calculateGrowthForCount(qnas, (qna) => qna.createdAt),
        inquiries: DashboardService.calculateGrowthForCount(inquiries, (inquiry) => inquiry.createdAt),
        orders: DashboardService.calculateGrowthForCount(orders, (order) => order.createdAt),
        revenue: DashboardService.calculateGrowthForValue(
          revenueOrders,
          (order) => order.createdAt,
          (order) => order.finalAmount
        ),
      },
      recentActivities: DashboardService.generateRecentActivities(users, coupons, events, qnas, inquiries, orders, products),
      lowStockProducts: products
        .filter((product) => product.stock > 0 && product.stock <= 5)
        .sort((left, right) => left.stock - right.stock)
        .slice(0, 5),
      topSellingProducts: DashboardService.getTopSellingProducts(products, revenueOrders),
      orderStatusStats: DashboardService.getOrderStatusStats(orders),
      revenueByMonth: DashboardService.getRevenueByMonth(revenueOrders),
      categoryBreakdown: categoryBreakdown.data,
      categoryBreakdownType: categoryBreakdown.type,
      dataAvailability,
    };
  }

  static async getRealtimeStats(): Promise<Partial<DashboardStats>> {
    try {
      const users = await AdminUserService.getAllUsersSimple();

      return {
        totalUsers: users.length,
      };
    } catch (error) {
      console.error('실시간 대시보드 통계 조회 실패:', error);
      throw error;
    }
  }

  private static resolveSettledValue<T>(
    result: PromiseSettledResult<T>,
    label: string,
    fallback: T
  ): T {
    if (result.status === 'fulfilled') {
      return result.value;
    }

    console.warn(`${label} 데이터 조회 실패:`, result.reason);
    return fallback;
  }

  private static getPeriodBoundaries() {
    const now = new Date();
    const currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const previousStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    return { now, currentStart, previousStart };
  }

  private static isWithinRange(target: Date, start: Date, end: Date) {
    const time = target.getTime();
    return time >= start.getTime() && time < end.getTime();
  }

  private static calculateGrowthForCount<T>(
    items: T[],
    getDate: (item: T) => Date
  ): number {
    const { now, currentStart, previousStart } = DashboardService.getPeriodBoundaries();

    const current = items.filter((item) =>
      DashboardService.isWithinRange(getDate(item), currentStart, now)
    ).length;

    const previous = items.filter((item) =>
      DashboardService.isWithinRange(getDate(item), previousStart, currentStart)
    ).length;

    return DashboardService.calculateGrowthRate(current, previous);
  }

  private static calculateGrowthForValue<T>(
    items: T[],
    getDate: (item: T) => Date,
    getValue: (item: T) => number
  ): number {
    const { now, currentStart, previousStart } = DashboardService.getPeriodBoundaries();

    const current = items.reduce((sum, item) => {
      if (!DashboardService.isWithinRange(getDate(item), currentStart, now)) {
        return sum;
      }
      return sum + getValue(item);
    }, 0);

    const previous = items.reduce((sum, item) => {
      if (!DashboardService.isWithinRange(getDate(item), previousStart, currentStart)) {
        return sum;
      }
      return sum + getValue(item);
    }, 0);

    return DashboardService.calculateGrowthRate(current, previous);
  }

  private static getRevenueByMonth(orders: Order[]): { month: string; revenue: number }[] {
    const months: { month: string; revenue: number }[] = [];
    const now = new Date();

    for (let offset = 5; offset >= 0; offset -= 1) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
      months.push({ month: monthKey, revenue: 0 });
    }

    const monthMap = new Map(months.map((item) => [item.month, item]));

    orders.forEach((order) => {
      const monthKey = `${order.createdAt.getFullYear()}-${String(order.createdAt.getMonth() + 1).padStart(2, '0')}`;
      const target = monthMap.get(monthKey);
      if (target) {
        target.revenue += order.finalAmount;
      }
    });

    return months;
  }

  private static normalizeOrderStatus(status: string): string {
    const statusMap: Record<string, string> = {
      결제대기: 'pending',
      주문확인: 'confirmed',
      상품준비중: 'preparing',
      배송중: 'shipped',
      배송완료: 'delivered',
      취소: 'cancelled',
      교환: 'exchanged',
      반품: 'returned',
      pending: 'pending',
      confirmed: 'confirmed',
      preparing: 'preparing',
      shipped: 'shipped',
      delivered: 'delivered',
      cancelled: 'cancelled',
      exchanged: 'exchanged',
      returned: 'returned',
    };

    return statusMap[status] || status;
  }

  private static getRevenueOrders(orders: Order[]): Order[] {
    const excludedStatuses = new Set(['cancelled', 'returned', 'exchanged']);

    return orders.filter((order) => !excludedStatuses.has(
      DashboardService.normalizeOrderStatus(order.status)
    ));
  }

  private static getOrderStatusStats(orders: Order[]): Record<string, number> {
    return orders.reduce<Record<string, number>>((accumulator, order) => {
      const key = DashboardService.normalizeOrderStatus(order.status);
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {});
  }

  private static getCategoryBreakdown(products: Product[], orders: Order[]) {
    const productCategoryMap = new Map<string, string>();
    products.forEach((product) => {
      const categoryId = product.categoryId || product.category;
      if (categoryId) {
        productCategoryMap.set(product.id, categoryId);
      }
    });

    const salesMap = new Map<string, number>();
    orders.forEach((order) => {
      order.products.forEach((item) => {
        const categoryId = productCategoryMap.get(item.productId);
        if (!categoryId) {
          return;
        }
        salesMap.set(categoryId, (salesMap.get(categoryId) || 0) + Math.max(item.quantity, 1));
      });
    });

    const salesData = DashboardService.toTopCategoryData(salesMap);
    if (salesData.some((item) => item.value > 0)) {
      return {
        data: salesData,
        type: 'sales' as const,
      };
    }

    const productCountMap = new Map<string, number>();
    products.forEach((product) => {
      const categoryId = product.categoryId || product.category;
      if (!categoryId) {
        return;
      }
      productCountMap.set(categoryId, (productCountMap.get(categoryId) || 0) + 1);
    });

    return {
      data: DashboardService.toTopCategoryData(productCountMap),
      type: 'products' as const,
    };
  }

  private static toTopCategoryData(categoryMap: Map<string, number>) {
    return Array.from(categoryMap.entries())
      .map(([categoryId, value]) => ({ categoryId, value }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 5);
  }

  private static getTopSellingProducts(products: Product[], orders: Order[]): Product[] {
    const soldQuantityMap = new Map<string, number>();

    orders.forEach((order) => {
      order.products.forEach((item) => {
        soldQuantityMap.set(item.productId, (soldQuantityMap.get(item.productId) || 0) + Math.max(item.quantity, 1));
      });
    });

    return [...products]
      .sort((left, right) => (soldQuantityMap.get(right.id) || 0) - (soldQuantityMap.get(left.id) || 0))
      .filter((product) => (soldQuantityMap.get(product.id) || 0) > 0)
      .slice(0, 5);
  }

  private static generateRecentActivities(
    users: AdminUserData[],
    coupons: Coupon[],
    events: Event[],
    qnas: QnA[],
    inquiries: Inquiry[],
    orders: Order[],
    products: Product[]
  ): DashboardActivity[] {
    const activities: DashboardActivity[] = [];

    users
      .slice()
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, 2)
      .forEach((user) => {
        activities.push({
          id: `user-${user.id}`,
          type: 'user',
          title: '신규 회원 가입',
          description: `${user.name} 사용자가 새로 가입했습니다.`,
          timestamp: user.createdAt,
          priority: 'low',
        });
      });

    orders
      .slice()
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, 2)
      .forEach((order) => {
        activities.push({
          id: `order-${order.id}`,
          type: 'order',
          title: '신규 주문 접수',
          description: `${order.orderNumber} 주문이 접수되었습니다.`,
          timestamp: order.createdAt,
          priority: order.status === 'pending' ? 'high' : 'medium',
        });
      });

    qnas
      .slice()
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, 2)
      .forEach((qna) => {
        activities.push({
          id: `qna-${qna.id}`,
          type: 'user',
          title: 'QnA 문의 등록',
          description: `새 QnA 문의가 등록되었습니다. ${qna.title.slice(0, 24)}`,
          timestamp: qna.createdAt,
          priority: qna.status === 'waiting' ? 'high' : 'medium',
        });
      });

    inquiries
      .slice()
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, 2)
      .forEach((inquiry) => {
        activities.push({
          id: `inquiry-${inquiry.id}`,
          type: 'user',
          title: '1:1 문의 등록',
          description: `새 고객 문의가 등록되었습니다. ${inquiry.title.slice(0, 24)}`,
          timestamp: inquiry.createdAt,
          priority: inquiry.status === 'waiting' ? 'high' : 'medium',
        });
      });

    if (products.length > 0) {
      const latestProduct = [...products].sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime()
      )[0];

      activities.push({
        id: `product-${latestProduct.id}`,
        type: 'product',
        title: '최근 등록 상품',
        description: `${latestProduct.name} 상품이 최근 등록 목록에 있습니다.`,
        timestamp: latestProduct.createdAt,
        priority: 'low',
      });
    }

    if (coupons.length > 0) {
      activities.push({
        id: 'coupon-summary',
        type: 'coupon',
        title: '쿠폰 운영 현황',
        description: `${coupons.length}개의 활성 쿠폰이 운영 중입니다.`,
        timestamp: new Date(),
        priority: 'medium',
      });
    }

    if (events.length > 0) {
      activities.push({
        id: 'event-summary',
        type: 'event',
        title: '이벤트 운영 현황',
        description: `${events.length}개의 활성 이벤트가 진행 중입니다.`,
        timestamp: new Date(),
        priority: 'medium',
      });
    }

    if (activities.length === 0) {
      activities.push({
        id: 'system-check',
        type: 'user',
        title: '시스템 상태 체크',
        description: '대시보드 데이터를 표시할 수 있는 항목이 아직 없습니다.',
        timestamp: new Date(),
        priority: 'low',
      });
    }

    return activities
      .sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime())
      .slice(0, 8);
  }

  static formatTimeAgo(timestamp: Date): string {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    return `${days}일 전`;
  }

  static formatNumber(num: number): string {
    return new Intl.NumberFormat('ko-KR').format(num);
  }

  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  }

  static calculateGrowthRate(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }

    return Math.round(((current - previous) / previous) * 100);
  }
}
