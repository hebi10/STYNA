import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminOrdersPage from './page';
import { OrderService } from '@/shared/services/orderService';
import type { Order } from '@/shared/types/order';

const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

jest.mock('@/context/authProvider', () => ({
  useAuth: () => ({
    user: { uid: 'admin-1' },
    isAdmin: true,
    loading: false,
    isUserDataLoading: false,
  }),
}));

jest.mock('@/shared/services/orderService', () => ({
  OrderService: {
    getAllOrders: jest.fn(),
    getOrderStats: jest.fn(),
    updateOrderStatus: jest.fn(),
  },
}));

jest.mock('./page.module.css', () => new Proxy({}, {
  get: (_target, property) => String(property),
}));

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsText(blob);
  });
}

function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(new Uint8Array(reader.result as ArrayBuffer)));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsArrayBuffer(blob);
  });
}

describe('AdminOrdersPage CSV export', () => {
  const createObjectURL = jest.fn((blob: Blob) => {
    void blob;
    return 'blob:orders-csv';
  });
  const revokeObjectURL = jest.fn();

  const order: Order = {
    id: 'order-1',
    userId: 'user-1',
    orderNumber: '=위험한주문번호',
    products: [{
      id: 'item-1',
      productId: 'product-1',
      productName: '상품',
      productImage: '/product.jpg',
      size: 'M',
      color: 'black',
      quantity: 2,
      price: 10000,
      discountAmount: 0,
      brand: '브랜드',
    }],
    finalAmount: 20000,
    status: 'confirmed',
    paymentMethod: 'card',
    shippingAddress: {
      id: 'address-1',
      name: '기본 배송지',
      recipient: '홍길동, "VIP"',
      phone: '010-0000-0000',
      zipCode: '12345',
      address: '서울시',
      detailAddress: '1층',
      isDefault: true,
    },
    createdAt: new Date('2026-08-03T01:00:00.000Z'),
    updatedAt: new Date('2026-08-03T01:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(OrderService.getAllOrders).mockResolvedValue([order]);
    jest.mocked(OrderService.getOrderStats).mockResolvedValue({
      total: 1,
      pending: 0,
      confirmed: 1,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
      totalAmount: 20000,
    });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    });
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    jest.spyOn(window, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.replaceChildren();
  });

  test('creates an Excel-compatible UTF-8 CSV with safe cell escaping', async () => {
    render(<AdminOrdersPage />);
    await screen.findByText('=위험한주문번호');

    fireEvent.click(screen.getByRole('button', { name: 'CSV 내보내기' }));

    const blob = createObjectURL.mock.calls[0][0] as Blob;
    const bytes = await readBlobBytes(blob);
    const csv = await readBlob(blob);

    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(csv).toContain('\r\n');
    expect(csv).toContain("'=위험한주문번호");
    expect(csv).toContain('"홍길동, ""VIP"""');
  });

  test('releases the temporary download URL after starting the download', async () => {
    render(<AdminOrdersPage />);
    await screen.findByText('=위험한주문번호');

    fireEvent.click(screen.getByRole('button', { name: 'CSV 내보내기' }));

    await waitFor(() => {
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:orders-csv');
    });
    expect(document.body.querySelector('a[download]')).toBeNull();
  });
});
