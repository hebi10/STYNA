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
    jest.mocked(useAuth).mockReturnValue({
      user: { uid: 'user-1' },
      userData: {},
      loading: false,
    } as unknown as ReturnType<typeof useAuth>);
    jest.mocked(useCoupon).mockReturnValue({
      userCoupons: [{
        id: 'user-coupon-1',
        uid: 'user-1',
        couponId: 'coupon-1',
        status: '사용가능',
        issuedDate: '2026-07-01',
        createdAt: new Date(),
        updatedAt: new Date(),
        coupon: {
          id: 'coupon-1',
          name: '20,000원 할인',
          type: '할인금액',
          value: 20000,
          minOrderAmount: 0,
          expiryDate: '2099-12-31',
          isActive: true,
          isDirectAssign: true,
          usageLimit: 100,
          usedCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }],
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

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'user-coupon-1' },
    });

    await waitFor(() => {
      expect(within(standardOption as HTMLElement).getByText('3,000원')).toBeInTheDocument();
    });
  });
});
