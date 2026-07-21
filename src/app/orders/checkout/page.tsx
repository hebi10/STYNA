 "use client";

import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { arrayUnion, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import PageHeader from "../../_components/PageHeader";
import { useAuth } from "@/context/authProvider";
import { useCoupon } from "@/context/couponProvider";
import { OrderService } from "@/shared/services/orderService";
import { db } from "@/shared/libs/firebase/firebase";
import { cartKeys } from "@/shared/hooks/useCart";
import { usePointBalance } from "@/shared/hooks/usePoint";
import { buildDemoDataNotice } from "@/shared/constants/commercePolicy";
import { calculateOrderPreview } from "@/shared/utils/orderPricing";
import { CheckoutDraft, parseCheckoutDraft } from "./checkoutDraft";
import {
  buildCheckoutDeliveryAddresses,
  createManualDeliveryAddress,
  DeliveryAddress,
  ManualDeliveryAddressErrors,
  ManualDeliveryAddressInput,
  validateManualDeliveryAddress,
} from "./deliveryAddress";
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
  const [useManualAddress, setUseManualAddress] = useState(false);
  const [manualAddress, setManualAddress] = useState<ManualDeliveryAddressInput>({
    name: "집",
    recipient: "",
    phone: "",
    address: "",
    detailAddress: "",
    zipCode: "",
  });
  const [manualAddressErrors, setManualAddressErrors] = useState<ManualDeliveryAddressErrors>({});
  const [saveManualAddress, setSaveManualAddress] = useState(true);
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
    if (addresses.length === 0) {
      setSelectedAddress(null);
      setUseManualAddress(true);
      return;
    }

    setSelectedAddress((currentAddress) => {
      const defaultAddress = addresses.find((address) => address.isDefault) || addresses[0] || null;
      if (!currentAddress) {
        return defaultAddress;
      }

      return addresses.find((address) => address.id === currentAddress.id) || defaultAddress;
    });
  }, [addresses]);

  useEffect(() => {
    setManualAddress((current) => ({
      ...current,
      recipient: current.recipient || (typeof userData?.name === "string" ? userData.name : user?.displayName || ""),
      phone: current.phone || (typeof userData?.phone === "string" ? userData.phone : ""),
    }));
  }, [user?.displayName, userData]);

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

  const handleManualAddressChange = (field: keyof ManualDeliveryAddressInput, value: string) => {
    setManualAddress((current) => ({ ...current, [field]: value }));
    setManualAddressErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleCompleteOrder = async () => {
    if (!user || !orderData || !agreeTerms) {
      alert("필수 정보를 입력해주세요.");
      return;
    }

    if (!orderData.items.length) {
      alert("주문 대상 상품이 없습니다.");
      return;
    }

    let deliveryAddress: DeliveryAddress;
    if (useManualAddress) {
      const errors = validateManualDeliveryAddress(manualAddress);
      if (Object.keys(errors).length > 0) {
        setManualAddressErrors(errors);
        return;
      }

      const addressId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `checkout-${Date.now()}`;
      deliveryAddress = createManualDeliveryAddress(manualAddress, addressId, addresses.length === 0);
    } else if (selectedAddress) {
      deliveryAddress = selectedAddress;
    } else {
      alert("배송지를 선택해주세요.");
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
          id: deliveryAddress.id,
          name: deliveryAddress.name,
          recipient: deliveryAddress.recipient,
          phone: deliveryAddress.phone,
          address: deliveryAddress.address,
          detailAddress: deliveryAddress.detailAddress,
          zipCode: deliveryAddress.zipCode,
          isDefault: deliveryAddress.isDefault,
        },
        paymentMethod,
        deliveryOption: orderData.deliveryOption,
        selectedCoupon: orderPreview?.usableCoupon?.id || undefined,
        requestedPointAmount: orderPreview?.pointUsed ?? usePoints,
      });

      if (useManualAddress && saveManualAddress) {
        try {
          await updateDoc(doc(db, "users", user.uid), {
            addresses: arrayUnion(deliveryAddress),
            updatedAt: serverTimestamp(),
          });
        } catch (saveError) {
          console.error("delivery address save failed:", saveError);
          alert("주문은 완료됐지만 입력한 배송지는 저장하지 못했습니다.");
        }
      }

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
                      checked={!useManualAddress && selectedAddress?.id === address.id}
                      onChange={() => {
                        setSelectedAddress(address);
                        setUseManualAddress(false);
                      }}
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
                <label className={styles.addressOption}>
                  <input
                    type="radio"
                    name="address"
                    checked={useManualAddress}
                    onChange={() => setUseManualAddress(true)}
                  />
                  <span className={styles.addressName}>새 배송지 입력</span>
                </label>
                {useManualAddress && (
                  <div className={styles.manualAddressForm}>
                    <div className={styles.addressFieldRow}>
                      <label className={styles.addressField}>
                        <span>배송지명</span>
                        <input
                          type="text"
                          aria-label="배송지명"
                          value={manualAddress.name}
                          onChange={(event) => handleManualAddressChange("name", event.target.value)}
                        />
                        {manualAddressErrors.name && <span role="alert" className={styles.addressError}>{manualAddressErrors.name}</span>}
                      </label>
                      <label className={styles.addressField}>
                        <span>받는 분</span>
                        <input
                          type="text"
                          aria-label="받는 분"
                          value={manualAddress.recipient}
                          onChange={(event) => handleManualAddressChange("recipient", event.target.value)}
                        />
                        {manualAddressErrors.recipient && <span role="alert" className={styles.addressError}>{manualAddressErrors.recipient}</span>}
                      </label>
                    </div>
                    <div className={styles.addressFieldRow}>
                      <label className={styles.addressField}>
                        <span>연락처</span>
                        <input
                          type="tel"
                          aria-label="연락처"
                          placeholder="010-1234-5678"
                          value={manualAddress.phone}
                          onChange={(event) => handleManualAddressChange("phone", event.target.value)}
                        />
                        {manualAddressErrors.phone && <span role="alert" className={styles.addressError}>{manualAddressErrors.phone}</span>}
                      </label>
                      <label className={styles.addressField}>
                        <span>우편번호</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          aria-label="우편번호"
                          value={manualAddress.zipCode}
                          onChange={(event) => handleManualAddressChange("zipCode", event.target.value)}
                        />
                        {manualAddressErrors.zipCode && <span role="alert" className={styles.addressError}>{manualAddressErrors.zipCode}</span>}
                      </label>
                    </div>
                    <label className={styles.addressField}>
                      <span>주소</span>
                      <input
                        type="text"
                        aria-label="주소"
                        value={manualAddress.address}
                        onChange={(event) => handleManualAddressChange("address", event.target.value)}
                      />
                      {manualAddressErrors.address && <span role="alert" className={styles.addressError}>{manualAddressErrors.address}</span>}
                    </label>
                    <label className={styles.addressField}>
                      <span>상세 주소</span>
                      <input
                        type="text"
                        aria-label="상세 주소"
                        value={manualAddress.detailAddress}
                        onChange={(event) => handleManualAddressChange("detailAddress", event.target.value)}
                      />
                    </label>
                    <label className={styles.saveAddressCheck}>
                      <input
                        type="checkbox"
                        checked={saveManualAddress}
                        onChange={(event) => setSaveManualAddress(event.target.checked)}
                      />
                      <span>입력한 배송지 저장하기</span>
                    </label>
                  </div>
                )}
              </div>
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>결제 방식</h3>
              <p className={styles.paymentNotice}>
                {buildDemoDataNotice()}
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
                  <span className={styles.pointNote}>
                    보유 포인트와 쿠폰·배송비 적용 후 포인트 사용 전 결제 예정 금액 중 작은 금액까지 사용할 수 있습니다. (최대 {maxUsablePoints.toLocaleString()}원)
                  </span>
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
                {isProcessing ? "주문 처리 중..." : `${finalAmount.toLocaleString()}원 주문 접수하기`}
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
