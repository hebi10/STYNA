 "use client";

import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "../../_components/PageHeader";
import { useAuth } from "@/context/authProvider";
import { useCoupon } from "@/context/couponProvider";
import { OrderService } from "@/shared/services/orderService";
import { cartKeys } from "@/shared/hooks/useCart";
import { usePointBalance } from "@/shared/hooks/usePoint";
import { calculateOrderPreview } from "@/shared/utils/orderPricing";
import { CheckoutDraft, parseCheckoutDraft } from "./checkoutDraft";
import { buildCheckoutDeliveryAddresses, DeliveryAddress } from "./deliveryAddress";
import styles from "./page.module.css";

const paymentMethods = [
  { value: "card", label: "카드 결제" },
  { value: "bank", label: "무통장입금" },
  { value: "virtual", label: "가상계좌" },
  { value: "phone", label: "휴대폰 결제" },
] as const;

const addressLabels: Record<string, string> = {
  default: "기본 배송지",
  office: "회사 배송지",
};

export default function CheckoutPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, userData, loading: authLoading } = useAuth();
  const { userCoupons } = useCoupon();
  const { data: pointBalanceData } = usePointBalance();
  const pointBalance = pointBalanceData?.pointBalance ?? 0;

  const [orderData, setOrderData] = useState<CheckoutDraft | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<DeliveryAddress | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<(typeof paymentMethods)[number]["value"]>("card");
  const [usePoints, setUsePoints] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [checkoutRecoveryReason, setCheckoutRecoveryReason] = useState<string | null>(null);

  const addresses = useMemo(
    () => buildCheckoutDeliveryAddresses(userData),
    [userData]
  );

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login?redirect=/orders/checkout");
      return;
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    const savedOrderData = sessionStorage.getItem("orderData");
    const result = parseCheckoutDraft(savedOrderData);
    if (!result.ok) {
      setCheckoutRecoveryReason(result.reason);
      return;
    }

    setCheckoutRecoveryReason(null);
    setOrderData(result.draft);
  }, []);

  useEffect(() => {
    setSelectedAddress((currentAddress) => {
      const defaultAddress = addresses.find((address) => address.isDefault) || addresses[0] || null;
      if (!currentAddress) {
        return defaultAddress;
      }

      return addresses.find((address) => address.id === currentAddress.id) || defaultAddress;
    });
  }, [addresses]);

  const selectedCouponView = userCoupons?.find((coupon) => coupon.id === orderData?.selectedCoupon) || null;
  const orderPreview = useMemo(() => {
    if (!orderData) {
      return null;
    }

    return calculateOrderPreview({
      items: orderData.items.map((item) => ({
        productId: item.productId,
        price: item.price,
        discountAmount: item.discountAmount,
        quantity: item.quantity,
        isAvailable: true,
      })),
      deliveryOption: orderData.deliveryOption,
      selectedCoupon: selectedCouponView,
      requestedPointAmount: usePoints,
      pointBalance,
    });
  }, [orderData, selectedCouponView, usePoints, pointBalance]);

  const subtotal = orderPreview?.subtotal ?? 0;
  const discountAmount = orderPreview?.productDiscountAmount ?? 0;
  const couponDiscount = orderPreview?.couponDiscount ?? 0;
  const deliveryFee = orderPreview?.deliveryFee ?? 0;
  const maxUsablePoints = orderPreview?.maxUsablePoints ?? 0;
  const finalAmount = orderPreview?.finalAmount ?? 0;

  const handlePointChange = (raw: string) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      setUsePoints(0);
      return;
    }
    setUsePoints(Math.max(0, Math.min(maxUsablePoints, Math.floor(parsed))));
  };

  const handleCompleteOrder = async () => {
    if (!user || !orderData || !selectedAddress || !agreeTerms) {
      alert("필수 정보를 입력해주세요.");
      return;
    }

    if (!orderData.items.length) {
      alert("주문 대상 상품이 없습니다.");
      return;
    }

    setIsProcessing(true);
    try {
      const response = await OrderService.createOrder({
        items: orderData.items.map((item) => ({
          productId: item.productId,
          id: item.id,
          size: item.size,
          color: item.color,
          quantity: item.quantity,
        })),
        deliveryAddress: {
          id: selectedAddress.id,
          name: selectedAddress.name,
          recipient: selectedAddress.recipient,
          phone: selectedAddress.phone,
          address: selectedAddress.address,
          detailAddress: selectedAddress.detailAddress,
          zipCode: selectedAddress.zipCode,
          isDefault: selectedAddress.isDefault,
        },
        paymentMethod,
        deliveryOption: orderData.deliveryOption,
        selectedCoupon: orderPreview?.usableCoupon?.id || undefined,
        requestedPointAmount: orderPreview?.pointUsed ?? usePoints,
      });

      sessionStorage.setItem("orderResult", JSON.stringify({ orderId: response.orderId }));
      await queryClient.invalidateQueries({ queryKey: cartKeys.list(user.uid) });
      await queryClient.refetchQueries({ queryKey: cartKeys.count(user.uid), type: "active" });
      router.push(`/orders/complete?orderId=${encodeURIComponent(response.orderId)}`);
    } catch (error) {
      console.error("order create failed:", error);
      alert("주문 처리 중 문제가 발생했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (authLoading || !user) {
    return <div>로그인 / 주문 정보 확인 중...</div>;
  }

  if (checkoutRecoveryReason) {
    return (
      <div className={styles.container}>
        <PageHeader
          title="주문/결제"
          description="주문 정보를 다시 확인해주세요"
          breadcrumb={[
            { label: "홈", href: "/" },
            { label: "장바구니", href: "/orders/cart" },
            { label: "주문/결제" },
          ]}
        />
        <div className={styles.content}>
          <div className={styles.recoveryPanel} role="status" aria-live="polite">
            <h2 className={styles.recoveryTitle}>주문 정보를 불러올 수 없습니다</h2>
            <p className={styles.recoveryDescription}>
              장바구니에서 주문할 상품을 다시 선택하면 결제를 이어갈 수 있습니다.
            </p>
            <Link href="/orders/cart" className={styles.recoveryButton}>
              장바구니로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!orderData) {
    return <div>주문 정보 확인 중...</div>;
  }

  if (addresses.length === 0 || !selectedAddress) {
    return (
      <div className={styles.container}>
        <PageHeader
          title="배송지 등록 필요"
          description="주문을 진행하려면 실제 배송지를 먼저 등록해주세요"
          breadcrumb={[
            { label: "홈", href: "/" },
            { label: "주문/결제" },
          ]}
        />
        <div className={styles.content}>
          <div className={styles.recoveryPanel} role="status" aria-live="polite">
            <h2 className={styles.recoveryTitle}>등록된 배송지가 없습니다</h2>
            <p className={styles.recoveryDescription}>
              임시 주소로 주문하지 않습니다. 마이페이지에서 배송지를 등록한 뒤 다시 진행해주세요.
            </p>
            <Link href="/mypage/info-edit" className={styles.recoveryButton}>
              배송지 등록하기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <PageHeader
        title="주문/결제"
        description="주문 상품과 배송 정보를 확인하고 결제를 진행하세요"
        breadcrumb={[
          { label: "홈", href: "/" },
          { label: "장바구니", href: "/orders/cart" },
          { label: "주문/결제" },
        ]}
      />
      <div className={styles.content}>
        <div className={styles.checkoutLayout}>
          <div className={styles.orderSection}>
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>상품</h3>
              <div className={styles.orderItems}>
                {orderData.items.map((item) => (
                  <div key={`${item.productId}-${item.size}-${item.color}`} className={styles.orderItem}>
                    <div className={styles.itemInfo}>
                      {item.brand && <div className={styles.itemBrand}>{item.brand}</div>}
                      <div className={styles.itemName}>{item.productName || item.productId}</div>
                      <div className={styles.itemOptions}>{item.color} / {item.size} / 수량 {item.quantity}</div>
                    </div>
                    <div className={styles.itemPrice}>
                      {(Math.max(0, item.price) * item.quantity).toLocaleString()}원
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>배송 주소</h3>
              <div className={styles.addressList}>
                {addresses.map((address) => (
                  <label key={address.id} className={styles.addressOption}>
                    <input
                      type="radio"
                      name="address"
                      checked={selectedAddress.id === address.id}
                      onChange={() => setSelectedAddress(address)}
                    />
                    <div className={styles.addressContent}>
                      <div className={styles.addressHeader}>
                        <span className={styles.addressName}>{addressLabels[address.name] || address.name}</span>
                      </div>
                      <div className={styles.addressRecipient}>{address.recipient} | {address.phone}</div>
                      <div className={styles.addressLocation}>
                        {`(${address.zipCode}) ${address.address} ${address.detailAddress}`}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>결제 방식</h3>
              <p className={styles.paymentNotice}>
                포트폴리오 데모에서는 실제 결제가 진행되지 않으며 주문 접수만 기록됩니다.
              </p>
              <div className={styles.paymentMethods}>
                {paymentMethods.map((method) => (
                  <label key={method.value} className={styles.paymentMethod}>
                    <input
                      type="radio"
                      name="payment"
                      value={method.value}
                      checked={paymentMethod === method.value}
                      onChange={() => setPaymentMethod(method.value)}
                    />
                    <span className={styles.methodLabel}>{method.label}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>포인트 사용</h3>
              <div className={styles.pointSection}>
                <div className={styles.pointInfo}>
                  <span>가용 포인트: {pointBalance.toLocaleString()}원</span>
                  <span className={styles.pointNote}>이번 주문에는 최대 {maxUsablePoints.toLocaleString()}원까지 사용할 수 있습니다.</span>
                </div>
                <div className={styles.pointInput}>
                  <input
                    type="number"
                    value={usePoints}
                    onChange={(event) => handlePointChange(event.target.value)}
                    max={maxUsablePoints}
                  />
                  <button type="button" className={styles.maxButton} onClick={() => setUsePoints(maxUsablePoints)}>
                    전액 사용
                  </button>
                </div>
              </div>
            </section>
          </div>

          <aside className={styles.paymentSummary}>
            <div className={styles.summaryContent}>
              <h3 className={styles.summaryTitle}>최종 금액</h3>
              <div className={styles.summaryItems}>
                <div className={styles.summaryItem}>
                  <span>상품 금액</span>
                  <span>{subtotal.toLocaleString()}원</span>
                </div>
                <div className={styles.summaryItem}>
                  <span>상품 할인</span>
                  <span>-{discountAmount.toLocaleString()}원</span>
                </div>
                {couponDiscount > 0 && (
                  <div className={styles.summaryItem}>
                    <span>쿠폰 할인</span>
                    <span>-{couponDiscount.toLocaleString()}원</span>
                  </div>
                )}
                <div className={styles.summaryItem}>
                  <span>배송비</span>
                  <span>{deliveryFee ? `${deliveryFee.toLocaleString()}원` : "무료"}</span>
                </div>
                <div className={styles.summaryItem}>
                  <span>포인트 사용</span>
                  <span>-{usePoints.toLocaleString()}원</span>
                </div>
                <div className={styles.summaryDivider} />
                <div className={styles.totalAmount}>
                  <span>최종 결제금액</span>
                  <span>{finalAmount.toLocaleString()}원</span>
                </div>
              </div>

              <label className={styles.termsCheck}>
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(event) => setAgreeTerms(event.target.checked)}
                />
                <span>결제 진행 동의</span>
              </label>

              <button
                className={styles.checkoutButton}
                onClick={handleCompleteOrder}
                disabled={!agreeTerms || isProcessing}
              >
                {isProcessing ? "주문 처리 중..." : `${finalAmount.toLocaleString()}원 데모 주문 접수하기`}
              </button>

              <Link href="/orders/cart" className={styles.backButton}>
                뒤로가기
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
