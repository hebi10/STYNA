import {
  Event,
  EventEligibilityType,
  EventType,
  EventUiVariant,
} from '../types/event';

export const REVIEW_EVENT_KEYWORDS = ['리뷰', '후기'];

type EventDetailHighlightKey = 'benefit' | 'period' | 'scope' | 'action' | 'reward';

interface EventSectionTitles {
  detail: string;
  content: string;
  method: string;
  benefits: string;
  notice: string;
  summary: string;
}

interface EventDetailHighlightMeta {
  key: EventDetailHighlightKey;
  icon: string;
  title: string;
}

export interface EventEligibilityUiMeta {
  isConfigured: boolean;
  participationMethod: string;
  primaryActionLabel: string;
  primaryActionLoggedOutLabel: string;
  primaryActionDescription: string;
  primaryPendingLabel: string;
  primaryCompletedLabel: string;
  primaryPostParticipationLabel?: string;
  followUpAction?: 'recommend' | 'reviews';
}

export interface EventUiMeta {
  variant: EventUiVariant;
  typeLabel: string;
  badgeLabel: string;
  featuredEyebrow: string;
  featuredAccentText: string;
  featuredCtaLabel: string;
  cardEyebrow: string;
  cardAccentLabel: string;
  cardCtaLabel: string;
  heroEyebrow: string;
  detailSectionTitle: string;
  primaryActionLabel: string;
  primaryActionLoggedOutLabel: string;
  primaryActionDescription: string;
  primaryPendingLabel: string;
  primaryCompletedLabel: string;
  primaryPostParticipationLabel?: string;
  sectionTitles: EventSectionTitles;
  highlightCards: readonly EventDetailHighlightMeta[];
}

