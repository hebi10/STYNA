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

async function getOrderedActiveDocs(collectionName: string): Promise<Array<{ id: string; data: RawData }>> {
  const snapshot = await getDocs(query(collection(db, collectionName), orderBy('order', 'asc')));
  return snapshot.docs
    .map((item) => ({ id: item.id, data: item.data() }))
    .filter((item) => isActive(item.data));
}

export class SiteContentService {
  static async getFaqs(): Promise<FaqContent[]> {
    const docs = await getOrderedActiveDocs('faqs');
    return docs.map(({ id, data }) => ({
      id,
      category: stringValue(data.category),
      question: stringValue(data.question),
      answer: stringValue(data.answer),
      order: numberValue(data.order),
    }));
  }

  static async getNotices(): Promise<NoticeContent[]> {
    const docs = await getOrderedActiveDocs('notices');
    return docs.map(({ id, data }) => ({
      id,
      title: stringValue(data.title),
      content: stringValue(data.content),
      date: stringValue(data.date),
      important: Boolean(data.important),
      order: numberValue(data.order),
    }));
  }

  static async getMainBanners(): Promise<MainBannerContent[]> {
    const docs = await getOrderedActiveDocs('mainBanners');
    return docs.map(({ id, data }) => ({
      id,
      eyebrow: stringValue(data.eyebrow),
      title: stringValue(data.title),
      description: stringValue(data.description),
      ctaLabel: stringValue(data.ctaLabel),
      href: stringValue(data.href),
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
