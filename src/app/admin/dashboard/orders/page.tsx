"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/authProvider";
import styles from "./page.module.css";
import { OrderService } from "@/shared/services/orderService";
import { Order, OrderStatus } from "@/shared/types/order";
import { createCsv } from "@/shared/utils/csv";
import { downloadOrdersCsv } from "./downloadOrdersCsv";

interface OrderStats {
  total: number;
  pending: number;
  confirmed: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  totalAmount: number;
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const { user, isAdmin, loading, isUserDataLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats>({ 
    total: 0, 
    pending: 0, 
    confirmed: 0,
    shipped: 0, 
    delivered: 0, 
    cancelled: 0,
    totalAmount: 0 
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 권한 체크
  useEffect(() => {
    if (!isUserDataLoading && !loading) {
      if (!user || !isAdmin) {
        router.push('/auth/login');
      }
    }
  }, [user, isUserDataLoading, isAdmin, router, loading]);

  // 주문 데이터 로드
  const loadOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const [orderList, orderStats] = await Promise.all([
        OrderService.getAllOrders(100),
        OrderService.getOrderStats()
      ]);
      
      setOrders(orderList);
      setStats(orderStats);
    } catch (err) {
      console.error('주문 데이터 로드 실패:', err);
      setError('주문 데이터를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadOrders();
    }
  }, [isAdmin]);

  // 필터링 로직
  useEffect(() => {
    let filtered = orders;

    // 검색어 필터링
    if (searchTerm) {
      filtered = filtered.filter((order: Order) =>
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.shippingAddress?.recipient || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.userId.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 상태 필터링
    if (statusFilter !== "all") {
      filtered = filtered.filter((order: Order) => order.status === statusFilter);
    }

    setFilteredOrders(filtered);
    setCurrentPage(1);
  }, [searchTerm, statusFilter, orders]);

  // 권한 체크 로딩
  if (loading || isUserDataLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        fontSize: '1.2rem'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '20px' }}></div>
          <p>권한을 확인하는 중...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#f8f9fa',
        color: '#dc3545',
        fontSize: '1.1rem'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '20px' }}></div>
          <p>관리자 권한이 필요합니다.</p>
          <button 
            onClick={() => router.push('/auth/login')}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            로그인하기
          </button>
        </div>
      </div>
    );
  }

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await OrderService.updateOrderStatus(orderId, newStatus);
      await loadOrders(); // 데이터 새로고침
      alert('주문 상태가 성공적으로 변경되었습니다.');
    } catch (error) {
      console.error('주문 상태 변경 실패:', error);
      alert('주문 상태 변경에 실패했습니다.');
    }
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
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  const handleExport = () => {
    try {
      const headers = ['주문번호', '고객', '상품수량', '주문금액', '결제방법', '주문일', '상태'];
      const csvData = filteredOrders.map(order => [
        order.orderNumber,
        order.shippingAddress?.recipient || '',
        order.products.reduce((sum, product) => sum + product.quantity, 0),
        order.finalAmount,
        order.paymentMethod,
        formatDate(order.createdAt),
        getStatusText(order.status)
      ]);

      const csvContent = `\ufeff${createCsv([headers, ...csvData])}`;
      downloadOrdersCsv(csvContent);

      alert('주문 데이터를 CSV로 내보냈습니다.');
    } catch (error) {
      console.error('CSV 내보내기 실패:', error);
      alert('CSV 내보내기에 실패했습니다.');
    }
  };

  // 페이지네이션
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentOrders = filteredOrders.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* 페이지 헤더 */}
        <div className={styles.pageHeader}>
          <h2 className={styles.pageTitle}>주문 관리</h2>
          <p className={styles.pageSubtitle}>
            전체 주문 내역을 관리하고 주문 상태를 업데이트하세요
          </p>
        </div>

        {/* 통계 카드 */}
        <div className={styles.statsCards}>
          <div className={`${styles.statsCard} ${styles.total}`}>
            <div className={styles.statsValue}>{stats.total}</div>
            <div className={styles.statsLabel}>전체 주문</div>
          </div>
          <div className={`${styles.statsCard} ${styles.pending}`}>
            <div className={styles.statsValue}>{stats.pending}</div>
            <div className={styles.statsLabel}>결제 대기</div>
          </div>
          <div className={`${styles.statsCard} ${styles.shipping}`}>
            <div className={styles.statsValue}>{stats.confirmed + stats.shipped}</div>
            <div className={styles.statsLabel}>처리/배송 중</div>
          </div>
          <div className={`${styles.statsCard} ${styles.delivered}`}>
            <div className={styles.statsValue}>{stats.delivered}</div>
            <div className={styles.statsLabel}>배송 완료</div>
          </div>
          <div className={`${styles.statsCard} ${styles.amount}`}>
            <div className={styles.statsValue}>{formatCurrency(stats.totalAmount)}</div>
            <div className={styles.statsLabel}>총 주문금액</div>
          </div>
        </div>

        {/* 컨트롤 섹션 */}
        <div className={styles.controlsSection}>
          <div className={styles.controlsGrid}>
            <div className={styles.searchBox}>
              <input
                type="text"
                placeholder="주문번호, 고객명으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.searchInput}
              />
              <span className={styles.searchIcon}></span>
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">전체 상태</option>
              <option value="pending">결제 대기</option>
              <option value="confirmed">주문 확인</option>
              <option value="preparing">상품 준비중</option>
              <option value="shipped">배송 중</option>
              <option value="delivered">배송 완료</option>
              <option value="cancelled">주문 취소</option>
            </select>

            <button onClick={handleExport} className={styles.exportButton}>
              CSV 내보내기
            </button>

            <button onClick={loadOrders} className={styles.refreshButton}>
              새로고침
            </button>
          </div>
        </div>

        {/* 주문 테이블 */}
        <div className={styles.ordersTable}>
          <div className={styles.tableHeader}>
            <h3 className={styles.tableTitle}>주문 목록</h3>
          </div>
          
          {isLoading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner}></div>
              <p>주문 데이터를 불러오는 중...</p>
            </div>
          ) : error ? (
            <div className={styles.errorState}>
              <p>{error}</p>
              <button onClick={loadOrders} className={styles.retryButton}>
                다시 시도
              </button>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className={styles.emptyState}>
              <p>주문 내역이 없습니다.</p>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>주문번호</th>
                  <th>고객정보</th>
                  <th>상품수량</th>
                  <th>주문금액</th>
                  <th>결제방법</th>
                  <th>주문일</th>
                  <th>상태</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {currentOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.orderNumber}</strong>
                    </td>
                    <td>
                      <div>
                        <strong>{order.shippingAddress?.recipient || '정보 없음'}</strong><br />
                        <small style={{ color: '#999' }}>{order.shippingAddress?.phone || ''}</small>
                      </div>
                    </td>
                    <td>{order.products.reduce((sum, product) => sum + product.quantity, 0)}개</td>
                    <td><strong>{formatCurrency(order.finalAmount)}</strong></td>
                    <td>{order.paymentMethod}</td>
                    <td>{formatDate(order.createdAt)}</td>
                    <td>
                      <span className={`${styles.orderStatus} ${styles[order.status]}`}>
                        {getStatusText(order.status)}
                      </span>
                    </td>
                    <td>
                      <button className={`${styles.actionButton} ${styles.primary}`}>
                        상세
                      </button>
                      {order.status === "pending" && (
                        <button 
                          className={styles.actionButton}
                          onClick={() => handleStatusChange(order.id, "confirmed")}
                        >
                          승인
                        </button>
                      )}
                      {order.status === "confirmed" && (
                        <button 
                          className={styles.actionButton}
                          onClick={() => handleStatusChange(order.id, "shipped")}
                        >
                          배송
                        </button>
                      )}
                      {order.status === "shipped" && (
                        <button 
                          className={styles.actionButton}
                          onClick={() => handleStatusChange(order.id, "delivered")}
                        >
                          완료
                        </button>
                      )}
                      <button 
                        className={`${styles.actionButton} ${styles.danger}`}
                        onClick={() => handleStatusChange(order.id, "cancelled")}
                        disabled={order.status === "delivered" || order.status === "cancelled"}
                      >
                        취소
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button
              className={styles.pageButton}
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              이전
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                className={`${styles.pageButton} ${currentPage === page ? styles.active : ''}`}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </button>
            ))}
            
            <button
              className={styles.pageButton}
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
