import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '@/shared/libs/firebase/firebase';

export interface FaqContent {
  id: string;
  category: string;
  question: string;
  answer: string;
  order: number;
}

export interface NoticeContent {
  id: string;
  title: string;
  content: string;
  date: string;
  important: boolean;
  order: number;
}

export interface MainBannerContent {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
  image: string;
  backgroundColor: string;
  order: number;
  imagePosition?: string;
  tabletImagePosition?: string;
  mobileImagePosition?: string;
}

export interface OfflineStoreContent {
  id: string;
  name: string;
  type: string;
  address: string;
  phone: string;
  hours: string;
  transport: string;
  features: string[];
  order: number;
}

export interface OfflineServiceContent {
  id: string;
  icon: string;
  title: string;
  description: string;
  order: number;
}

export interface OfflineInfoContent {
  weekdayHours: Array<{ label: string; value: string; closed?: boolean }>;
  serviceHours: Array<{ label: string; value: string; closed?: boolean }>;
  noticeLines: string[];
}

type RawData = Record<string, unknown>;

const REVIEWED_FAQS: Record<string, Omit<FaqContent, 'id'>> = {
  'order-cancel': {
    category: '주문/결제',
    question: '주문 취소는 언제까지 가능한가요?',
    answer: '마이페이지 주문내역에서 취소 버튼이 표시되는 주문만 직접 취소할 수 있습니다. 실제 결제나 환불은 발생하지 않습니다.',
    order: 1,
  },
  'shipping-period': {
    category: '배송',
    question: '배송 기간은 얼마나 걸리나요?',
    answer: '확정 배송일은 약속하지 않으며 주문별 배송 상태에서 진행 상황을 확인할 수 있습니다.',
    order: 2,
  },
  'exchange-return': {
    category: '교환/반품',
    question: '교환/반품은 어떻게 하나요?',
    answer: '자동 교환·반품 처리는 제공하지 않습니다. 1:1 문의 기록을 남길 수 있지만 답변이나 처리는 보장하지 않습니다.',
    order: 3,
  },
  'password-reset': {
    category: '회원정보',
    question: '비밀번호를 잊어버렸어요.',
    answer: '로그인 화면의 비밀번호 찾기에서 가입 이메일을 입력하면 Firebase 인증 재설정 메일을 요청할 수 있습니다.',
    order: 4,
  },
  points: {
    category: '적립금/쿠폰',
    question: '포인트는 어떻게 적립되고 사용하나요?',
    answer: '회원가입 완료 시 5,000P가 한 번 지급됩니다. 보유 포인트는 주문서에 표시된 사용 가능 범위에서 사용할 수 있습니다.',
    order: 5,
  },
  'size-exchange': {
    category: '사이즈',
    question: '사이즈 교환이 가능한가요?',
    answer: '데모에서 교환 가능 여부나 비용을 보장하지 않습니다. 상품 상세의 사이즈 정보를 먼저 확인해 주세요.',
    order: 6,
  },
};

const REVIEWED_NOTICES: Record<string, Omit<NoticeContent, 'id'>> = {
  'new-category-update': {
    title: '상품 카테고리 이용 안내',
    content: '카테고리 화면에서 현재 Firebase에 등록된 상품을 확인할 수 있습니다.',
    date: '2026-07-21',
    important: false,
    order: 3,
  },
  'shipping-fee-change': {
    title: '데모 배송비 정책 안내',
    content: '일반 배송비는 3,000원이며 쿠폰 할인 적용 후 상품금액이 50,000원 이상이거나 무료배송 쿠폰을 적용하면 무료입니다. 특급 배송은 주문금액 및 무료배송 쿠폰과 관계없이 5,000원입니다. 실제 배송은 진행되지 않습니다.',
    date: '2026-07-21',
    important: true,
    order: 4,
  },
  'order-history-guide': {
    title: '주문내역 및 배송 상태 데모 안내',
    content: '로그인한 회원은 마이페이지 주문내역에서 데모 주문의 진행 상태를 확인할 수 있습니다. 비회원 주문 조회는 제공하지 않습니다.',
    date: '2026-07-21',
    important: false,
    order: 5,
  },
};

const RETIRED_NOTICE_IDS = new Set([
  'privacy-policy-2025',
  'new-year-shipping-2025',
]);

