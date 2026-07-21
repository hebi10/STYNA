import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { updateDoc } from 'firebase/firestore';
import CheckoutPage from './page';
import { useAuth } from '@/context/authProvider';
import { OrderService } from '@/shared/services/orderService';
import { buildDemoDataNotice } from '@/shared/constants/commercePolicy';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
    refetchQueries: jest.fn(),
  }),
}));

jest.mock('firebase/firestore', () => ({
  arrayUnion: jest.fn((value) => value),
  doc: jest.fn(),
  serverTimestamp: jest.fn(),
  updateDoc: jest.fn(),
}));

jest.mock('@/shared/libs/firebase/firebase', () => ({
  db: {},
}));

jest.mock('../../_components/PageHeader', () => ({
  __esModule: true,
  default: ({ title, description }: { title: string; description?: string }) => (
    <header>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </header>
  ),
}));

jest.mock('@/context/authProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/context/couponProvider', () => ({
  useCoupon: () => ({ userCoupons: [] }),
}));

jest.mock('@/shared/hooks/usePoint', () => ({
  usePointBalance: () => ({ data: { pointBalance: 0 } }),
}));

jest.mock('@/shared/services/orderService', () => ({
  OrderService: {
    createOrder: jest.fn(),
  },
}));

jest.mock('@/shared/hooks/useCart', () => ({
  cartKeys: {
    list: (userId: string) => ['cart', 'list', userId],
    count: (userId: string) => ['cart', 'count', userId],
  },
}));

jest.mock('./page.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, property) => String(property),
  }),
}));

describe('CheckoutPage recovery state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    (useAuth as jest.Mock).mockReturnValue({
      user: { uid: 'user-1', displayName: '구매자' },
      userData: { name: '구매자' },
      loading: false,
    });
  });

  test('shows a cart recovery link when checkout data is missing', async () => {
    render(<CheckoutPage />);

    expect(await screen.findByRole('status')).toHaveTextContent('주문 정보를 불러올 수 없습니다');
    expect(screen.getByRole('link', { name: '장바구니로 돌아가기' })).toHaveAttribute('href', '/orders/cart');
  });

  test('shows manual delivery address fields without saved addresses and enables saving by default', async () => {
    sessionStorage.setItem('orderData', JSON.stringify({
      items: [{
        productId: 'product-1',
        size: 'M',
        color: 'black',
        quantity: 1,
        price: 12000,
      }],
      deliveryOption: 'standard',
    }));

    render(<CheckoutPage />);

    expect(await screen.findByRole('heading', { name: '배송 주소' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '받는 분' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '입력한 배송지 저장하기' })).toBeChecked();
    expect(screen.queryByText('등록된 배송지가 없습니다')).not.toBeInTheDocument();
  });

  test('discloses the exact demo payment and Firebase persistence boundary', async () => {
    sessionStorage.setItem('orderData', JSON.stringify({
      items: [{
        productId: 'product-1',
        size: 'M',
        color: 'black',
        quantity: 1,
        price: 12000,
      }],
      deliveryOption: 'standard',
    }));

    const { container } = render(<CheckoutPage />);

    expect(await screen.findByText(buildDemoDataNotice())).toBeInTheDocument();
    expect(container.textContent).not.toMatch(
      /카카오페이|네이버페이|페이코|토스페이|구매.*1%/,
    );
  });

  test('saves the manual delivery address after the order succeeds', async () => {
    sessionStorage.setItem('orderData', JSON.stringify({
      items: [{
        productId: 'product-1',
        size: 'M',
        color: 'black',
        quantity: 1,
        price: 12000,
      }],
      deliveryOption: 'standard',
    }));
    (OrderService.createOrder as jest.Mock).mockResolvedValue({ orderId: 'order-1' });

    render(<CheckoutPage />);

    fireEvent.change(await screen.findByRole('textbox', { name: '연락처' }), {
      target: { value: '010-1234-5678' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: '우편번호' }), {
      target: { value: '06234' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: '주소' }), {
      target: { value: '서울시 강남구' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: '결제 진행 동의' }));
    fireEvent.click(screen.getByRole('button', { name: /주문 접수하기/ }));

    await waitFor(() => expect(OrderService.createOrder).toHaveBeenCalledTimes(1));
    expect(updateDoc).toHaveBeenCalledTimes(1);
  });

  test('uses the manual delivery address only for the order when saving is disabled', async () => {
    sessionStorage.setItem('orderData', JSON.stringify({
      items: [{
        productId: 'product-1',
        size: 'M',
        color: 'black',
        quantity: 1,
        price: 12000,
      }],
      deliveryOption: 'standard',
    }));
    (OrderService.createOrder as jest.Mock).mockResolvedValue({ orderId: 'order-2' });

    render(<CheckoutPage />);

    fireEvent.change(await screen.findByRole('textbox', { name: '연락처' }), {
      target: { value: '010-1234-5678' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: '우편번호' }), {
      target: { value: '06234' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: '주소' }), {
      target: { value: '서울시 강남구' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: '입력한 배송지 저장하기' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '결제 진행 동의' }));
    fireEvent.click(screen.getByRole('button', { name: /주문 접수하기/ }));

    await waitFor(() => expect(OrderService.createOrder).toHaveBeenCalledTimes(1));
    expect(updateDoc).not.toHaveBeenCalled();
  });
});
