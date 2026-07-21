const faqs = [
  {
    id: "order-cancel",
    category: "주문/결제",
    question: "주문 취소는 언제까지 가능한가요?",
    answer: "상품 발송 전까지 주문 취소가 가능합니다. 마이페이지 주문내역에서 직접 취소하거나 고객센터로 문의해주세요.",
    order: 1,
  },
  {
    id: "shipping-period",
    category: "배송",
    question: "배송 기간은 얼마나 걸리나요?",
    answer: "확정 배송일은 약속하지 않으며 주문별 배송 상태에서 진행 상황을 확인할 수 있습니다.",
    order: 2,
  },
  {
    id: "exchange-return",
    category: "교환/반품",
    question: "교환/반품은 어떻게 하나요?",
    answer: "배송 완료 후 7일 이내 마이페이지 주문내역에서 신청할 수 있습니다. 상품 훼손이나 착용 흔적이 있으면 제한될 수 있습니다.",
    order: 3,
  },
  {
    id: "password-reset",
    category: "회원정보",
    question: "비밀번호를 잊어버렸어요.",
    answer: "로그인 화면의 비밀번호 찾기에서 가입 이메일을 입력하면 재설정 메일을 받을 수 있습니다.",
    order: 4,
  },
  {
    id: "points",
    category: "적립금/쿠폰",
    question: "포인트는 어떻게 적립되고 사용하나요?",
    answer: "회원가입 완료 시 5,000P가 한 번 지급됩니다. 보유 포인트는 주문서의 실제 결제 예정 금액 범위에서 사용할 수 있습니다.",
    order: 5,
  },
  {
    id: "size-exchange",
    category: "사이즈",
    question: "사이즈 교환이 가능한가요?",
    answer: "사이즈 교환은 주문 상태와 재고 확인이 필요합니다. 1:1 문의로 접수하면 가능 여부와 비용을 개별 안내합니다.",
    order: 6,
  },
];

const notices = [
  {
    id: "privacy-policy-2025",
    title: "[중요] 개인정보처리방침 개정 안내",
    content: "개인정보처리방침이 2025년 1월 1일부터 개정됩니다.\n\n1. 개인정보 수집 및 이용 목적 명확화\n2. 개인정보 보유 및 이용기간 조정\n3. 개인정보 제3자 제공 관련 내용 추가",
    date: "2024-12-20",
    important: true,
    order: 1,
  },
  {
    id: "new-year-shipping-2025",
    title: "2025년 설 연휴 배송 및 고객센터 운영 안내",
    content: "설 연휴 기간 동안 배송과 고객센터 운영 일정이 조정됩니다.\n\n연휴 기간: 2025년 1월 28일 ~ 1월 30일\n배송 중단: 1월 29일 ~ 1월 30일",
    date: "2024-12-15",
    important: false,
    order: 2,
  },
  {
    id: "new-category-update",
    title: "신상품 카테고리 업데이트 안내",
    content: "상의, 가방, 액세서리 카테고리에 신규 상품이 추가되었습니다. 카테고리 메뉴에서 업데이트된 상품을 확인할 수 있습니다.",
    date: "2024-12-10",
    important: false,
    order: 3,
  },
  {
    id: "shipping-fee-change",
    title: "배송비 정책 변경 안내",
    content: "일반 배송비는 3,000원이며 쿠폰 할인 적용 후 상품금액이 50,000원 이상이거나 무료배송 쿠폰을 적용하면 무료입니다. 특급 배송은 주문금액 및 무료배송 쿠폰과 관계없이 5,000원입니다.",
    date: "2024-12-05",
    important: true,
    order: 4,
  },
  {
    id: "order-history-guide",
    title: "주문내역 및 배송조회 이용 안내",
    content: "회원 주문의 진행 상태는 마이페이지 주문내역에서 확인할 수 있습니다. 비회원 주문 조회는 고객센터로 문의해주세요.",
    date: "2024-11-30",
    important: false,
    order: 5,
  },
];

