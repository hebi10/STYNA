import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { updateDoc } from 'firebase/firestore';
import CheckoutPage from './page';
import { useAuth } from '@/context/authProvider';
import { useCoupon } from '@/context/couponProvider';
import { OrderService } from '@/shared/services/orderService';
import { buildDemoDataNotice } from '@/shared/constants/commercePolicy';

const mockPush = jest.fn();
const mockRefreshUserCoupons = jest.fn();
const mockGetAvailableCouponsForOrder = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
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
  useCoupon: jest.fn(),
}));

jest.mock('@/shared/hooks/usePoint', () => ({
  usePointBalance: () => ({ data: { pointBalance: 0 } }),
  pointKeys: {
    all: (userId: string) => ['points', userId],
  },
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
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-21T15:00:00.000Z'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(window, 'alert').mockImplementation(() => undefined);
    mockGetAvailableCouponsForOrder.mockResolvedValue([]);
    jest.mocked(useCoupon).mockReturnValue({
      userCoupons: [],
      userCouponsReady: true,
      loading: false,
      error: null,
      refreshUserCoupons: mockRefreshUserCoupons,
      getAvailableCouponsForOrder: mockGetAvailableCouponsForOrder,
    } as never);
    (useAuth as jest.Mock).mockReturnValue({
      user: { uid: 'user-1', displayName: '구매자' },
      userData: { name: '구매자' },
      loading: false,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
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

  test('allows a buy-now draft with no preset coupon to select an available coupon', async () => {
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
    jest.mocked(useCoupon).mockReturnValue({
      userCoupons: [makeUserCoupon('user-coupon-1', '사용 가능 쿠폰')],
      userCouponsReady: true,
      loading: false,
      error: null,
      refreshUserCoupons: mockRefreshUserCoupons,
      getAvailableCouponsForOrder: mockGetAvailableCouponsForOrder,
    } as never);
    (OrderService.createOrder as jest.Mock).mockResolvedValue({ orderId: 'order-1' });

    render(<CheckoutPage />);

    fireEvent.change(await screen.findByLabelText('쿠폰 선택'), {
      target: { value: 'user-coupon-1' },
    });
    await submitManualAddressOrder();

    await waitFor(() => expect(OrderService.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ selectedCoupon: 'user-coupon-1' }),
    ));
  });

  test('resolves and submits a stored coupon outside the overview through the full order lookup', async () => {
    sessionStorage.setItem('orderData', JSON.stringify({
      items: [{
        productId: 'product-1',
        size: 'M',
        color: 'black',
        quantity: 1,
        price: 12000,
      }],
      selectedCoupon: 'older-available',
      deliveryOption: 'standard',
    }));
    mockGetAvailableCouponsForOrder.mockResolvedValue([
      makeUserCoupon('older-available', '오래된 사용 가능 쿠폰'),
    ]);
    jest.mocked(useCoupon).mockReturnValue({
      userCoupons: [makeUserCoupon('recent', '최근 쿠폰')],
      userCouponsReady: true,
      loading: false,
      error: null,
      refreshUserCoupons: mockRefreshUserCoupons,
      getAvailableCouponsForOrder: mockGetAvailableCouponsForOrder,
    } as never);
    (OrderService.createOrder as jest.Mock).mockResolvedValue({ orderId: 'order-with-old-coupon' });

    render(<CheckoutPage />);

    await waitFor(() => expect(mockGetAvailableCouponsForOrder).toHaveBeenCalledWith(12000));
    expect(await screen.findByRole('option', { name: '오래된 사용 가능 쿠폰' })).toBeInTheDocument();
    expect(screen.getByLabelText('쿠폰 선택')).toHaveValue('older-available');

    await submitManualAddressOrder();
    await waitFor(() => expect(OrderService.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ selectedCoupon: 'older-available' }),
    ));
  });

  test('blocks a stored coupon while the full order lookup is pending', async () => {
    const availableCoupons = createDeferred<ReturnType<typeof makeUserCoupon>[]>();
    mockGetAvailableCouponsForOrder.mockReturnValue(availableCoupons.promise);
    sessionStorage.setItem('orderData', JSON.stringify({
      items: [{
        productId: 'product-1',
        size: 'M',
        color: 'black',
        quantity: 1,
        price: 12000,
      }],
      selectedCoupon: 'stored-coupon',
      deliveryOption: 'standard',
    }));

    render(<CheckoutPage />);

    await waitFor(() => expect(mockGetAvailableCouponsForOrder).toHaveBeenCalledWith(12000));
    expect(screen.getByLabelText('쿠폰 선택')).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('사용 가능한 쿠폰을 확인하는 중');

    await act(async () => {
      availableCoupons.resolve([makeUserCoupon('stored-coupon', '저장 쿠폰')]);
      await availableCoupons.promise;
    });
    await waitFor(() => expect(screen.getByLabelText('쿠폰 선택')).toBeEnabled());
    expect(screen.getByLabelText('쿠폰 선택')).toHaveValue('stored-coupon');
  });

  test('reports a full lookup failure and lets the user explicitly remove a stored coupon', async () => {
    mockGetAvailableCouponsForOrder.mockRejectedValue(new Error('full lookup failed'));
    sessionStorage.setItem('orderData', JSON.stringify({
      items: [{
        productId: 'product-1',
        size: 'M',
        color: 'black',
        quantity: 1,
        price: 12000,
      }],
      selectedCoupon: 'stored-coupon',
      deliveryOption: 'standard',
    }));

    render(<CheckoutPage />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(
      '사용 가능한 쿠폰 전체를 불러오지 못했습니다',
    ));
    fireEvent.change(screen.getByLabelText('쿠폰 선택'), { target: { value: '' } });
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  test('disables expired and minimum-order coupons with their Korean reasons', async () => {
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
    jest.mocked(useCoupon).mockReturnValue({
      userCoupons: [
        makeUserCoupon('expired', '만료된 쿠폰', { expiryDate: '2026-07-21' }),
        makeUserCoupon('minimum', '최소 금액 쿠폰', { minOrderAmount: 50000 }),
      ],
      userCouponsReady: true,
      loading: false,
      error: null,
      refreshUserCoupons: mockRefreshUserCoupons,
      getAvailableCouponsForOrder: mockGetAvailableCouponsForOrder,
    } as never);

    render(<CheckoutPage />);

    expect(await screen.findByRole('option', { name: /만료된 쿠폰.*기간 만료/ })).toBeDisabled();
    expect(screen.getByRole('option', { name: /최소 금액 쿠폰.*최소 주문금액/ })).toBeDisabled();
  });

  test.each([
    {
      label: 'loading',
      context: { userCouponsReady: false, loading: true, error: null },
      message: '저장된 쿠폰 정보를 확인하는 중입니다',
    },
    {
      label: 'failed',
      context: { userCouponsReady: false, loading: false, error: 'coupon load failed' },
      message: '쿠폰 정보를 불러오지 못했습니다',
    },
    {
      label: 'unresolved',
      context: { userCouponsReady: false, loading: false, error: null },
      message: '저장된 쿠폰 정보가 아직 확인되지 않았습니다',
    },
  ])('blocks a stored coupon while its initial lookup is $label', async ({ context, message }) => {
    sessionStorage.setItem('orderData', JSON.stringify({
      items: [{
        productId: 'product-1',
        size: 'M',
        color: 'black',
        quantity: 1,
        price: 12000,
      }],
      selectedCoupon: 'stored-coupon',
      deliveryOption: 'standard',
    }));
    jest.mocked(useCoupon).mockReturnValue({
      userCoupons: [],
      refreshUserCoupons: mockRefreshUserCoupons,
      getAvailableCouponsForOrder: mockGetAvailableCouponsForOrder,
      ...context,
    } as never);

    render(<CheckoutPage />);

    fireEvent.click(await screen.findByRole('checkbox', { name: '결제 진행 동의' }));
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    const submitButton = screen.getByRole('button', { name: /주문 접수하기/ });
    expect(submitButton).toBeDisabled();
    fireEvent.click(submitButton);
    expect(OrderService.createOrder).not.toHaveBeenCalled();
  });

  test('requires an explicit no-coupon choice when a loaded list cannot resolve the stored coupon', async () => {
    sessionStorage.setItem('orderData', JSON.stringify({
      items: [{
        productId: 'product-1',
        size: 'M',
        color: 'black',
        quantity: 1,
        price: 12000,
      }],
      selectedCoupon: 'missing-coupon',
      deliveryOption: 'standard',
    }));
    jest.mocked(useCoupon).mockReturnValue({
      userCoupons: [],
      userCouponsReady: true,
      loading: false,
      error: null,
      refreshUserCoupons: mockRefreshUserCoupons,
      getAvailableCouponsForOrder: mockGetAvailableCouponsForOrder,
    } as never);
    (OrderService.createOrder as jest.Mock).mockResolvedValue({ orderId: 'order-without-coupon' });

    render(<CheckoutPage />);

    fireEvent.click(await screen.findByRole('checkbox', { name: '결제 진행 동의' }));
    expect(screen.getByRole('alert')).toHaveTextContent('저장된 쿠폰을 확인할 수 없습니다');
    expect(screen.getByRole('button', { name: /주문 접수하기/ })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('쿠폰 선택'), { target: { value: '' } });
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    fireEvent.change(screen.getByRole('textbox', { name: '연락처' }), {
      target: { value: '010-1234-5678' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: '우편번호' }), {
      target: { value: '06234' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: '주소' }), {
      target: { value: '서울시 강남구' },
    });
    fireEvent.click(screen.getByRole('button', { name: /주문 접수하기/ }));

    await waitFor(() => expect(OrderService.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ selectedCoupon: undefined }),
    ));
  });

  test('navigates to completion when a post-purchase refresh rejects', async () => {
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
    mockRefreshUserCoupons.mockRejectedValue(new Error('refresh failed'));
    (OrderService.createOrder as jest.Mock).mockResolvedValue({ orderId: 'order-1' });

    render(<CheckoutPage />);
    await submitManualAddressOrder();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/orders/complete?orderId=order-1'));
    expect(sessionStorage.getItem('orderData')).toBeNull();
  });

  test('keeps the draft and skips refresh when order creation fails', async () => {
    const draft = {
      items: [{
        productId: 'product-1',
        size: 'M',
        color: 'black',
        quantity: 1,
        price: 12000,
      }],
      deliveryOption: 'standard',
    };
    sessionStorage.setItem('orderData', JSON.stringify(draft));
    (OrderService.createOrder as jest.Mock).mockRejectedValue(new Error('create failed'));

    render(<CheckoutPage />);
    await submitManualAddressOrder();

    await waitFor(() => expect(OrderService.createOrder).toHaveBeenCalledTimes(1));
    expect(sessionStorage.getItem('orderData')).toBe(JSON.stringify(draft));
    expect(mockRefreshUserCoupons).not.toHaveBeenCalled();
  });

  test('continues to completion when saving orderResult fails after order creation', async () => {
    const draft = {
      items: [{
        productId: 'product-1',
        size: 'M',
        color: 'black',
        quantity: 1,
        price: 12000,
      }],
      deliveryOption: 'standard',
    };
    sessionStorage.setItem('orderData', JSON.stringify(draft));
    (OrderService.createOrder as jest.Mock).mockResolvedValue({ orderId: 'order-storage-failure' });
    const originalSetItem = Storage.prototype.setItem;
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === 'orderResult') {
        throw new Error('storage unavailable');
      }
      return originalSetItem.call(this, key, value);
    });

    render(<CheckoutPage />);
    await submitManualAddressOrder();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/orders/complete?orderId=order-storage-failure'));
    expect(sessionStorage.getItem('orderData')).toBeNull();
    expect(mockRefreshUserCoupons).toHaveBeenCalledTimes(1);
  });

  test('keeps submission locked and exposes the completion link while navigation is delayed', async () => {
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
    const navigation = createDeferred<void>();
    mockPush.mockReturnValueOnce(navigation.promise);
    (OrderService.createOrder as jest.Mock).mockResolvedValue({ orderId: 'order-navigation-delay' });

    render(<CheckoutPage />);
    await submitManualAddressOrder();

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/orders/complete?orderId=order-navigation-delay'));
    const completionLink = await screen.findByRole('link', { name: '주문 완료 화면으로 이동' });
    expect(completionLink).toHaveAttribute('href', '/orders/complete?orderId=order-navigation-delay');
    const submitButton = screen.getByRole('button', { name: /주문 접수/ });
    expect(submitButton).toBeDisabled();
    fireEvent.click(submitButton);
    expect(OrderService.createOrder).toHaveBeenCalledTimes(1);

    navigation.resolve();
  });

  test('keeps submission locked and exposes the completion link when navigation throws', async () => {
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
    mockPush.mockImplementationOnce(() => {
      throw new Error('navigation failed');
    });
    (OrderService.createOrder as jest.Mock).mockResolvedValue({ orderId: 'order-navigation-failure' });

    render(<CheckoutPage />);
    await submitManualAddressOrder();

    const completionLink = await screen.findByRole('link', { name: '주문 완료 화면으로 이동' });
    expect(completionLink).toHaveAttribute('href', '/orders/complete?orderId=order-navigation-failure');
    const submitButton = screen.getByRole('button', { name: /주문 접수/ });
    expect(submitButton).toBeDisabled();
    fireEvent.click(submitButton);
    expect(OrderService.createOrder).toHaveBeenCalledTimes(1);
  });
});

function makeUserCoupon(
  id: string,
  name: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    uid: 'user-1',
    couponId: id,
    status: '사용가능',
    issuedDate: '2026-07-01',
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    coupon: {
      id,
      name,
      type: '할인금액',
      value: 1000,
      minOrderAmount: 0,
      expiryDate: '2026-07-31',
      isActive: true,
      isDirectAssign: false,
      usageLimit: 1,
      usedCount: 0,
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-01T00:00:00.000Z'),
      ...overrides,
    },
  };
}

async function submitManualAddressOrder() {
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
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}
