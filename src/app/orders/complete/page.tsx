"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import PageHeader from "../../_components/PageHeader";
import { Order, OrderItem } from "@/shared/types/order";
import { useAuth } from "@/context/authProvider";
import { OrderService } from "@/shared/services/orderService";
import styles from "./page.module.css";

interface OrderCompleteState {
  loading: boolean;
  error: string | null;
  order: Order | null;
}

function formatCurrency(value: number) {
  return `${Number(value || 0).toLocaleString()}원`;
}

function formatDate(value: Date) {
  return value?.toLocaleString("ko-KR");
}

function getPaymentMethodText(method: string | undefined) {
  switch (method) {
    case "card":
      return "카드";
    case "bank":
      return "계좌";
    case "virtual":
      return "가상계좌";
    case "phone":
      return "휴대폰";
    default:
      return method || "미지정";
  }
}

function OrderCompleteContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const orderId = params.get("orderId");
  const [state, setState] = useState<OrderCompleteState>({
    loading: true,
    error: null,
    order: null,
  });

  useEffect(() => {
    const resolveOrderId = async () => {
      if (orderId) {
        return orderId;
      }

      const savedOrderResult = sessionStorage.getItem("orderResult");
      if (!savedOrderResult) {
        throw new Error("주문번호가 없습니다.");
      }

      const parsed = JSON.parse(savedOrderResult) as { orderId?: string };
      const fallbackOrderId = parsed?.orderId;
      if (!fallbackOrderId) {
        throw new Error("주문 정보가 없습니다.");
      }

      return fallbackOrderId;
    };

    const loadOrder = async () => {
      if (!user) {
        router.push("/auth/login");
        return;
      }

      try {
        const targetOrderId = await resolveOrderId();
        const order = await OrderService.getOrder(targetOrderId);

        if (!order) {
          throw new Error("주문을 찾지 못했습니다.");
        }

        setState({ loading: false, error: null, order });
        sessionStorage.removeItem("orderResult");
      } catch (error) {
        setState({
          loading: false,
          error: error instanceof Error ? error.message : "주문 조회에 실패했습니다.",
          order: null,
        });
      }
    };

    loadOrder();
  }, [orderId, user, router]);

  const order = state.order;

  const itemsSubTotal = useMemo(() => {
    if (!order) return "0원";
    return formatCurrency(
      (order.products || []).reduce((sum: number, item: OrderItem) => {
        return sum + Number(item.price || 0) * Number(item.quantity || 0);
      }, 0)
    );
  }, [order]);

  if (state.loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p>주문 정보를 불러오는 중입니다.</p>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className={styles.container}>
        <div className={styles.processingContainer}>
          <h2 className={styles.processingTitle}>주문 처리 실패</h2>
          <p className={styles.processingNote}>{state.error}</p>
          <Link href="/" className={styles.secondaryButton}>
            홈으로
          </Link>
        </div>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  return (
    <div className={styles.container}>
      <PageHeader
        title="주문 완료"
        description="포트폴리오 데모 주문이 정상적으로 접수되었습니다."
        breadcrumb={[
          { label: "home", href: "/" },
          { label: "주문 완료" },
        ]}
      />

      <div className={styles.content}>
        <div className={styles.completeCard}>
          <div className={styles.successSection}>
            <div className={styles.successIcon}>✓</div>
            <h2 className={styles.successTitle}>주문 완료</h2>
            <p className={styles.successMessage}>주문번호: <strong>{order.orderNumber}</strong></p>
            <p className={styles.successDescription}>
              실제 결제 없이 데모 주문이 접수되었습니다. 주문 및 배송 상태는 마이페이지에서 확인할 수 있습니다.
            </p>
          </div>

          <div className={styles.orderInfo}>
            <h3 className={styles.sectionTitle}>주문 요약</h3>
            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>주문번호</span>
                <span className={styles.infoValue}>{order.orderNumber}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>주문일</span>
                <span className={styles.infoValue}>{formatDate(order.createdAt)}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>상품가 합계</span>
                <span className={styles.infoValue}>{itemsSubTotal}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>배송비</span>
                <span className={styles.infoValue}>{formatCurrency(order.deliveryFee || 0)}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>쿠폰 할인</span>
                <span className={styles.infoValue}>-{formatCurrency(order.discountAmount || 0)}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>포인트 사용</span>
                <span className={styles.infoValue}>-{formatCurrency(order.pointUsed || 0)}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>결제 방법</span>
                <span className={styles.infoValue}>{getPaymentMethodText(order.paymentMethod)}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>최종 결제 금액</span>
                <span className={styles.infoValue}>{formatCurrency(order.finalAmount || 0)}</span>
              </div>
            </div>
          </div>

          <div className={styles.orderProducts}>
            <h3 className={styles.sectionTitle}>주문 상품</h3>
            <div className={styles.productsList}>
              {(order.products || []).map((item) => (
                <div key={`${item.productId}-${item.size}-${item.color}`} className={styles.productItem}>
                  <div className={styles.productImage}>
                    <Image
                      src={item.productImage}
                      alt={item.productName}
                      fill
                      sizes="96px"
                    />
                  </div>
                  <div className={styles.productInfo}>
                    <div className={styles.productBrand}>{item.brand}</div>
                    <div className={styles.productName}>{item.productName}</div>
                    <div className={styles.productOptions}>
                      {item.color} / {item.size} / 수량 {item.quantity}
                    </div>
                  </div>
                  <div className={styles.productPrice}>
                    {formatCurrency(item.price * item.quantity)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.deliveryInfo}>
            <h3 className={styles.sectionTitle}>배송지 정보</h3>
            <div className={styles.addressCard}>
              <div className={styles.addressHeader}>
                <span className={styles.addressName}>{order.shippingAddress?.name || order.deliveryAddress?.name}</span>
              </div>
              <div className={styles.addressRecipient}>
                {(order.shippingAddress?.recipient || order.deliveryAddress?.recipient) || "-"} |{" "}
                {(order.shippingAddress?.phone || order.deliveryAddress?.phone) || "-"}
              </div>
              <div className={styles.addressLocation}>
                ({order.shippingAddress?.zipCode || order.deliveryAddress?.zipCode || "-"}){" "}
                {order.shippingAddress?.address || order.deliveryAddress?.address || "-"}{" "}
                {order.shippingAddress?.detailAddress || order.deliveryAddress?.detailAddress || ""}
              </div>
            </div>
          </div>

          <div className={styles.actionButtons}>
            <div className={styles.buttonGroup}>
              <Link href="/mypage/order-list" className={styles.primaryButton}>
                주문 목록 보기
              </Link>
              <Link href="/" className={styles.secondaryButton}>
                쇼핑 계속하기
              </Link>
            </div>
            <p className={styles.actionNote}>
              주문/배송 상세 내역은 주문 목록에서 확인할 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrderCompletePage() {
  return (
    <Suspense
      fallback={
        <div className={styles.container}>
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <p>주문 정보를 불러오는 중입니다.</p>
          </div>
        </div>
      }
    >
      <OrderCompleteContent />
    </Suspense>
  );
}