function isActive(data: RawData): boolean {
  return data.isActive !== false;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' ? value : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function getSafeInternalPath(value: unknown, fallback = '/products'): string {
  const candidate = stringValue(value).trim();
  if (
    !candidate.startsWith('/')
    || candidate.startsWith('//')
    || candidate.includes('\\')
    || /[\u0000-\u001F\u007F]/.test(candidate)
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(candidate, 'https://styna.local');
    return parsed.origin === 'https://styna.local'
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}

async function getOrderedActiveDocs(collectionName: string): Promise<Array<{ id: string; data: RawData }>> {
  const snapshot = await getDocs(query(collection(db, collectionName), orderBy('order', 'asc')));
  return snapshot.docs
    .map((item) => ({ id: item.id, data: item.data() }))
    .filter((item) => isActive(item.data));
}

export class SiteContentService {
  static async getFaqs(): Promise<FaqContent[]> {
    const docs = await getOrderedActiveDocs('faqs');
    return docs.flatMap(({ id, data }) => {
      const reviewed = REVIEWED_FAQS[id];
      if (reviewed) {
        return [{ id, ...reviewed }];
      }
      if (data.publicPolicyVerified !== true) {
        return [];
      }
      return [{
        id,
        category: stringValue(data.category),
        question: stringValue(data.question),
        answer: stringValue(data.answer),
        order: numberValue(data.order),
      }];
    });
  }

  static async getNotices(): Promise<NoticeContent[]> {
    const docs = await getOrderedActiveDocs('notices');
    return docs.flatMap(({ id, data }) => {
      if (RETIRED_NOTICE_IDS.has(id)) {
        return [];
      }
      const reviewed = REVIEWED_NOTICES[id];
      if (reviewed) {
        return [{ id, ...reviewed }];
      }
      if (data.publicPolicyVerified !== true) {
        return [];
      }
      return [{
        id,
        title: stringValue(data.title),
        content: stringValue(data.content),
        date: stringValue(data.date),
        important: Boolean(data.important),
        order: numberValue(data.order),
      }];
    });
  }

  static async getMainBanners(): Promise<MainBannerContent[]> {
    const docs = await getOrderedActiveDocs('mainBanners');
    return docs.map(({ id, data }) => ({
      id,
      eyebrow: stringValue(data.eyebrow),
      title: stringValue(data.title),
      description: stringValue(data.description),
      ctaLabel: stringValue(data.ctaLabel),
      href: getSafeInternalPath(data.href),
      image: stringValue(data.image),
      backgroundColor: stringValue(data.backgroundColor) || '#f4f4f4',
      order: numberValue(data.order),
      imagePosition: stringValue(data.imagePosition) || undefined,
      tabletImagePosition: stringValue(data.tabletImagePosition) || undefined,
      mobileImagePosition: stringValue(data.mobileImagePosition) || undefined,
    }));
  }

  static async getOfflineStores(): Promise<OfflineStoreContent[]> {
    const docs = await getOrderedActiveDocs('offlineStores');
    return docs.map(({ id, data }) => ({
      id,
      name: stringValue(data.name),
      type: stringValue(data.type),
      address: stringValue(data.address),
      phone: stringValue(data.phone),
      hours: stringValue(data.hours),
      transport: stringValue(data.transport),
      features: stringArray(data.features),
      order: numberValue(data.order),
    }));
  }

  static async getOfflineServices(): Promise<OfflineServiceContent[]> {
    const docs = await getOrderedActiveDocs('offlineServices');
    return docs.map(({ id, data }) => ({
      id,
      icon: stringValue(data.icon),
      title: stringValue(data.title),
      description: stringValue(data.description),
      order: numberValue(data.order),
    }));
  }

  static async getOfflineInfo(): Promise<OfflineInfoContent | null> {
    const snapshot = await getDoc(doc(db, 'offlineInfo', 'main'));
    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();
    return {
      weekdayHours: Array.isArray(data.weekdayHours) ? data.weekdayHours as OfflineInfoContent['weekdayHours'] : [],
      serviceHours: Array.isArray(data.serviceHours) ? data.serviceHours as OfflineInfoContent['serviceHours'] : [],
      noticeLines: stringArray(data.noticeLines),
    };
  }

}