const mainBanners = [
  {
    id: "event-2026-06-midyear-sale",
    eyebrow: "오늘 마감",
    title: "상반기 베스트 최대 60%",
    description: "인기 아이템을 가장 강한 혜택으로 정리한 마지막 하루입니다.",
    ctaLabel: "미드이어 세일 보기",
    href: "/events/event-2026-06-midyear-sale",
    image: "/main/main_event_midyear_sale.webp",
    backgroundColor: "#c9c0b3",
    order: 1,
  },
  {
    id: "event-2026-07-vacation-coupon",
    eyebrow: "7월 쿠폰팩",
    title: "휴가룩 쿠폰 3종",
    description: "상의, 하의, 아우터까지 여름 준비에 바로 쓰는 쿠폰 혜택입니다.",
    ctaLabel: "쿠폰팩 보기",
    href: "/events/event-2026-07-vacation-coupon",
    image: "/main/main_event_vacation_coupon.webp",
    backgroundColor: "#d4c6b4",
    order: 2,
  },
  {
    id: "event-2026-07-cool-touch",
    eyebrow: "한여름 데일리 세일",
    title: "쿨터치 최대 35%",
    description: "더운 날에도 편하게 입는 시원한 소재 아이템을 모았습니다.",
    ctaLabel: "쿨터치 세일 보기",
    href: "/events/event-2026-07-cool-touch",
    image: "/main/main_event_cool_touch.webp",
    backgroundColor: "#b9c8cf",
    imagePosition: "25% top",
    tabletImagePosition: "45% top",
    mobileImagePosition: "62% top",
    order: 3,
  },
];

const offlineStores = [
  {
    id: "gangnam",
    name: "STYNA 강남점",
    type: "플래그십 스토어",
    address: "서울특별시 강남구 테헤란로 123",
    phone: "02-1234-5678",
    hours: "10:00 - 22:00",
    transport: "지하철 2호선 강남역 11번 출구 도보 3분",
    features: ["주차가능", "피팅룸", "개인상담", "당일배송"],
    order: 1,
  },
  {
    id: "hongdae",
    name: "STYNA 홍대점",
    type: "콘셉트 스토어",
    address: "서울특별시 마포구 동교로 456",
    phone: "02-2345-6789",
    hours: "11:00 - 23:00",
    transport: "지하철 2호선 홍대입구역 9번 출구 도보 5분",
    features: ["픽업", "스타일링", "이벤트"],
    order: 2,
  },
  {
    id: "myeongdong",
    name: "STYNA 명동점",
    type: "아울렛 스토어",
    address: "서울특별시 중구 명동길 789",
    phone: "02-3456-7890",
    hours: "10:30 - 21:30",
    transport: "지하철 4호선 명동역 6번 출구 도보 2분",
    features: ["할인상품", "면세서비스", "관광객할인"],
    order: 3,
  },
];

const offlineServices = [
  {
    id: "styling",
    icon: "",
    title: "스타일링 서비스",
    description: "전문 스타일리스트가 개인 맞춤 코디를 제안해드립니다.",
    order: 1,
  },
  {
    id: "pickup",
    icon: "",
    title: "픽업 서비스",
    description: "온라인 주문 상품을 매장에서 편리하게 픽업하세요.",
    order: 2,
  },
  {
    id: "repair",
    icon: "",
    title: "수선 서비스",
    description: "구매하신 의류의 길이와 사이즈 수선을 지원합니다.",
    order: 3,
  },
  {
    id: "returns",
    icon: "",
    title: "교환/반품",
    description: "매장에서 직접 교환이나 반품 처리가 가능합니다.",
    order: 4,
  },
];

const offlineInfo = {
  id: "main",
  weekdayHours: [
    { label: "월요일 - 금요일", value: "10:00 - 22:00" },
    { label: "토요일", value: "10:00 - 23:00" },
    { label: "일요일", value: "11:00 - 22:00" },
    { label: "공휴일", value: "휴무", closed: true },
  ],
  serviceHours: [
    { label: "스타일링 상담", value: "10:00 - 20:00" },
    { label: "수선 서비스", value: "10:00 - 19:00" },
    { label: "픽업 서비스", value: "24시간" },
    { label: "고객 상담", value: "09:00 - 21:00" },
  ],
  noticeLines: [
    "매장 방문 전 재고 확인을 위해 전화 문의를 권장합니다.",
    "주차 공간이 제한되어 대중교통 이용을 권장합니다.",
    "스타일링 상담은 사전 예약제로 운영됩니다.",
    "매장 이벤트 및 할인 정보는 매장별로 다를 수 있습니다.",
  ],
};

module.exports = {
  faqs,
  notices,
  mainBanners,
  offlineStores,
  offlineServices,
  offlineInfo,
};
