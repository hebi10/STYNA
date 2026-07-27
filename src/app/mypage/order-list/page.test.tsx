import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import OrderListPage from './page';
import { useAuth } from '@/context/authProvider';
import { useCoupon } from '@/context/couponProvider';
import { OrderService } from '@/shared/services/orderService';
import { useOrderCount, useOrders } from '@/shared/hooks/useOrders';
import { pointKeys } from '@/shared/hooks/queryKeys';

const mockInvalidateQueries = jest.fn().mockResolvedValue(undefined);
const mockRefetch = jest.fn().mockResolvedValue(undefined);

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <span data-testid="product-image">{alt}</span>,
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

jest.mock('@/context/authProvider', () => ({ useAuth: jest.fn() }));
jest.mock('@/context/couponProvider', () => ({ useCoupon: jest.fn() }));
jest.mock('@/shared/services/orderService', () => ({
  OrderService: { cancelOrder: jest.fn() },
}));
jest.mock('@/shared/hooks/useOrders', () => ({
  orderKeys: { all: (userId: string) => ['orders', userId] },
  useOrderCount: jest.fn(),
  useOrders: jest.fn(),
}));
jest.mock('./page.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, { get: (_target, property) => String(property) }),
}));

describe('OrderListPage cancellation refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAuth).mockReturnValue({ user: { uid: 'user-1' }, loading: false } as never);
    jest.mocked(useCoupon).mockReturnValue({ refreshUserCoupons: jest.fn() } as never);
    jest.mocked(useOrderCount).mockReturnValue({
      data: 1,
      isLoading: false,
      isError: false,
    } as never);
    jest.mocked(useOrders).mockReturnValue({
      data: [{
        id: 'order-1',
        orderNumber: 'ORD-1',
        status: 'pending',
        finalAmount: 12000,
        discountAmount: 0,
        createdAt: new Date('2026-07-21T00:00:00.000Z'),
        products: [],
      }],
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: mockRefetch,
    } as never);
    jest.mocked(OrderService.cancelOrder).mockResolvedValue(undefined);
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    jest.spyOn(window, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('refreshes restored point and coupon state after a successful cancellation', async () => {
    const refreshUserCoupons = jest.fn().mockResolvedValue(undefined);
    jest.mocked(useCoupon).mockReturnValue({ refreshUserCoupons } as never);

    render(<OrderListPage />);
    fireEvent.click(screen.getByRole('button', { name: '주문취소' }));

    await waitFor(() => expect(OrderService.cancelOrder).toHaveBeenCalledWith('order-1', '고객 직접 취소'));
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['orders', 'user-1'],
      refetchType: 'none',
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: pointKeys.all('user-1') });
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    expect(refreshUserCoupons).toHaveBeenCalledTimes(1);
  });

  test('filters orders by the selected calendar period', () => {
    const now = new Date();
    const recentCreatedAt = new Date(now);
    recentCreatedAt.setDate(recentCreatedAt.getDate() - 5);
    const oldCreatedAt = new Date(now);
    oldCreatedAt.setMonth(oldCreatedAt.getMonth() - 2);

    jest.mocked(useOrders).mockReturnValue({
      data: [
        {
          id: 'recent-order',
          orderNumber: 'ORD-RECENT',
          status: 'pending',
          finalAmount: 12000,
          createdAt: recentCreatedAt,
          products: [],
        },
        {
          id: 'old-order',
          orderNumber: 'ORD-OLD',
          status: 'shipped',
          finalAmount: 24000,
          createdAt: oldCreatedAt,
          products: [],
        },
      ],
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: mockRefetch,
    } as never);

    render(<OrderListPage />);

    expect(screen.getByText('ORD-RECENT')).toBeInTheDocument();
    expect(screen.getByText('ORD-OLD')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '1개월' }));

    expect(screen.getByText('ORD-RECENT')).toBeInTheDocument();
    expect(screen.queryByText('ORD-OLD')).not.toBeInTheDocument();
  });

  test('exposes the selected order status with aria-pressed', () => {
    render(<OrderListPage />);

    const allButton = screen.getByRole('button', { name: '전체' });
    const pendingButton = screen.getByRole('button', { name: '결제 대기' });
    expect(allButton).toHaveAttribute('aria-pressed', 'true');
    expect(pendingButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(pendingButton);

    expect(allButton).toHaveAttribute('aria-pressed', 'false');
    expect(pendingButton).toHaveAttribute('aria-pressed', 'true');
  });

  test('defines status-dot colors with English order status keys', () => {
    const css = fs.readFileSync(path.join(__dirname, 'page.module.css'), 'utf8');

    expect(css).toContain('.statusDot.status-pending');
    expect(css).toContain('.statusDot.status-shipped');
    expect(css).toContain('.statusDot.status-delivered');
    expect(css).not.toMatch(/\.statusDot\.status-(배송완료|배송중|주문확인|취소|교환|반품)/);
  });

  test('normalizes legacy statuses for filters and status color classes', () => {
    jest.mocked(useOrders).mockReturnValue({
      data: [{
        id: 'legacy-delivered',
        orderNumber: 'ORD-LEGACY',
        status: '배송완료',
        finalAmount: 12000,
        createdAt: new Date(),
        products: [],
      }],
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: mockRefetch,
    } as never);

    const { container } = render(<OrderListPage />);
    fireEvent.click(screen.getByRole('button', { name: '배송완료' }));

    expect(screen.getByText('ORD-LEGACY')).toBeInTheDocument();
    expect(container.querySelector('.status-delivered')).toBeInTheDocument();
  });

  test('normalizes legacy statuses for order actions and cancellation guidance', () => {
    jest.mocked(useOrders).mockReturnValue({
      data: [
        {
          id: 'legacy-confirmed',
          orderNumber: 'ORD-CONFIRMED',
          status: '주문확인',
          finalAmount: 12000,
          createdAt: new Date(),
          products: [],
        },
        {
          id: 'legacy-shipped',
          orderNumber: 'ORD-SHIPPED',
          status: '배송중',
          finalAmount: 12000,
          createdAt: new Date(),
          products: [],
        },
        {
          id: 'legacy-delivered',
          orderNumber: 'ORD-DELIVERED',
          status: '배송완료',
          finalAmount: 12000,
          createdAt: new Date(),
          products: [],
        },
      ],
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: mockRefetch,
    } as never);

    const { container } = render(<OrderListPage />);
    const confirmedCard = screen.getByText('ORD-CONFIRMED').closest('.orderCard');
    const shippedCard = screen.getByText('ORD-SHIPPED').closest('.orderCard');
    const deliveredCard = screen.getByText('ORD-DELIVERED').closest('.orderCard');

    expect(confirmedCard).not.toBeNull();
    expect(shippedCard).not.toBeNull();
    expect(deliveredCard).not.toBeNull();
    expect(within(confirmedCard as HTMLElement).getByRole('button', { name: '주문취소' })).toBeInTheDocument();
    expect(within(shippedCard as HTMLElement).getByRole('link', { name: '배송조회' })).toBeInTheDocument();
    expect(within(shippedCard as HTMLElement).getByText(/자동 취소를 지원하지 않습니다/)).toBeInTheDocument();
    expect(within(deliveredCard as HTMLElement).getByRole('link', { name: '배송조회' })).toBeInTheDocument();
    expect(within(deliveredCard as HTMLElement).getByText(/리뷰는 주문 상품 상세/)).toBeInTheDocument();
    expect(container.querySelectorAll('.orderCard')).toHaveLength(3);
  });

  test('explains when the selected period has no matching orders', () => {
    const oldCreatedAt = new Date();
    oldCreatedAt.setMonth(oldCreatedAt.getMonth() - 4);
    jest.mocked(useOrders).mockReturnValue({
      data: [{
        id: 'old-order',
        orderNumber: 'ORD-OLD',
        status: 'pending',
        finalAmount: 12000,
        createdAt: oldCreatedAt,
        products: [],
      }],
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: mockRefetch,
    } as never);

    render(<OrderListPage />);

    expect(screen.getByText('선택한 3개월 기간에 해당하는 주문이 없습니다.')).toBeInTheDocument();
    expect(screen.queryByText('아직 주문하신 상품이 없습니다.')).not.toBeInTheDocument();
  });

  test('disables manual refresh while a background refetch is running', () => {
    jest.mocked(useOrders).mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: true,
      error: null,
      refetch: mockRefetch,
    } as never);

    render(<OrderListPage />);

    expect(screen.getByRole('button', { name: '새로고침 중...' })).toBeDisabled();
  });
});