const EVENT_UI_META: Record<EventUiVariant, EventUiMeta> = {
  sale: {
    variant: 'sale',
    typeLabel: '세일',
    badgeLabel: '세일 특가',
    featuredEyebrow: '세일 기획전',
    featuredAccentText: '지금 가장 강한 즉시 할인',
    featuredCtaLabel: '특가 보기',
    cardEyebrow: '즉시 할인 혜택',
    cardAccentLabel: '빠른 구매 추천',
    cardCtaLabel: '할인 상품 보기',
    heroEyebrow: '세일 기획전',
    detailSectionTitle: '세일 이벤트 상세',
    primaryActionLabel: '할인 상품 보러가기',
    primaryActionLoggedOutLabel: '로그인 후 할인 상품 보기',
    primaryActionDescription: '참여 처리 후 할인 적용 상품 화면으로 이어져 바로 상품을 확인할 수 있습니다.',
    primaryPendingLabel: '할인 참여 처리 중...',
    primaryCompletedLabel: '참여 완료',
    primaryPostParticipationLabel: '할인 상품 계속 보기',
    sectionTitles: {
      detail: '세일 이벤트 상세',
      content: '세일 이벤트 소개',
      method: '할인 참여 흐름',
      benefits: '할인 혜택',
      notice: '구매 전 확인사항',
      summary: '적용 일정 및 할인 방식',
    },
    highlightCards: [
      { key: 'benefit', icon: '할인', title: '할인 포인트' },
      { key: 'scope', icon: '범위', title: '대상 범위' },
      { key: 'action', icon: '구매', title: '참여 방식' },
      { key: 'reward', icon: '적용', title: '할인 적용' },
    ],
  },
  coupon: {
    variant: 'coupon',
    typeLabel: '쿠폰',
    badgeLabel: '쿠폰 혜택',
    featuredEyebrow: '쿠폰 혜택',
    featuredAccentText: '받고 바로 쓰는 쿠폰 이벤트',
    featuredCtaLabel: '쿠폰 혜택 보기',
    cardEyebrow: '쿠폰 지급 이벤트',
    cardAccentLabel: '즉시 사용 가능',
    cardCtaLabel: '쿠폰 조건 보기',
    heroEyebrow: '쿠폰 이벤트',
    detailSectionTitle: '쿠폰 이벤트 안내',
    primaryActionLabel: '쿠폰 받기',
    primaryActionLoggedOutLabel: '로그인 후 쿠폰 받기',
    primaryActionDescription: '버튼을 누르면 이벤트 참여가 기록되고 지급 가능한 쿠폰 흐름으로 이어집니다.',
    primaryPendingLabel: '쿠폰 지급 처리 중...',
    primaryCompletedLabel: '쿠폰 받기 완료',
    sectionTitles: {
      detail: '쿠폰 이벤트 안내',
      content: '쿠폰 이벤트 소개',
      method: '쿠폰 받는 방법',
      benefits: '쿠폰 혜택',
      notice: '쿠폰 사용 유의사항',
      summary: '지급 및 사용 방식',
    },
    highlightCards: [
      { key: 'benefit', icon: '쿠폰', title: '쿠폰 혜택' },
      { key: 'period', icon: '기간', title: '사용 가능 기간' },
      { key: 'action', icon: '참여', title: '받는 방법' },
      { key: 'reward', icon: '사용', title: '지급/사용 방식' },
    ],
  },
  review: {
    variant: 'review',
    typeLabel: '리뷰',
    badgeLabel: '리뷰 미션',
    featuredEyebrow: '리뷰 미션',
    featuredAccentText: '구매 인증 후기를 확인하는 참여형 이벤트',
    featuredCtaLabel: '리뷰 미션 보기',
    cardEyebrow: '참여형 리뷰 이벤트',
    cardAccentLabel: '구매 인증 후기',
    cardCtaLabel: '리뷰 조건 보기',
    heroEyebrow: '리뷰 이벤트',
    detailSectionTitle: '리뷰 이벤트 안내',
    primaryActionLabel: '리뷰 쓰고 참여하기',
    primaryActionLoggedOutLabel: '로그인 후 리뷰 쓰고 참여하기',
    primaryActionDescription: '참여 처리 후 리뷰 확인 화면으로 이어져 후속 행동을 바로 진행할 수 있습니다.',
    primaryPendingLabel: '리뷰 참여 처리 중...',
    primaryCompletedLabel: '참여 완료',
    primaryPostParticipationLabel: '리뷰 화면 보기',
    sectionTitles: {
      detail: '리뷰 이벤트 안내',
      content: '리뷰 미션 소개',
      method: '리뷰 참여 방법',
      benefits: '리뷰 이벤트 안내',
      notice: '리뷰 작성 유의사항',
      summary: '참여 자격 및 진행 방식',
    },
    highlightCards: [
      { key: 'benefit', icon: '안내', title: '이벤트 안내' },
      { key: 'scope', icon: '기준', title: '참여 기준' },
      { key: 'action', icon: '작성', title: '작성 방식' },
      { key: 'reward', icon: '확인', title: '진행 방식' },
    ],
  },
  new: {
    variant: 'new',
    typeLabel: '신상',
    badgeLabel: '신상 오픈',
    featuredEyebrow: '신상품 오픈',
    featuredAccentText: '공개 직후 가장 먼저 만나는 신상 혜택',
    featuredCtaLabel: '신상 혜택 보기',
    cardEyebrow: '런칭 기념 이벤트',
    cardAccentLabel: '가장 빠른 공개',
    cardCtaLabel: '신상 혜택 보기',
    heroEyebrow: '신상품 기획전',
    detailSectionTitle: '신상 이벤트 안내',
    primaryActionLabel: '신상품 보러가기',
    primaryActionLoggedOutLabel: '로그인 후 신상품 보기',
    primaryActionDescription: '참여 처리 후 신상품 중심 추천 화면으로 이어져 최신 상품을 바로 확인할 수 있습니다.',
    primaryPendingLabel: '신상 참여 처리 중...',
    primaryCompletedLabel: '참여 완료',
    primaryPostParticipationLabel: '신상품 계속 보기',
    sectionTitles: {
      detail: '신상 이벤트 안내',
      content: '신상 오픈 소개',
      method: '신상 참여 방법',
      benefits: '오픈 혜택',
      notice: '출시 확인사항',
      summary: '오픈 일정 및 적용 방식',
    },
    highlightCards: [
      { key: 'benefit', icon: '신상', title: '오픈 혜택' },
      { key: 'period', icon: '일정', title: '공개 일정' },
      { key: 'action', icon: '탐색', title: '참여 방식' },
      { key: 'reward', icon: '적용', title: '혜택 적용' },
    ],
  },
  special: {
    variant: 'special',
    typeLabel: '특별',
    badgeLabel: '특별 기획',
    featuredEyebrow: '특별 기획',
    featuredAccentText: '기간 한정으로 준비한 특별 혜택',
    featuredCtaLabel: '이벤트 보기',
    cardEyebrow: '브랜드 기획 이벤트',
    cardAccentLabel: '기간 한정 혜택',
    cardCtaLabel: '이벤트 보기',
    heroEyebrow: '특별 이벤트',
    detailSectionTitle: '특별 이벤트 안내',
    primaryActionLabel: '이벤트 참여하기',
    primaryActionLoggedOutLabel: '로그인 후 이벤트 참여하기',
    primaryActionDescription: '핵심 조건을 확인한 뒤 참여를 완료하고 아래 상세 안내를 이어서 확인할 수 있습니다.',
    primaryPendingLabel: '참여 처리 중...',
    primaryCompletedLabel: '참여 완료',
    sectionTitles: {
      detail: '특별 이벤트 안내',
      content: '특별 이벤트 소개',
      method: '이벤트 참여 방법',
      benefits: '이벤트 혜택',
      notice: '참여 유의사항',
      summary: '기간 및 지급 방식',
    },
    highlightCards: [
      { key: 'benefit', icon: '혜택', title: '혜택 내용' },
      { key: 'period', icon: '기간', title: '진행 기간' },
      { key: 'action', icon: '방식', title: '참여 방법' },
      { key: 'reward', icon: '지급', title: '당첨/지급 방식' },
    ],
  },
};

