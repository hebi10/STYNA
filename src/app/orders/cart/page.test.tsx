import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useAuth } from '@/context/authProvider';
import { useCoupon } from '@/context/couponProvider';
import {
  useCart,
  useRemoveFromCart,
  useUpdateCartItem,
} from '@/shared/hooks/useCart';
import { formatShippingPolicy } from '@/shared/constants/commercePolicy';
import OrderCartPage from './page';

const mockPush = jest.fn();
const mockGetAvailableCouponsForOrder = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

jest.mock('../../_components/PageHeader', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

jest.mock('../../_components/Button', () => ({
  __esModule: true,
  default: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock('@/context/authProvider', () => ({ useAuth: jest.fn() }));
jest.mock('@/context/couponProvider', () => ({ useCoupon: jest.fn() }));
jest.mock('@/shared/hooks/useCart', () => ({
  useCart: jest.fn(),
  useUpdateCartItem: jest.fn(),
  useRemoveFromCart: jest.fn(),
}));

jest.mock('./page.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, property) => String(property),
  }),
}));

describe('OrderCartPage policy copy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAvailableCouponsForOrder.mockResolvedValue([]);
    jest.mocked(useAuth).mockReturnValue({
      user: { uid: 'user-1' },
      userData: {},
      loading: false,
    } as unknown as ReturnType<typeof useAuth>);
    jest.mocked(useCoupon).mockReturnValue({
      userCoupons: [makeUserCoupon('user-coupon-1', '20,000원 할인', 20000)],
      getAvailableCouponsForOrder: mockGetAvailableCouponsForOrder,
    } as unknown as ReturnType<typeof useCoupon>);
    jest.mocked(useCart).mockReturnValue({
      data: {
        id: 'cart-1',
        userId: 'user-1',
        items: [{
          id: 'cart-item-1',
          productId: 'product-1',
          productName: '테스트 상품',
          productImage: '/product.webp',
          brand: 'STYNA',
          size: 'M',
          color: 'black',
          quantity: 1,
          price: 60000,
          discountAmount: 0,
          isAvailable: true,
        }],
        totalAmount: 60000,
        totalItems: 1,
        updatedAt: new Date(),
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useCart>);
    jest.mocked(useUpdateCartItem).mockReturnValue({
      mutateAsync: jest.fn(),
    } as unknown as ReturnType<typeof useUpdateCartItem>);
    jest.mocked(useRemoveFromCart).mockReturnValue({
      mutateAsync: jest.fn(),
    } as unknown as ReturnType<typeof useRemoveFromCart>);
  });

  test('uses the post-coupon standard threshold and makes no delivery SLA or point promise', async () => {
    const { container } = render(<OrderCartPage />);

    expect(await screen.findByText('테스트 상품')).toBeInTheDocument();
    expect(container.textContent).toContain(formatShippingPolicy());
    expect(container.textContent).toContain('특급 배송 옵션(데모)');
    expect(container.textContent).not.toMatch(
      /당일\/익일|당일 출고|구매 시 적립금|구매.*1%|골드 회원 추가 할인/,
    );

    const standardOption = screen.getByRole('radio', { name: /일반 배송/ }).closest('label');
    expect(standardOption).not.toBeNull();
    expect(within(standardOption as HTMLElement).getByText('무료')).toBeInTheDocument();

    await waitFor(() => expect(mockGetAvailableCouponsForOrder).toHaveBeenCalledWith(60000));
    await waitFor(() => expect(screen.getByRole('combobox')).toBeEnabled());

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'user-coupon-1' },
    });

    await waitFor(() => {
      expect(within(standardOption as HTMLElement).getByText('3,000원')).toBeInTheDocument();
    });
  });

  test('adds a usable coupon outside the overview through the full order lookup', async () => {
    mockGetAvailableCouponsForOrder.mockResolvedValue([
      makeUserCoupon('older-coupon', '오래된 쿠폰', 5000),
    ]);

    render(<OrderCartPage />);

    await waitFor(() => expect(mockGetAvailableCouponsForOrder).toHaveBeenCalledWith(60000));
    expect(await screen.findByRole('option', { name: /오래된 쿠폰/ })).toBeInTheDocument();
  });

  test('shows a safe error when the full order coupon lookup fails', async () => {
    mockGetAvailableCouponsForOrder.mockRejectedValue(new Error('full lookup failed'));

    render(<OrderCartPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('사용 가능한 쿠폰 전체를 불러오지 못했습니다');
  });

  test('does not silently drop a selected coupon when a later full lookup fails', async () => {
    const olderCoupon = makeUserCoupon('older-coupon', '오래된 쿠폰', 5000);
    mockGetAvailableCouponsForOrder.mockResolvedValueOnce([olderCoupon]);
    jest.mocked(useCoupon).mockReturnValue({
      userCoupons: [],
      getAvailableCouponsForOrder: mockGetAvailableCouponsForOrder,
    } as unknown as ReturnType<typeof useCoupon>);
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => undefined);
    const { rerender } = render(<OrderCartPage />);

    const couponSelect = await screen.findByRole('combobox');
    await waitFor(() => expect(couponSelect).toBeEnabled());
    fireEvent.change(couponSelect, { target: { value: olderCoupon.id } });

    mockGetAvailableCouponsForOrder.mockRejectedValueOnce(new Error('full lookup failed'));
    const currentCartResult = jest.mocked(useCart)('user-1');
    jest.mocked(useCart).mockReturnValue({
      ...currentCartResult,
      data: {
        ...currentCartResult.data!,
        items: [{
          ...currentCartResult.data!.items[0],
          price: 61000,
        }],
      },
    } as unknown as ReturnType<typeof useCart>);
    rerender(<OrderCartPage />);

    await waitFor(() => expect(mockGetAvailableCouponsForOrder).toHaveBeenCalledWith(61000));
    expect(await screen.findByRole('alert')).toHaveTextContent('쿠폰 없이 주문하려면');
    fireEvent.click(screen.getByRole('button', { name: /결제하기/ }));

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('쿠폰 없이 주문하려면'));
    expect(mockPush).not.toHaveBeenCalledWith('/orders/checkout');
  });
});

function makeUserCoupon(id: string, name: string, value: number) {
  return {
    id,
    uid: 'user-1',
    couponId: id,
    status: '사용가능' as const,
    issuedDate: '2026-07-01',
    createdAt: new Date(),
    updatedAt: new Date(),
    coupon: {
      id,
      name,
      type: '할인금액' as const,
      value,
      minOrderAmount: 0,
      expiryDate: '2099-12-31',
      isActive: true,
      isDirectAssign: true,
      usageLimit: 100,
      usedCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}
