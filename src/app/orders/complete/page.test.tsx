import { render } from '@testing-library/react';
import OrderCompletePage from './page';
import { useAuth } from '@/context/authProvider';
import { OrderService } from '@/shared/services/orderService';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams('orderId=order-1'),
}));

jest.mock('@/context/authProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/shared/services/orderService', () => ({
  OrderService: {
    getOrder: jest.fn(),
  },
}));

jest.mock('../../_components/PageHeader', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('./page.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, property) => String(property),
  }),
}));

describe('OrderCompletePage authentication recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  test('does not leave the completion page while authentication is loading', () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      loading: true,
    });

    render(<OrderCompletePage />);

    expect(mockPush).not.toHaveBeenCalled();
    expect(OrderService.getOrder).not.toHaveBeenCalled();
  });
});
