import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/shared/libs/firebase/firebase';
import {
  Inquiry,
  CreateInquiryData,
  InquiryAnswer,
  InquiryNotificationAudience,
  SubscribeToUnreadInquiryOptions,
} from '@/shared/types/inquiry';

const COLLECTION_NAME = 'inquiries';

export class InquiryService {
  // 문의 생성
  static async createInquiry(
    userId: string,
    userEmail: string,
    userName: string,
    data: CreateInquiryData
  ): Promise<string> {
    const inquiryData = {
      userId,
      userEmail,
      userName,
      category: data.category,
      title: data.title,
      content: data.content,
      status: 'waiting' as const,
      unreadForAdmin: true,
      unreadForCustomer: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), inquiryData);
    return docRef.id;
  }

  // 사용자의 문의 목록 조회
  static async getUserInquiries(userId: string): Promise<Inquiry[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        unreadForAdmin: data.unreadForAdmin === true,
        unreadForCustomer: data.unreadForCustomer === true,
        answer: data.answer ? {
          ...data.answer,
          answeredAt: data.answer.answeredAt?.toDate() || new Date(),
        } : undefined,
      } as Inquiry;
    });
  }

  // 모든 문의 목록 조회 (관리자용)
  static async getAllInquiries(limitCount: number = 50): Promise<Inquiry[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        unreadForAdmin: data.unreadForAdmin === true,
        unreadForCustomer: data.unreadForCustomer === true,
        answer: data.answer ? {
          ...data.answer,
          answeredAt: data.answer.answeredAt?.toDate() || new Date(),
        } : undefined,
      } as Inquiry;
    });
  }

  // 문의 답변 추가 (관리자용)
  static async answerInquiry(
    inquiryId: string,
    answer: Omit<InquiryAnswer, 'answeredAt'>
  ): Promise<void> {
    const inquiryRef = doc(db, COLLECTION_NAME, inquiryId);
    await updateDoc(inquiryRef, {
      answer: {
        ...answer,
        answeredAt: serverTimestamp(),
      },
      status: 'answered',
      unreadForAdmin: false,
      unreadForCustomer: true,
      updatedAt: serverTimestamp(),
    });
  }

  // 문의 상태 변경
  static async updateInquiryStatus(
    inquiryId: string,
    status: Inquiry['status']
  ): Promise<void> {
    const inquiryRef = doc(db, COLLECTION_NAME, inquiryId);
    await updateDoc(inquiryRef, {
      status,
      updatedAt: serverTimestamp(),
    });
  }

  static subscribeToUnreadInquiries(
    options: SubscribeToUnreadInquiryOptions,
    onChange: (hasUnread: boolean) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe {
    const constraints = options.audience === 'admin'
      ? [where('unreadForAdmin', '==', true), limit(1)]
      : [
          where('userId', '==', options.userId),
          where('unreadForCustomer', '==', true),
          limit(1),
        ];

    return onSnapshot(
      query(collection(db, COLLECTION_NAME), ...constraints),
      (snapshot) => onChange(!snapshot.empty),
      (error) => {
        onChange(false);
        onError?.(error);
      },
    );
  }

  static async markInquiriesRead(
    inquiryIds: string[],
    audience: InquiryNotificationAudience,
  ): Promise<void> {
    const uniqueIds = Array.from(new Set(inquiryIds.filter(Boolean)));
    const field = audience === 'admin' ? 'unreadForAdmin' : 'unreadForCustomer';

    for (let start = 0; start < uniqueIds.length; start += 450) {
      const batch = writeBatch(db);
      uniqueIds.slice(start, start + 450).forEach((inquiryId) => {
        batch.update(doc(db, COLLECTION_NAME, inquiryId), { [field]: false });
      });
      await batch.commit();
    }
  }

  // 특정 문의 조회
  static async getInquiry(inquiryId: string): Promise<Inquiry | null> {
    const docRef = doc(db, COLLECTION_NAME, inquiryId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        unreadForAdmin: data.unreadForAdmin === true,
        unreadForCustomer: data.unreadForCustomer === true,
        answer: data.answer ? {
          ...data.answer,
          answeredAt: data.answer.answeredAt?.toDate() || new Date(),
        } : undefined,
      } as Inquiry;
    }

    return null;
  }

  // 카테고리별 문의 수 조회
  static async getInquiryCountByCategory(): Promise<Record<string, number>> {
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    const counts: Record<string, number> = {};

    querySnapshot.docs.forEach(doc => {
      const data = doc.data();
      const category = data.category || 'other';
      counts[category] = (counts[category] || 0) + 1;
    });

    return counts;
  }
}
