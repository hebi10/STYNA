'use client';

import { usePathname } from 'next/navigation';
import styles from './DemoAdminDashboard.module.css';

type DemoPage = {
  title: string;
  description: string;
  stats: Array<[string, string]>;
  columns: string[];
  rows: string[][];
  actions: string[];
};

const DEMO_PAGES: Array<{ match: (pathname: string) => boolean; page: DemoPage }> = [
  {
    match: (pathname) => pathname === '/admin' || pathname === '/admin/',
    page: {
      title: '운영 대시보드',
      description: '주요 운영 지표와 관리 화면 구성을 비식별 샘플 데이터로 확인할 수 있습니다.',
      stats: [['등록 상품', '178'], ['데모 주문', '24'], ['진행 이벤트', '6'], ['쿠폰', '12']],
      columns: ['구분', '현재 상태', '최근 변경'],
      rows: [
        ['상품 운영', '정상', '12분 전'],
        ['주문 처리', '확인 필요 4건', '18분 전'],
        ['이벤트', '진행 중 6건', '1시간 전'],
        ['문의', '답변 대기 3건', '2시간 전'],
      ],
      actions: ['대시보드 새로고침', '통계 내보내기'],
    },
  },
  {
    match: (pathname) => pathname.startsWith('/admin/dashboard/products'),
    page: {
      title: '상품 관리',
      description: '상품 상태, 재고, 카테고리와 편집 액션이 배치되는 운영 화면 예시입니다.',
      stats: [['전체 상품', '178'], ['판매 중', '162'], ['품절', '9'], ['비활성', '7']],
      columns: ['상품', '카테고리', '상태', '재고'],
      rows: [
        ['Essential Wool Jacket', 'Outer', '판매 중', '34'],
        ['Minimal Leather Bag', 'Bag', '판매 중', '18'],
        ['Classic Knit Cardigan', 'Top', '품절', '0'],
        ['Daily Wide Trousers', 'Bottom', '판매 중', '42'],
      ],
      actions: ['상품 등록', '상품 수정', '상품 삭제'],
    },
  },
  {
    match: (pathname) => pathname.startsWith('/admin/dashboard/orders'),
    page: {
      title: '주문 관리',
      description: '개인정보를 제거한 주문 예시로 상태 전환과 운영 흐름만 확인할 수 있습니다.',
      stats: [['전체 주문', '24'], ['결제 대기', '3'], ['배송 준비', '7'], ['완료', '14']],
      columns: ['주문 번호', '상품 수', '상태', '금액'],
      rows: [
        ['DEMO-2401', '2', '결제 확인', '128,000원'],
        ['DEMO-2402', '1', '배송 준비', '79,000원'],
        ['DEMO-2403', '3', '배송 중', '214,000원'],
        ['DEMO-2404', '1', '배송 완료', '54,000원'],
      ],
      actions: ['주문 확인', '배송 상태 변경', '취소 처리'],
    },
  },
  {
    match: (pathname) => pathname.startsWith('/admin/dashboard/users'),
    page: {
      title: '사용자 관리',
      description: '실제 회원 정보 대신 익명화된 사용자 상태와 권한 관리 구조만 표시합니다.',
      stats: [['활성 사용자', '320'], ['신규', '18'], ['휴면', '12'], ['관리 대상', '3']],
      columns: ['사용자', '등급', '상태', '가입 경로'],
      rows: [
        ['DEMO USER 01', '일반', '활성', '이메일'],
        ['DEMO USER 02', 'VIP', '활성', '이메일'],
        ['DEMO USER 03', '일반', '휴면', '이메일'],
      ],
      actions: ['상태 변경', '권한 변경', '포인트 지급'],
    },
  },
  {
    match: (pathname) => pathname.startsWith('/admin/coupons') || pathname.startsWith('/admin/user-coupons'),
    page: {
      title: '쿠폰 관리',
      description: '쿠폰 생성·발급·사용 현황을 샘플 데이터로 확인할 수 있습니다.',
      stats: [['쿠폰', '12'], ['사용 가능', '8'], ['사용 완료', '3'], ['만료', '1']],
      columns: ['쿠폰명', '혜택', '상태', '만료일'],
      rows: [
        ['WELCOME 10', '10%', '활성', '2026-12-31'],
        ['AUTUMN 5K', '5,000원', '활성', '2026-10-31'],
        ['FREE SHIPPING', '무료배송', '활성', '2026-11-30'],
      ],
      actions: ['쿠폰 생성', '쿠폰 수정', '쿠폰 비활성화'],
    },
  },
  {
    match: (pathname) => pathname.startsWith('/admin/events'),
    page: {
      title: '이벤트 관리',
      description: '이벤트 노출 상태와 기간, 참여 현황을 비식별 예시로 확인할 수 있습니다.',
      stats: [['전체 이벤트', '9'], ['진행 중', '6'], ['예약', '2'], ['종료', '1']],
      columns: ['이벤트', '기간', '상태', '참여'],
      rows: [
        ['Autumn Edit', '09.01 - 09.30', '진행 중', '124'],
        ['Member Week', '09.20 - 09.27', '예약', '0'],
        ['Style Survey', '08.01 - 08.31', '종료', '286'],
      ],
      actions: ['이벤트 생성', '이벤트 수정', '노출 상태 변경'],
    },
  },
  {
    match: (pathname) => pathname.startsWith('/admin/categories') || pathname.startsWith('/admin/category-order'),
    page: {
      title: '카테고리 관리',
      description: '카테고리 노출 여부와 정렬 순서를 확인하는 데모 화면입니다.',
      stats: [['카테고리', '8'], ['노출', '8'], ['숨김', '0'], ['정렬 그룹', '4']],
      columns: ['카테고리', '노출', '상품 수', '순서'],
      rows: [
        ['Outer', '노출', '34', '1'],
        ['Top', '노출', '46', '2'],
        ['Bottom', '노출', '41', '3'],
        ['Bag', '노출', '27', '4'],
      ],
      actions: ['카테고리 추가', '노출 변경', '순서 저장'],
    },
  },
  {
    match: (pathname) => pathname.startsWith('/admin/inquiries') || pathname.startsWith('/admin/qna'),
    page: {
      title: '문의 관리',
      description: '고객 식별 정보 없이 문의 상태와 답변 처리 구조만 표시합니다.',
      stats: [['전체 문의', '18'], ['대기', '3'], ['답변 완료', '13'], ['종료', '2']],
      columns: ['문의 번호', '유형', '상태', '등록일'],
      rows: [
        ['Q-DEMO-01', '상품', '답변 대기', '09.18'],
        ['Q-DEMO-02', '배송', '답변 완료', '09.17'],
        ['Q-DEMO-03', '교환', '종료', '09.16'],
      ],
      actions: ['답변 등록', '상태 변경'],
    },
  },
  {
    match: (pathname) => pathname.startsWith('/admin/reviews'),
    page: {
      title: '리뷰 관리',
      description: '개인 식별 정보 없이 리뷰 상태와 운영 액션을 확인할 수 있습니다.',
      stats: [['전체 리뷰', '86'], ['노출', '82'], ['신고', '2'], ['숨김', '2']],
      columns: ['리뷰', '평점', '상태', '등록일'],
      rows: [
        ['REVIEW-DEMO-01', '5.0', '노출', '09.18'],
        ['REVIEW-DEMO-02', '4.0', '노출', '09.17'],
        ['REVIEW-DEMO-03', '2.0', '검토 필요', '09.16'],
      ],
      actions: ['리뷰 숨김', '리뷰 삭제'],
    },
  },
];

