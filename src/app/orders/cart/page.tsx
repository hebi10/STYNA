"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "../../_components/PageHeader";
import Button from "../../_components/Button";
import { useAuth } from "@/context/authProvider";
import { useCoupon } from "@/context/couponProvider";
import { useCart, useUpdateCartItem, useRemoveFromCart } from "@/shared/hooks/useCart";
import {
  COMMERCE_POLICY,
  formatShippingPolicy,
} from "@/shared/constants/commercePolicy";
import { CartItem } from "@/shared/types/cart";
import {
  calculateOrderPreview,
  getCouponAvailability,
} from "@/shared/utils/orderPricing";
import styles from "./page.module.css";

// 장바구니 아이템에 선택 상태 추가
interface CartItemWithSelection extends CartItem {
  selected: boolean;
}

export default function OrderCartPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { userCoupons } = useCoupon();
  
  // Firebase 장바구니 데이터 가져오기
  const { data: cart, isLoading: cartLoading, error: cartError } = useCart(user?.uid || null);
  const updateCartItemMutation = useUpdateCartItem();
  const removeFromCartMutation = useRemoveFromCart();
  
  // 장바구니 아이템에 선택 상태 추가
  const [cartItems, setCartItems] = useState<CartItemWithSelection[]>([]);
  const [selectedCoupon, setSelectedCoupon] = useState<string>("");
  const [selectAll, setSelectAll] = useState(true);
  const [deliveryOption, setDeliveryOption] = useState<"standard" | "express">("standard");

  // Firebase 장바구니 데이터를 로컬 상태로 변환
  useEffect(() => {
    if (cart?.items) {
      const itemsWithSelection: CartItemWithSelection[] = cart.items.map(item => ({
        ...item,
        selected: true // 기본적으로 모든 아이템 선택
      }));
      setCartItems(itemsWithSelection);
    }
  }, [cart]);

  // 로그인 체크
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login?redirect=/orders/cart");
    }
  }, [authLoading, user, router]);

  // 수량 변경
  const updateQuantity = async (id: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    
    try {
      // 로컬 상태 즉시 업데이트
      setCartItems(items =>
        items.map(item =>
          item.id === id ? { ...item, quantity: newQuantity } : item
        )
      );

      // Firebase 업데이트
      if (user) {
        await updateCartItemMutation.mutateAsync({
          userId: user.uid,
          request: { cartItemId: id, quantity: newQuantity }
        });
      }
    } catch (error) {
      console.error('수량 업데이트 실패:', error);
      alert('수량 변경에 실패했습니다.');
    }
  };

  // 상품 제거
  const removeItem = async (id: string) => {
    try {
      // 로컬 상태 즉시 업데이트
      setCartItems(items => items.filter(item => item.id !== id));
      
      // Firebase에서 제거
      if (user) {
        await removeFromCartMutation.mutateAsync({
          userId: user.uid,
          cartItemId: id
        });
      }
    } catch (error) {
      console.error('아이템 제거 실패:', error);
      alert('상품 제거에 실패했습니다.');
    }
  };

  // 전체 선택/해제
  const toggleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    setCartItems(items =>
      items.map(item => ({ ...item, selected: newSelectAll }))
    );
  };

  // 개별 상품 선택/해제
  const toggleItemSelect = (id: string) => {
    setCartItems(items =>
      items.map(item =>
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    );
    
    // 전체 선택 상태 업데이트
    const updatedItems = cartItems.map(item =>
      item.id === id ? { ...item, selected: !item.selected } : item
    );
    setSelectAll(updatedItems.every(item => item.selected));
  };

  // 주문 계산
  const selectedItems = cartItems.filter(item => item.selected && item.isAvailable);
  const selectedCouponView = userCoupons?.find(coupon => coupon.id === selectedCoupon) || null;
  const orderPreview = useMemo(
    () => calculateOrderPreview({
      items: selectedItems,
      deliveryOption,
      selectedCoupon: selectedCouponView,
      requestedPointAmount: 0,
      pointBalance: 0,
    }),
    [selectedItems, deliveryOption, selectedCouponView]
  );
  const standardDeliveryPreview = useMemo(
    () => calculateOrderPreview({
      items: selectedItems,
      deliveryOption: "standard",
      selectedCoupon: selectedCouponView,
      requestedPointAmount: 0,
      pointBalance: 0,
    }),
    [selectedItems, selectedCouponView]
  );

  const subtotal = orderPreview.subtotal;
  const totalDiscountAmount = orderPreview.productDiscountAmount;
  const couponDiscount = orderPreview.couponDiscount;
  const deliveryFee = orderPreview.deliveryFee;
  const finalAmount = orderPreview.finalAmount;

  // 주문하기
  const handleCheckout = () => {
    if (selectedItems.length === 0) {
      alert("선택된 상품이 없습니다.");
      return;
    }
    
    const orderData = {
      items: selectedItems.map((item) => ({
        productId: item.productId,
        id: item.id,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        productName: item.productName,
        productImage: item.productImage,
        brand: item.brand,
        price: item.price,
        discountAmount: item.discountAmount,
      })),
      subtotal,
      couponDiscount,
      deliveryFee,
      finalAmount,
      selectedCoupon: orderPreview.usableCoupon?.id || "",
      pricingPreview: {
        subtotal: orderPreview.subtotal,
        productDiscountAmount: orderPreview.productDiscountAmount,
        couponDiscount: orderPreview.couponDiscount,
        deliveryFee: orderPreview.deliveryFee,
        finalAmount: orderPreview.finalAmount,
      },
      deliveryOption
    };
    
    // 주문 데이터를 세션 스토리지에 저장
    sessionStorage.setItem("orderData", JSON.stringify(orderData));
    
    // 주문서 작성 페이지로 이동
    router.push("/orders/checkout");
  };

  if (authLoading || !user) {
    return <div>로그인이 필요합니다...</div>;
  }

  if (cartLoading) {
    return (
      <div className={styles.container}>
        <PageHeader
          title="주문/결제"
          description="장바구니를 불러오는 중..."
          breadcrumb={[
            { label: '홈', href: '/' },
            { label: '장바구니', href: '/orders/cart' },
            { label: '주문/결제' }
          ]}
        />
        <div className={styles.content}>
          <div className={styles.loading}>장바구니를 불러오는 중...</div>
        </div>
      </div>
    );
  }

  if (cartError) {
    return (
      <div className={styles.container}>
        <PageHeader
          title="주문/결제"
          description="장바구니 오류"
          breadcrumb={[
            { label: '홈', href: '/' },
            { label: '장바구니', href: '/orders/cart' },
            { label: '주문/결제' }
          ]}
        />
        <div className={styles.content}>
          <div className={styles.error}>
            장바구니를 불러오는 중 오류가 발생했습니다.
            <Button onClick={() => window.location.reload()}>다시 시도</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!cart || cartItems.length === 0) {
    return (
      <div className={styles.container}>
        <PageHeader
          title="주문/결제"
          description="안전하고 빠른 주문 처리"
          breadcrumb={[
            { label: '홈', href: '/' },
            { label: '장바구니', href: '/orders/cart' },
            { label: '주문/결제' }
          ]}
        />
        
        <div className={styles.content}>
          <div className={styles.emptyCart}>
            <div className={styles.emptyIcon}></div>
            <h2 className={styles.emptyTitle}>주문할 상품이 없습니다</h2>
            <p className={styles.emptyDescription}>
              장바구니에서 상품을 선택하고 주문을 진행해주세요.
            </p>
            <Link href="/recommend">
              <Button size="lg">쇼핑 계속하기</Button>
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
        description={`${selectedItems.length}개 상품 주문 진행`}
        breadcrumb={[
          { label: '홈', href: '/' },
          { label: '장바구니', href: '/orders/cart' },
          { label: '주문/결제' }
        ]}
      />
      
      <div className={styles.content}>
        <div className={styles.orderLayout}>
          {/* 주문 상품 목록 */}
          <div className={styles.orderItems}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>주문 상품</h2>
              <label className={styles.selectAll}>
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={toggleSelectAll}
                />
                전체선택 ({selectedItems.length}/{cartItems.length})
              </label>
            </div>

            <div className={styles.itemsList}>
              {cartItems.map((item) => (
                <div 
                  key={item.id} 
                  className={`${styles.orderItem} ${!item.isAvailable ? styles.unavailable : ''}`}
                >
                  <div className={styles.itemCheckbox}>
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={() => toggleItemSelect(item.id)}
                      disabled={!item.isAvailable}
                    />
                  </div>
                  
                  <div className={styles.itemImage}>
                    <Image
                      src={item.productImage}
                      alt={item.productName}
                      fill
                      sizes="96px"
                    />
                  </div>
                  
                  <div className={styles.itemDetails}>
                    <div className={styles.itemBrand}>{item.brand}</div>
                    <h3 className={styles.itemName}>{item.productName}</h3>
                    <div className={styles.itemOptions}>
                      옵션: {item.color} / {item.size}
                    </div>
                    
                    {!item.isAvailable && (
                      <div className={styles.unavailableNotice}>
                        일시품절 상품입니다
                      </div>
                    )}
                  </div>

                  <div className={styles.itemQuantity}>
                    <div className={styles.quantityControl}>
                      <button
                        className={styles.quantityButton}
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        disabled={!item.isAvailable}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                        className={styles.quantityInput}
                        disabled={!item.isAvailable}
                      />
                      <button
                        className={styles.quantityButton}
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        disabled={!item.isAvailable}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  
                  <div className={styles.itemPrice}>
                    {item.discountAmount > 0 && (
                      <div className={styles.originalPrice}>
                        {(item.price + item.discountAmount).toLocaleString()}원
                      </div>
                    )}
                    <div className={styles.salePrice}>
                      {(item.price * item.quantity).toLocaleString()}원
                    </div>
                  </div>

                  <button
                    className={styles.removeButton}
                    onClick={() => removeItem(item.id)}
                    aria-label="상품 삭제"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>

            {/* 배송 옵션 */}
            <div className={styles.deliverySection}>
              <h3 className={styles.sectionSubtitle}>배송 옵션</h3>
              <div className={styles.deliveryOptions}>
                <label className={styles.deliveryOption}>
                  <input
                    type="radio"
                    name="delivery"
                    value="standard"
                    checked={deliveryOption === "standard"}
                    onChange={(e) => setDeliveryOption(e.target.value as "standard")}
                  />
                  <div className={styles.optionContent}>
                    <div className={styles.optionTitle}>일반 배송</div>
                    <div className={styles.optionDesc}>{formatShippingPolicy()}</div>
                    <div className={styles.optionPrice}>
                      {standardDeliveryPreview.deliveryFee === 0
                        ? "무료"
                        : `${standardDeliveryPreview.deliveryFee.toLocaleString("ko-KR")}원`}
                    </div>
                  </div>
                </label>
                
                <label className={styles.deliveryOption}>
                  <input
                    type="radio"
                    name="delivery"
                    value="express"
                    checked={deliveryOption === "express"}
                    onChange={(e) => setDeliveryOption(e.target.value as "express")}
                  />
                  <div className={styles.optionContent}>
                    <div className={styles.optionTitle}>특급 배송 옵션(데모)</div>
                    <div className={styles.optionDesc}>배송 일정은 주문별 배송 상태에서 확인할 수 있습니다.</div>
                    <div className={styles.optionPrice}>
                      {COMMERCE_POLICY.shipping.expressFee.toLocaleString("ko-KR")}원
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* 쿠폰 선택 */}
            <div className={styles.couponSection}>
              <h3 className={styles.sectionSubtitle}>쿠폰 적용</h3>
              <div className={styles.couponSelect}>
                <select
                  value={selectedCoupon}
                  onChange={(e) => setSelectedCoupon(e.target.value)}
                  className={styles.couponDropdown}
                >
                  <option value="">쿠폰을 선택해주세요</option>
                  {userCoupons?.map(coupon => {
                    const availability = getCouponAvailability(coupon, subtotal);
                    const suffix = !availability.usable
                      ? availability.reason === "minimum"
                        ? ` - ${coupon.coupon.minOrderAmount?.toLocaleString()}원 이상 사용`
                        : availability.reason === "expired"
                          ? " - 만료"
                          : " - 사용 불가"
                      : "";

                    return (
                      <option key={coupon.id} value={coupon.id} disabled={!availability.usable}>
                        {coupon.coupon.name} - {coupon.coupon.type === '할인율'
                          ? `${coupon.coupon.value}%`
                          : coupon.coupon.type === '무료배송'
                            ? '무료배송'
                            : `${coupon.coupon.value.toLocaleString()}원`} 할인{suffix}
                      </option>
                    );
                  })}
                </select>
                <Link href="/mypage/coupons" className={styles.couponLink}>
                  쿠폰함 보기
                </Link>
              </div>
            </div>
          </div>

          {/* 결제 정보 */}
          <div className={styles.paymentSummary}>
            <div className={styles.summaryContent}>
              <h3 className={styles.summaryTitle}>결제 정보</h3>
              
              <div className={styles.summaryItems}>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>상품금액</span>
                  <span className={styles.summaryValue}>
                    {subtotal.toLocaleString()}원
                  </span>
                </div>
                
                {totalDiscountAmount > 0 && (
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>상품할인</span>
                    <span className={styles.summaryValue}>
                      -{totalDiscountAmount.toLocaleString()}원
                    </span>
                  </div>
                )}
                
                {couponDiscount > 0 && (
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>쿠폰할인</span>
                    <span className={styles.summaryValue}>
                      -{couponDiscount.toLocaleString()}원
                    </span>
                  </div>
                )}
                
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>배송비</span>
                  <span className={styles.summaryValue}>
                    {deliveryFee === 0 ? "무료" : `${deliveryFee.toLocaleString()}원`}
                  </span>
                </div>
              </div>

              <div className={styles.summaryDivider} />
              
              <div className={styles.totalAmount}>
                <span className={styles.totalLabel}>최종 결제금액</span>
                <span className={styles.totalValue}>
                  {finalAmount.toLocaleString()}원
                </span>
              </div>

              <div className={styles.actionButtons}>
                <button
                  className={styles.checkoutButton}
                  onClick={handleCheckout}
                  disabled={selectedItems.length === 0}
                >
                  {finalAmount.toLocaleString()}원 결제하기
                </button>
                
                <Link href="/recommend" className={styles.backButton}>
                  쇼핑 계속하기
                </Link>
              </div>

              {/* 혜택 정보 */}
              <div className={styles.benefitInfo}>
                <div className={styles.benefitTitle}>혜택 정보</div>
                <ul className={styles.benefitList}>
                  <li>{formatShippingPolicy()}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