const EVENT_ELIGIBILITY_UI_META: Record<EventEligibilityType, EventEligibilityUiMeta> = {
  none: {
    isConfigured: true,
    participationMethod: '별도 구매 조건 없이 이벤트 기간과 안내를 확인한 뒤 참여할 수 있습니다.',
    primaryActionLabel: '이벤트 참여하기',
    primaryActionLoggedOutLabel: '로그인 후 이벤트 참여하기',
    primaryActionDescription: '로그인 후 별도 구매 증거 없이 이벤트 참여를 완료할 수 있습니다.',
    primaryPendingLabel: '이벤트 참여 처리 중...',
    primaryCompletedLabel: '참여 완료',
  },
  purchase: {
    isConfigured: true,
    participationMethod: '대상 상품의 본인 구매 내역이 있어야 참여할 수 있습니다.',
    primaryActionLabel: '구매 후 참여하기',
    primaryActionLoggedOutLabel: '로그인 후 구매 내역으로 참여하기',
    primaryActionDescription: '로그인한 계정의 대상 상품 구매 내역을 확인해 참여를 완료합니다.',
    primaryPendingLabel: '구매 내역 확인 중...',
    primaryCompletedLabel: '구매 자격 확인 완료',
    primaryPostParticipationLabel: '대상 상품 계속 보기',
    followUpAction: 'recommend',
  },
  delivered: {
    isConfigured: true,
    participationMethod: '대상 상품이 배송 완료 또는 구매 확정된 뒤 참여할 수 있습니다.',
    primaryActionLabel: '배송 완료 후 참여하기',
    primaryActionLoggedOutLabel: '로그인 후 배송 내역으로 참여하기',
    primaryActionDescription: '로그인한 계정의 대상 상품 배송 완료 또는 구매 확정 내역을 확인합니다.',
    primaryPendingLabel: '배송 완료 내역 확인 중...',
    primaryCompletedLabel: '배송 자격 확인 완료',
    primaryPostParticipationLabel: '대상 상품 계속 보기',
    followUpAction: 'recommend',
  },
  review: {
    isConfigured: true,
    participationMethod: '배송 완료된 대상 상품 옵션의 구매 인증 리뷰를 작성해야 참여할 수 있습니다.',
    primaryActionLabel: '리뷰 쓰고 참여하기',
    primaryActionLoggedOutLabel: '로그인 후 리뷰 쓰고 참여하기',
    primaryActionDescription: '배송 완료된 대상 상품 옵션의 구매 인증 리뷰를 확인해 참여를 완료합니다.',
    primaryPendingLabel: '구매 인증 리뷰 확인 중...',
    primaryCompletedLabel: '리뷰 자격 확인 완료',
    primaryPostParticipationLabel: '리뷰 화면 보기',
    followUpAction: 'reviews',
  },
};

const MISCONFIGURED_ELIGIBILITY_UI_META: EventEligibilityUiMeta = {
  isConfigured: false,
  participationMethod: '이벤트 참여 조건을 확인할 수 없습니다. 운영자에게 문의해주세요.',
  primaryActionLabel: '참여 조건 확인 필요',
  primaryActionLoggedOutLabel: '참여 조건 확인 필요',
  primaryActionDescription: '이벤트 참여 조건이 올바르게 설정된 뒤 참여할 수 있습니다.',
  primaryPendingLabel: '참여 조건 확인 중...',
  primaryCompletedLabel: '참여 조건 확인 필요',
};

export const getEventEligibilityUiMeta = (eligibilityType: unknown): EventEligibilityUiMeta => (
  eligibilityType === 'none'
  || eligibilityType === 'purchase'
  || eligibilityType === 'delivered'
  || eligibilityType === 'review'
    ? EVENT_ELIGIBILITY_UI_META[eligibilityType]
    : MISCONFIGURED_ELIGIBILITY_UI_META
);

export const isReviewFocusedEvent = (
  event: Pick<Event, 'eventType' | 'title' | 'description' | 'content'>
) => {
  if (event.eventType !== 'special') {
    return false;
  }

  const searchableText = [event.title, event.description, event.content ?? ''].join(' ');
  return REVIEW_EVENT_KEYWORDS.some(keyword => searchableText.includes(keyword));
};

export const getEventUiVariant = (
  event: Pick<Event, 'eventType' | 'title' | 'description' | 'content'>
): EventUiVariant => {
  if (isReviewFocusedEvent(event)) {
    return 'review';
  }

  return event.eventType;
};

export const getEventUiMeta = (
  input: EventUiVariant | Pick<Event, 'eventType' | 'title' | 'description' | 'content'>
): EventUiMeta => {
  if (typeof input === 'string') {
    return EVENT_UI_META[input];
  }

  return EVENT_UI_META[getEventUiVariant(input)];
};

export const getEventTypeLabel = (
  input: EventType | EventUiVariant | Pick<Event, 'eventType' | 'title' | 'description' | 'content'>
) => {
  if (typeof input === 'string') {
    return EVENT_UI_META[input].typeLabel;
  }

  return getEventUiMeta(input).typeLabel;
};
