'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/authProvider';
import { useDashboardData, useDashboardFormatters } from '@/shared/hooks/useDashboardQuery';
import { SimpleQnAService } from '@/shared/services/simpleQnAService';
import Chart from './_components/Chart';
import ErrorBoundary from './_components/ErrorBoundary';
import LoadingSpinner from './_components/LoadingSpinner';
import { getCategoryNames } from '@/shared/utils/categoryUtils';
import styles from './page.module.css';

export default function AdminDashboard() {
  return (
    <ErrorBoundary>
      <DashboardContent />
    </ErrorBoundary>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const { stats, loading, error, lastUpdated, refresh, isRefreshing } = useDashboardData();
  const { formatNumber, formatCurrency, formatTimeAgo } = useDashboardFormatters();
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [isCachedData, setIsCachedData] = useState(false);
  
  // QnA 데이터 상태
  const [qnaStats, setQnaStats] = useState({
    total: 0,
    waiting: 0,
    answered: 0,
    closed: 0,
  });
  const [qnaLoading, setQnaLoading] = useState(true);

  // 캐시 상태 확인
  useEffect(() => {
    if (lastUpdated) {
      const cacheAge = Date.now() - lastUpdated.getTime();
      setIsCachedData(cacheAge > 60000); // 1분 이상 지난 데이터는 캐시로 간주
    }
  }, [lastUpdated]);

  // 카테고리 이름 매핑 로드
  useEffect(() => {
    const loadCategoryNames = async () => {
      try {
        setCategoryNames(await getCategoryNames());
      } catch (error) {
        console.error('카테고리 이름 로드 실패:', error);
        setCategoryNames({});
      }
    };

    loadCategoryNames();
  }, []);

  // QnA 통계 로드
  useEffect(() => {
    const loadQnaStats = async () => {
      try {
        const qnas = await SimpleQnAService.getAllQnAs(100);
        const statsData = {
          total: qnas.length,
          waiting: qnas.filter(q => q.status === 'waiting').length,
          answered: qnas.filter(q => q.status === 'answered').length,
          closed: qnas.filter(q => q.status === 'closed').length,
        };
        setQnaStats(statsData);
      } catch (err) {
        console.error('Error loading QnA stats:', err);
      } finally {
        setQnaLoading(false);
      }
    };

    loadQnaStats();
  }, []);

  if (loading && !stats) {
    return (
      <div className={styles.dashboard}>
        <LoadingSpinner 
          size="large" 
          message="대시보드 데이터를 불러오는 중..." 
        />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.error}>
          <h2>데이터를 불러올 수 없습니다</h2>
          <p>{error}</p>
          <button onClick={refresh} className={styles.retryButton}>
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.noData}>
          <p>표시할 데이터가 없습니다.</p>
        </div>
      </div>
    );
  }

  // 차트 데이터 준비
  const revenueChartData = stats.revenueByMonth.slice(-6).map(item => ({
    label: item.month.split('-')[1] + '월',
    value: item.revenue
  }));

  const orderStatusChartData = Object.entries(stats.orderStatusStats).map(([status, count]) => ({
    label: getStatusText(status),
    value: count
  }));

  const categoryChartData = stats.categoryBreakdown.map((item) => ({
    label: categoryNames[item.categoryId] || item.categoryId,
    value: item.value,
  }));

  const categoryChartTitle =
    stats.categoryBreakdownType === 'sales'
      ? '카테고리별 판매량'
      : '카테고리별 등록 상품 수';

  return (
    <div className={styles.dashboard}>
      {/* 관리자 세션 정보 헤더 */}
      <div className={styles.sessionHeader}>
        <div className={styles.sessionInfo}>
          <div className={styles.adminBadge}>
            <span>관리자</span>
          </div>
          <div className={styles.sessionDetails}>
            <span className={styles.userName}>{user?.displayName || user?.email}</span>
            <span className={styles.separator}>|</span>
            <span className={styles.role}>admin</span>
          </div>
        </div>
        
        <div className={styles.dataStatus}>
          <div className={styles.syncInfo}>
            <span className={styles.dataType}>
              {isCachedData ? (
                <>캐시 데이터</>
              ) : (
                <>실시간 동기화</>
              )}
            </span>
            {lastUpdated && (
              <span className={styles.syncTime}>
                최종 갱신: {formatTimeAgo(lastUpdated)}
              </span>
            )}
          </div>
          <button 
            onClick={refresh} 
            className={styles.syncButton}
            disabled={isRefreshing}
            title="데이터 새로고침"
          >
            {isRefreshing ? '갱신 중...' : '새로고침'}
          </button>
        </div>
      </div>

      {/* 핵심 지표 */}
      <div className={styles.metricsSection}>
        <h2 className={styles.sectionTitle}>핵심 지표</h2>
        
        <div className={styles.statsGrid}>
          {/* 사용자 통계 */}
          {stats.dataAvailability.users && (
            <div className={styles.metricCard}>
              <div className={styles.metricHeader}>
                <h3>등록 사용자</h3>
              </div>
              <div className={styles.metricValue}>
                {formatNumber(stats.totalUsers)}
              </div>
              <div className={styles.metricDetails}>
                <span className={styles.aggregation}>
                  users/ · count() query
                </span>
                <span className={styles.trend}>
                  {stats.monthlyGrowth.users >= 0 ? '+' : ''}{stats.monthlyGrowth.users}% (7일)
                </span>
              </div>
            </div>
          )}

          {/* 상품 통계 */}
          {stats.dataAvailability.products && (
            <div className={styles.metricCard}>
              <div className={styles.metricHeader}>
                <h3>등록 상품</h3>
              </div>
              <div className={styles.metricValue}>
                {formatNumber(stats.totalProducts)}
              </div>
              <div className={styles.metricDetails}>
                <span className={styles.aggregation}>
                  products/ · 복합 쿼리
                </span>
                <span className={styles.trend}>
                  {stats.monthlyGrowth.products >= 0 ? '+' : ''}{stats.monthlyGrowth.products}% (7일)
                </span>
              </div>
            </div>
          )}

          {/* 주문 통계 */}
          {stats.dataAvailability.orders && (
            <div className={styles.metricCard}>
              <div className={styles.metricHeader}>
                <h3>주문 건수</h3>
              </div>
              <div className={styles.metricValue}>
                {formatNumber(stats.totalOrders)}
              </div>
              <div className={styles.metricDetails}>
                <span className={styles.aggregation}>
                  orders/ · writeBatch
                </span>
                <span className={styles.trend}>
                  {stats.monthlyGrowth.orders >= 0 ? '+' : ''}{stats.monthlyGrowth.orders}% (7일)
                </span>
              </div>
            </div>
          )}

          {/* QnA 통계 */}
          {!qnaLoading && qnaStats.total > 0 && (
            <div className={`${styles.metricCard} ${qnaStats.waiting > 0 ? styles.metricCardAlert : ''}`}>
              <div className={styles.metricHeader}>
                <h3>문의 관리</h3>
                {qnaStats.waiting > 0 && (
                  <span className={styles.waitingBadge}>답변대기 {qnaStats.waiting}</span>
                )}
              </div>
              <div className={styles.metricValue}>
                {formatNumber(qnaStats.total)}
              </div>
              <div className={styles.metricDetails}>
                <span className={styles.aggregation}>
                  qna/ · status 인덱스
                </span>
                <span className={styles.trend}>
                  SLA: 24시간 이내 답변
                </span>
              </div>
            </div>
          )}

          {/* 매출 통계 */}
          {stats.dataAvailability.orders && stats.totalRevenue > 0 && (
            <div className={styles.metricCard}>
              <div className={styles.metricHeader}>
                <h3>순매출</h3>
              </div>
              <div className={styles.metricValue}>
                {formatCurrency(stats.totalRevenue)}
              </div>
              <div className={styles.metricDetails}>
                <span className={styles.aggregation}>
                  orders/ · 월별 집계
                </span>
                <span className={styles.trend}>
                  {stats.monthlyGrowth.revenue >= 0 ? '+' : ''}{stats.monthlyGrowth.revenue}% (7일)
                </span>
                {stats.excludedRevenueOrderCount > 0 && (
                  <span className={styles.aggregation}>
                    취소·반품·교환 제외 {formatNumber(stats.excludedRevenueOrderCount)}건
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 쿠폰 통계 */}
          {stats.dataAvailability.coupons && stats.totalCoupons > 0 && (
            <div className={styles.metricCard}>
              <div className={styles.metricHeader}>
                <h3>발급 쿠폰</h3>
              </div>
              <div className={styles.metricValue}>
                {formatNumber(stats.totalCoupons)}
              </div>
              <div className={styles.metricDetails}>
                <span className={styles.aggregation}>
                  coupons/ + userCoupons/ · 조인
                </span>
                <span className={styles.trend}>
                  {stats.monthlyGrowth.coupons >= 0 ? '+' : ''}{stats.monthlyGrowth.coupons}% (7일)
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 차트 섹션 - 데이터가 있을 때만 표시 */}
      {(stats.dataAvailability.orders || stats.dataAvailability.products) && (
        <div className={styles.chartsGrid}>
          {/* 매출 차트 - 주문 데이터가 있을 때만 */}
          {stats.dataAvailability.orders && stats.revenueByMonth.length > 0 && (
            <div className={styles.chartCard}>
              <Chart
                data={revenueChartData}
                type="line"
                title="최근 6개월 순매출 추이"
                width={500}
                height={250}
              />
            </div>
          )}

          {/* 주문 상태 차트 - 주문 데이터가 있을 때만 */}
          {stats.dataAvailability.orders && Object.keys(stats.orderStatusStats).length > 0 && (
            <div className={styles.chartCard}>
              <Chart
                data={orderStatusChartData}
                type="pie"
                title="주문 상태 분포"
                width={400}
                height={300}
              />
            </div>
          )}

          {/* 카테고리 차트 - 상품 데이터가 있을 때만 */}
          {stats.dataAvailability.products && categoryChartData.length > 0 && (
            <div className={styles.chartCard}>
              <Chart
                data={categoryChartData}
                type="bar"
                title={categoryChartTitle}
                width={500}
                height={250}
              />
            </div>
          )}
        </div>
      )}

      {/* 운영 관리 메뉴 */}
      <div className={styles.managementSection}>
        <h2 className={styles.sectionTitle}>운영 관리</h2>
        <div className={styles.managementTable}>
          <div className={styles.tableHeader}>
            <span className={styles.thName}>메뉴</span>
            <span className={styles.thDesc}>설명</span>
            <span className={styles.thStatus}>상태</span>
          </div>
          <Link href="/admin/qna" className={styles.tableRow}>
            <span className={styles.tdName}>QnA 관리</span>
            <span className={styles.tdDesc}>고객 문의 답변 및 상태 관리</span>
            <span className={styles.tdStatus}>
              {!qnaLoading && qnaStats.waiting > 0 ? (
                <span className={styles.statusAlert}>답변대기 {qnaStats.waiting}건</span>
              ) : (
                <span className={styles.statusNormal}>정상</span>
              )}
            </span>
          </Link>
          <Link href="/admin/dashboard/orders" className={styles.tableRow}>
            <span className={styles.tdName}>주문 관리</span>
            <span className={styles.tdDesc}>주문 상태 변경 및 재고 동기화</span>
            <span className={styles.tdStatus}>
              <span className={styles.statusNormal}>정상</span>
            </span>
          </Link>
          <Link href="/admin/dashboard/products" className={styles.tableRow}>
            <span className={styles.tdName}>상품 관리</span>
            <span className={styles.tdDesc}>상품 등록/수정 및 카테고리 관리</span>
            <span className={styles.tdStatus}>
              <span className={styles.statusNormal}>정상</span>
            </span>
          </Link>
          <Link href="/admin/dashboard/users" className={styles.tableRow}>
            <span className={styles.tdName}>사용자 관리</span>
            <span className={styles.tdDesc}>회원 권한 관리 및 포인트 지급</span>
            <span className={styles.tdStatus}>
              <span className={styles.statusNormal}>정상</span>
            </span>
          </Link>
          <Link href="/admin/inquiries" className={styles.tableRow}>
            <span className={styles.tdName}>1:1 문의</span>
            <span className={styles.tdDesc}>고객 문의 응대 및 이력 관리</span>
            <span className={styles.tdStatus}>
              <span className={styles.statusNormal}>정상</span>
            </span>
          </Link>
          <Link href="/admin/coupons" className={styles.tableRow}>
            <span className={styles.tdName}>쿠폰 관리</span>
            <span className={styles.tdDesc}>쿠폰 발급 및 사용 이력 추적</span>
            <span className={styles.tdStatus}>
              <span className={styles.statusNormal}>정상</span>
            </span>
          </Link>
        </div>
      </div>

      {/* 최근 작업 로그 */}
      <div className={styles.infoGrid}>
        <div className={styles.activityLog}>
          <h2 className={styles.sectionTitle}>최근 활동</h2>
          <div className={styles.activityList}>
            {stats.recentActivities.length > 0 ? (
              stats.recentActivities.map((activity) => (
                <div key={activity.id} className={styles.activityItem}>
                  <div className={styles.activityContent}>
                    <div className={styles.activityHeader}>
                      <span className={styles.activityOperation}>
                        {getOperationType(activity.description)}
                      </span>
                      <span className={styles.activityTime}>
                        {formatTimeAgo(activity.timestamp)}
                      </span>
                    </div>
                    <p className={styles.activityDesc}>{activity.description}</p>
                    <div className={styles.activityMeta}>
                      <code className={styles.activityPath}>
                        {getFirestorePath(activity.description)}
                      </code>
                      <span 
                        className={styles.activityPriority}
                        data-priority={activity.priority}
                      >
                        {activity.priority}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className={styles.noDataMessage}>최근 활동 이력이 없습니다.</p>
            )}
          </div>
        </div>

        {/* 일일 비용 추정 */}
        <div className={styles.costEstimation}>
          <h2 className={styles.sectionTitle}>일일 비용 추정</h2>
          <div className={styles.costGrid}>
            <div className={styles.costItem}>
              <span className={styles.costLabel}>문서 읽기</span>
              <span className={styles.costValue}>~5,000회</span>
              <span className={styles.costInfo}>TanStack Query 캐시로 감소</span>
            </div>
            <div className={styles.costItem}>
              <span className={styles.costLabel}>문서 쓰기</span>
              <span className={styles.costValue}>~200회</span>
              <span className={styles.costInfo}>writeBatch 활용</span>
            </div>
            <div className={styles.costItem}>
              <span className={styles.costLabel}>인덱스 사용</span>
              <span className={styles.costValue}>5개 활성화</span>
              <span className={styles.costInfo}>카테고리 + 정렬 조합</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 주문 상태 텍스트 변환
function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    'pending': '결제 대기',
    'confirmed': '주문 확인',
    'preparing': '상품 준비중',
    'shipped': '배송 중',
    'delivered': '배송 완료',
    'cancelled': '주문 취소',
    'returned': '반품',
    'exchanged': '교환'
  };
  
  return statusMap[status] || status;
}

// 작업 타입 판별
function getOperationType(description: string): string {
  if (description.includes('추가') || description.includes('등록') || description.includes('발급')) {
    return 'WRITE';
  }
  if (description.includes('수정') || description.includes('변경') || description.includes('업데이트')) {
    return 'UPDATE';
  }
  if (description.includes('삭제') || description.includes('제거')) {
    return 'DELETE';
  }
  return 'READ';
}

// Firestore 경로 추정
function getFirestorePath(description: string): string {
  if (description.includes('상품')) return 'products/';
  if (description.includes('주문')) return 'orders/';
  if (description.includes('사용자') || description.includes('회원')) return 'users/';
  if (description.includes('쿠폰')) return 'coupons/ or userCoupons/';
  if (description.includes('문의') || description.includes('QnA')) return 'qna/';
  if (description.includes('리뷰')) return 'reviews/';
  return 'unknown/';
}
