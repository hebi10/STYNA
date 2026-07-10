"use client";

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/authProvider';
import PageHeader from '@/app/_components/PageHeader';
import { OrderService } from '@/shared/services/orderService';
import { Order } from '@/shared/types/order';
import { getDeliveryPresentation } from '@/shared/utils/orderPostPurchase';
import styles from './page.module.css';

export default function DeliveryPage() {
  return (
    <Suspense fallback={<div>배송 정보를 준비하는 중입니다.</div>}>
      <DeliveryPageContent />
    </Suspense>
  );
}

function DeliveryPageContent() {
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();
  const orderIdFromLink = searchParams.get('orderId') || '';
  const [searchValue, setSearchValue] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!user?.uid) return;

    try {
      setIsLoading(true);
      setLoadError(null);
      setOrders(await OrderService.getUserOrders(user.uid, 50));
    } catch (error) {
      console.error('배송 조회 주문 로드 실패:', error);
      setLoadError('배송 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (user?.uid) {
      void loadOrders();
    }
  }, [loadOrders, user?.uid]);

  const selectedOrder = useMemo(() => {
    const searchTerm = submittedSearch.trim();

    if (orderIdFromLink) {
      return orders.find((order) => order.id === orderIdFromLink);
    }

    if (!searchTerm) return null;

    return orders.find((order) => (
      order.orderNumber === searchTerm || order.trackingNumber?.trim() === searchTerm
    ));
  }, [orderIdFromLink, orders, submittedSearch]);

  const hasSearchRequest = Boolean(orderIdFromLink || submittedSearch.trim());
  const delivery = selectedOrder ? getDeliveryPresentation(selectedOrder) : null;

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmittedSearch(searchValue.trim());
  };

  return (
    <>
      <PageHeader title="배송조회" />
      <div className={styles.deliveryContainer}>
        <div className={styles.searchSection}>
          <h2 className={styles.searchTitle}>주문 배송 정보</h2>
          <form onSubmit={handleSearch} className={styles.searchForm}>
            <div className={styles.formGroup}>
              <label htmlFor="searchValue" className={styles.label}>
                주문번호 또는 송장번호
              </label>
              <input
                type="text"
                id="searchValue"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                className={styles.input}
                placeholder="내 주문번호 또는 송장번호를 입력하세요"
              />
            </div>
            <button type="submit" className={styles.searchButton} disabled={!user || isLoading}>
              조회
            </button>
          </form>
          <div className={styles.note}>
            외부 택배사의 실시간 배송 추적 기능은 연결되어 있지 않습니다. 이 화면에서는 내 주문에 등록된
            운송장 정보와 현재 주문 상태만 확인할 수 있습니다.
          </div>
        </div>

        <div className={styles.resultSection} aria-live="polite">
          {loading ? (
            <div className={styles.noResult}><p>로그인 상태를 확인하는 중입니다.</p></div>
          ) : !user ? (
            <div className={styles.loginPrompt}>
              <h3>로그인하면 주문별 배송 현황을 확인할 수 있습니다</h3>
              <p>회원 주문의 운송장 정보와 주문 상태는 로그인 후에만 조회할 수 있습니다.</p>
              <Link href="/auth/login?redirect=/mypage/order-list" className={styles.loginButton}>로그인하기</Link>
            </div>
          ) : isLoading ? (
            <div className={styles.noResult}><p>주문 배송 정보를 불러오는 중입니다.</p></div>
          ) : loadError ? (
            <div className={styles.noResult}>
              <h3>배송 정보를 불러오지 못했습니다</h3>
              <p>{loadError}</p>
              <button type="button" onClick={loadOrders} className={styles.searchButton}>다시 시도</button>
            </div>
          ) : selectedOrder && delivery ? (
            <div className={styles.loginPrompt}>
              <h3>{delivery.headline}</h3>
              <p>주문번호: {selectedOrder.orderNumber}</p>
              <p>{delivery.description}</p>
              {delivery.state === 'registered' ? (
                <>
                  <p>택배회사: {delivery.deliveryCompany}</p>
                  <p>운송장번호: {delivery.trackingNumber}</p>
                </>
              ) : null}
              <Link href={`/mypage/order-detail/${selectedOrder.id}`} className={styles.loginButton}>
                주문 상세 보기
              </Link>
            </div>
          ) : hasSearchRequest ? (
            <div className={styles.noResult}>
              <h3>내 주문에서 배송 정보를 찾지 못했습니다</h3>
              <p>주문번호 또는 송장번호를 다시 확인해 주세요.</p>
              <Link href="/mypage/order-list" className={styles.loginButton}>주문내역 보기</Link>
            </div>
          ) : (
            <div className={styles.loginPrompt}>
              <h3>주문번호 또는 송장번호를 입력해 주세요</h3>
              <p>주문내역에서도 배송 정보와 운송장 등록 여부를 확인할 수 있습니다.</p>
              <Link href="/mypage/order-list" className={styles.loginButton}>주문내역 보기</Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
