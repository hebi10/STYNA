import { render, screen } from '@testing-library/react';
import OrderDetailPage from './page';
import { OrderService } from '@/shared/services/orderService';
import type { Order } from '@/shared/types/order';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/context/authProvider', () => ({
  useAuth: () => ({ user: { uid: 'user-1' }, loading: false }),
}));

jest.mock('@/shared/services/orderService', () => ({
  OrderService: { getOrder: jest.fn() },
}));

jest.mock('./page.module.css', () => new Proxy({}, {
  get: (_target, property) => String(property),
}));

const order: Order = {
  id: 'order-1',
  userId: 'user-1',
  orderNumber: 'ORDER-1',
  products: [{
    id: 'item-1',
    productId: 'product-1',
    productName: '테스트 상품',
    productImage: '/product.jpg',
    size: 'M',
    color: 'yellow gold',
    quantity: 1,
    price: 10000,
    discountAmount: 0,
    brand: '테스트 브랜드',
  }],
  finalAmount: 10000,
  status: 'confirmed',
  paymentMethod: 'card',
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
};

describe('OrderDetailPage display values', () => {
  test('renders localized product options and payment method', async () => {
    jest.mocked(OrderService.getOrder).mockResolvedValue(order);

    render(<OrderDetailPage params={Promise.resolve({ orderId: 'order-1' })} />);

    expect(await screen.findByText('색상: 옐로우 골드 / 사이즈: M / 수량: 1개')).toBeInTheDocument();
    expect(screen.getByText('카드 결제')).toBeInTheDocument();
  });
});
