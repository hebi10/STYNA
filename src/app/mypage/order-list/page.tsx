'use client';

import { useCallback, useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './page.module.css';
import { useAuth } from '@/context/authProvider';
import { OrderService } from '@/shared/services/orderService';
import { Order, OrderStatus } from '@/shared/types/order';
import {
  getCustomerCancellationAvailability,
  getDeliverySearchHref,
} from '@/shared/utils/orderPostPurchase';

export default function OrderListPage() {
  const { user, loading } = useAuth();
  const [selectedStatus, setSelectedStatus] = useState<string>('전체');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('3개월');
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  // 주문 데이터 로드
  const loadOrders = useCallback(async () => {
    if (!user?.uid) {
      console.log('No user UID available');
      return;
    }
    
    try {
      console.log('Loading orders for user:', user.uid);
      setIsLoading(true);
      setError(null);
      const userOrders = await OrderService.getUserOrders(user.uid, 50);
      console.log('Orders loaded:', userOrders.length, 'orders');
      console.log('First order sample:', userOrders[0]);
      setOrders(userOrders);
    } catch (err) {
      console.error('주문 목록 로드 실패:', err);
      const errorDetail = err instanceof Error ? err : null;
      console.error('Error details:', {
        message: errorDetail?.message,
        stack: errorDetail?.stack
      });
      
      // 사용자 친화적인 에러 메시지 처리
      let errorMessage = errorDetail?.message || '주문 목록을 불러오는데 실패했습니다.';
      
      if (errorDetail?.message?.includes('시스템 준비')) {
        errorMessage = '시스템 업데이트 중입니다. 잠시 후 다시 시도해주세요.';
      } else if (errorDetail?.message?.includes('index')) {
        errorMessage = '데이터베이스 최적화 중입니다. 잠시만 기다려주세요.';
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid]);

  // 주문 취소 함수
  const handleCancelOrder = async (orderId: string, orderNumber: string, order: Order) => {
    // 취소 불가능한 상태 체크
    const cancellation = getCustomerCancellationAvailability(order.status);
    if (!cancellation.canCancel) {
      alert(cancellation.message || '이 주문은 취소할 수 없습니다.');
      return;
    }

    const confirmMessage = `주문번호: ${orderNumber}\n총 주문금액: ${formatCurrency(order.finalAmount)}\n\n주문을 취소하시겠습니까?\n\n※ 데모 주문에는 실제 결제가 처리되지 않습니다.\n※ 사용된 포인트와 쿠폰은 즉시 복원됩니다.`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setCancellingOrderId(orderId);
      await OrderService.cancelOrder(orderId, '고객 직접 취소');
      
      // 주문 목록 새로고침
      await loadOrders();
      
      alert('주문이 성공적으로 취소되었습니다.\n\n사용된 포인트와 쿠폰이 복원되었습니다.\n데모 주문에는 실제 환불이 발생하지 않습니다.');
    } catch (error) {
      console.error('주문 취소 실패:', error);
      const message = error instanceof Error ? error.message : '';
      
      let errorMessage = '주문 취소에 실패했습니다.';
      if (message.includes('이미 취소')) {
        errorMessage = '이미 취소된 주문입니다.';
      } else if (message.includes('배송')) {
        errorMessage = '배송이 시작된 주문은 취소할 수 없습니다.\n고객센터로 문의해주세요.';
      }
      
      alert(errorMessage);
    } finally {
      setCancellingOrderId(null);
    }
  };

  useEffect(() => {
    if (user?.uid) {
      loadOrders();
    }
  }, [user?.uid, loadOrders]);

  const getProductImageSrc = (imageUrl?: string) => {
    if (imageUrl && imageUrl.includes('firebasestorage.googleapis.com')) {
      try {
        const url = new URL(imageUrl);
        url.search = 'alt=media';
        return url.toString();
      } catch {
        return '/tshirt-1.jpg';
      }
    }

    if (imageUrl && imageUrl.startsWith('/')) {
      return imageUrl;
    }

    return '/tshirt-1.jpg';
  };

  if (loading) return <div>로딩 중...</div>;
  if (!user) return <div>로그인이 필요합니다.</div>;

  const statusOptions = ['전체', 'pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'];
  const statusLabels: Record<string, string> = {
    '전체': '전체',
    'pending': '결제 대기',
    'confirmed': '주문 확인',
    'preparing': '상품 준비중',
    'shipped': '배송중',
    'delivered': '배송완료',
    'cancelled': '취소',
  };
  
  const periodOptions = ['1개월', '3개월', '6개월', '1년'];

  // 필터링된 주문 목록
  const filteredOrders = orders.filter(order => {
    if (selectedStatus === '전체') return true;
    return order.status === selectedStatus;
  });

  // 통계 계산
  const stats = {
    total: orders.length,
    shipped: orders.filter(o => o.status === 'shipped').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    totalAmount: orders.reduce((sum, order) => sum + (order.finalAmount || 0), 0)
  };

  const getStatusText = (status: OrderStatus) => {
    switch (status) {
      case "pending": return "결제 대기";
      case "confirmed": return "주문 확인";
      case "preparing": return "상품 준비중";
      case "shipped": return "배송 중";
      case "delivered": return "배송 완료";
      case "cancelled": return "주문 취소";
      case "returned": return "반품";
      case "exchanged": return "교환";
      default: return status;
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(date));
  };

  const formatCurrency = (amount: number | string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('ko-KR').format(numAmount || 0) + '원';
  };

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>주문/배송 조회</h2>
        <p className={styles.pageDesc}>주문하신 상품의 주문내역을 확인하실 수 있습니다.</p>
      </div>

      {/* Statistics Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}></div>
          <div className={styles.statContent}>
            <div className={styles.statNumber}>{stats.total}</div>
            <div className={styles.statLabel}>총 주문</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}></div>
          <div className={styles.statContent}>
            <div className={styles.statNumber}>{stats.shipped}</div>
            <div className={styles.statLabel}>배송중</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}></div>
          <div className={styles.statContent}>
            <div className={styles.statNumber}>{stats.delivered}</div>
            <div className={styles.statLabel}>배송완료</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}></div>
          <div className={styles.statContent}>
            <div className={styles.statNumber}>{formatCurrency(stats.totalAmount)}</div>
            <div className={styles.statLabel}>총 구매금액</div>
          </div>
        </div>
      </div>

      {/* Filter Section */}
      <div className={styles.filterSection}>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>주문상태</label>
          <div className={styles.filterButtons}>
            {statusOptions.map((status) => (
              <button
                key={status}
                className={`${styles.filterButton} ${selectedStatus === status ? styles.active : ''}`}
                onClick={() => setSelectedStatus(status)}
              >
                {statusLabels[status] || status}
              </button>
            ))}
          </div>
        </div>
        
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>조회기간</label>
          <div className={styles.filterButtons}>
            {periodOptions.map((period) => (
              <button
                key={period}
                className={`${styles.filterButton} ${selectedPeriod === period ? styles.active : ''}`}
                onClick={() => setSelectedPeriod(period)}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className={styles.ordersSection}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>주문 목록</h3>
          <div className={styles.resultCount}>총 {filteredOrders.length}건</div>
          <button 
            onClick={loadOrders} 
            className={styles.refreshButton}
            disabled={isLoading}
          >
            {isLoading ? '새로고침 중...' : '새로고침'}
          </button>
        </div>

        <div className={styles.ordersList}>
          {isLoading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner}></div>
              <p>주문 목록을 불러오는 중...</p>
            </div>
          ) : error ? (
            <div className={styles.errorState}>
              <div className={styles.errorIcon}>
                {error.includes('시스템 준비') || error.includes('최적화') ? '!' : 'X'}
              </div>
              <h3>
                {error.includes('시스템 준비') || error.includes('최적화') 
                  ? '시스템 업데이트 중' 
                  : '주문 목록 오류'
                }
              </h3>
              <p>{error}</p>
              <div className={styles.errorActions}>
                <button onClick={loadOrders} className={styles.retryButton}>
                  다시 시도
                </button>
                {error.includes('시스템 준비') && (
                  <p className={styles.waitingNote}>
                    시스템 최적화가 완료되면 자동으로 정상 작동됩니다.
                  </p>
                )}
              </div>
            </div>
          ) : filteredOrders.length > 0 ? (
            filteredOrders.map((order) => (
              <div key={order.id} className={styles.orderCard}>
                <div className={styles.orderHeader}>
                  <div className={styles.orderInfo}>
                    <span className={styles.orderId}>{order.orderNumber}</span>
                    <span className={styles.orderDate}>{formatDate(order.createdAt)}</span>
                  </div>
                  <div className={styles.orderStatusBadge}>
                    <span className={`${styles.statusDot} ${styles[`status-${order.status}`]}`}></span>
                    {getStatusText(order.status)}
                  </div>
                </div>

                <div className={styles.orderProducts}>
                  {order.products.map((product, index) => (
                    <div
                      key={`${order.id}-${product.productId || product.id}-${product.size}-${product.color}-${index}`}
                      className={styles.productItem}
                    >
                      <div className={styles.productImage}>
                        <Image
                          src={getProductImageSrc(product.productImage)}
                          alt={product.productName || '상품 이미지'}
                          className={styles.productImg}
                          fill
                          sizes="96px"
                        />
                      </div>
                      <div className={styles.productInfo}>
                        <div className={styles.productBrand}>{product.brand}</div>
                        <div className={styles.productName}>{product.productName}</div>
                        <div className={styles.productOption}>
                          {product.color} / {product.size} / 수량 {product.quantity}개
                        </div>
                      </div>
                      <div className={styles.productPrice}>
                        {formatCurrency(product.price * product.quantity)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className={styles.orderFooter}>
                  <div className={styles.orderTotal}>
                  총 주문금액: <strong>{formatCurrency(order.finalAmount)}</strong>
                  {!!(order.discountAmount && order.discountAmount > 0) && (
                    <span className={styles.discountAmount}>
                      (할인 {formatCurrency(order.discountAmount)})
                    </span>
                  )}
                </div>
                  <div className={styles.orderActions}>
                    <Link href={`/mypage/order-detail/${order.id}`} className={styles.actionButton}>
                      주문상세
                    </Link>
                    {(order.status === 'shipped' || order.status === 'delivered') && (
                      <Link href={getDeliverySearchHref(order)} className={styles.actionButton}>
                        배송조회
                      </Link>
                    )}
                    {order.status === 'delivered' && (
                      <span className={styles.cancelNotice}>
                        리뷰는 주문 상품 상세의 리뷰 탭에서 작성할 수 있습니다.
                      </span>
                    )}
                    {getCustomerCancellationAvailability(order.status).canCancel && (
                      <button 
                        className={`${styles.actionButton} ${styles.cancel}`}
                        onClick={() => handleCancelOrder(order.id, order.orderNumber, order)}
                        disabled={cancellingOrderId === order.id}
                      >
                        {cancellingOrderId === order.id ? '취소 중...' : '주문취소'}
                      </button>
                    )}
                    {!getCustomerCancellationAvailability(order.status).canCancel
                      && ['preparing', 'shipped'].includes(order.status) && (
                      <div className={styles.cancelNotice}>
                        <span className={styles.noticeIcon}></span>
                        <span className={styles.noticeText}>
                          {getCustomerCancellationAvailability(order.status).message}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}></div>
              <div className={styles.emptyTitle}>주문 내역이 없습니다</div>
              <div className={styles.emptyDesc}>
                {selectedStatus === '전체' 
                  ? '아직 주문하신 상품이 없습니다.' 
                  : `'${statusLabels[selectedStatus]}' 상태의 주문이 없습니다.`
                }
              </div>
              <Link href="/" className={styles.shopButton}>
                쇼핑하러 가기
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