const FALLBACK_PAGE: DemoPage = {
  title: '관리자 체험',
  description: '이 화면은 포트폴리오 데모용 비식별 샘플 데이터로 구성되어 있습니다.',
  stats: [['관리 화면', '11'], ['쓰기 권한', '없음']],
  columns: ['항목', '상태'],
  rows: [['데모 데이터', '조회 가능'], ['운영 데이터', '접근 차단']],
  actions: ['변경 작업'],
};

export default function DemoAdminDashboard() {
  const pathname = usePathname();
  const page = DEMO_PAGES.find((item) => item.match(pathname))?.page || FALLBACK_PAGE;

  return (
    <section className={styles.workspace} aria-labelledby="demo-admin-title">
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>READ ONLY DEMO</p>
          <h2 id="demo-admin-title">{page.title}</h2>
          <p className={styles.description}>{page.description}</p>
        </div>
        <span className={styles.sampleBadge}>비식별 샘플 데이터</span>
      </header>

      <dl className={styles.summary}>
        {page.stats.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <div className={styles.tableSection}>
        <div className={styles.tableHeader}>
          <h3>운영 데이터 미리보기</h3>
          <span>실제 사용자·주문 데이터는 표시하지 않습니다.</span>
        </div>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                {page.columns.map((column) => <th key={column}>{column}</th>)}
              </tr>
            </thead>
            <tbody>
              {page.rows.map((row, rowIndex) => (
                <tr key={String(rowIndex)}>
                  {row.map((cell, cellIndex) => <td key={String(cellIndex)}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.actionsSection}>
        <div>
          <h3>관리 기능</h3>
          <p>실제 관리자에서 제공되는 변경 액션입니다. 체험 계정에서는 실행할 수 없습니다.</p>
        </div>
        <div className={styles.actions}>
          {page.actions.map((action) => (
            <button
              key={action}
              type="button"
              disabled
              title="체험 계정에서는 변경할 수 없습니다."
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      <p className={styles.notice} role="note">
        관리자 체험 모드는 조회 전용입니다. 직접 API 요청을 포함한 실제 운영 데이터 변경 권한은 부여되지 않습니다.
      </p>
    </section>
  );
}
