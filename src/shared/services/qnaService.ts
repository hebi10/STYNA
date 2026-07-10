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
  startAfter,
  getCountFromServer,
  serverTimestamp,
  increment,
  Timestamp,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '@/shared/libs/firebase/firebase';
import { QnA, CreateQnAData, QnAAnswer, QnAFilter, QnAPagination } from '@/shared/types/qna';

const COLLECTION_NAME = 'qna';

interface QnASecretVerifyResponse {
  success: boolean;
  qna?: RawQnAFromServer;
  error?: string;
}

interface RawQnAFromServer {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  category: QnA['category'];
  title: string;
  content: string;
  images?: string[];
  isSecret: boolean;
  status: QnA['status'];
  views: number;
  isNotified: boolean;
  createdAt: string | Timestamp | Date;
  updatedAt: string | Timestamp | Date;
  productId?: string;
  productName?: string;
  answer?: {
    content: string;
    answeredBy: string;
    answeredAt: string | Timestamp | Date;
    isAdmin: boolean;
  };
}

interface QnAAccessResult {
  success: boolean;
  qna: QnA | null;
  error?: string;
}

export class QnAService {
  private static buildQnAQuery(filters: QnAFilter = {}) {
    let q = query(collection(db, COLLECTION_NAME));

    if (filters.category) {
      q = query(q, where('category', '==', filters.category));
    }
    if (filters.status) {
      q = query(q, where('status', '==', filters.status));
    }
    if (filters.isSecret !== undefined) {
      q = query(q, where('isSecret', '==', filters.isSecret));
    }
    if (filters.userId) {
      q = query(q, where('userId', '==', filters.userId));
    }
    if (filters.productId) {
      q = query(q, where('productId', '==', filters.productId));
    }

    return query(q, orderBy('createdAt', 'desc'));
  }

  static async createQnA(
    userId: string,
    userEmail: string,
    userName: string,
    data: CreateQnAData
  ): Promise<string> {
    const qnaData: Record<string, unknown> = {
      userId,
      userEmail,
      userName,
      category: data.category,
      title: data.title,
      content: data.content,
      images: data.images || [],
      isSecret: data.isSecret,
      status: 'waiting' as const,
      views: 0,
      isNotified: data.isNotified,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      productId: data.productId,
      productName: data.productName,
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), qnaData);
    return docRef.id;
  }

  // QnA 목록 조회
  static async getQnAList(
    filters: QnAFilter = {},
    page: number = 1,
    limitCount: number = 10
  ): Promise<{ qnas: QnA[]; pagination: QnAPagination }> {
    const baseQuery = this.buildQnAQuery(filters);
    const countSnapshot = await getCountFromServer(baseQuery);
    const totalCount = countSnapshot.data().count;
    const totalPages = Math.ceil(totalCount / limitCount);
    let q = baseQuery;

    if (page > 1) {
      const prevPageQuery = query(baseQuery, limit((page - 1) * limitCount));
      const prevPageSnapshot = await getDocs(prevPageQuery);
      if (prevPageSnapshot.docs.length > 0) {
        const lastDoc = prevPageSnapshot.docs[prevPageSnapshot.docs.length - 1];
        q = query(baseQuery, startAfter(lastDoc), limit(limitCount));
      } else {
        q = query(baseQuery, limit(limitCount));
      }
    } else {
      q = query(baseQuery, limit(limitCount));
    }

    const querySnapshot = await getDocs(q);
    const qnas = querySnapshot.docs.map(doc => this.convertDocToQnA(doc));

    let filteredQnas = qnas;
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filteredQnas = qnas.filter(qna =>
        qna.title.toLowerCase().includes(searchLower) ||
        qna.content.toLowerCase().includes(searchLower) ||
        qna.userName.toLowerCase().includes(searchLower)
      );
    }

    return {
      qnas: filteredQnas,
      pagination: {
        page,
        limit: limitCount,
        totalCount,
        totalPages,
      },
    };
  }

  // 단일 QnA 조회 (권한 충족 시)
  static async getQnA(qnaId: string, incrementViews: boolean = true): Promise<QnA | null> {
    const docRef = doc(db, COLLECTION_NAME, qnaId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      if (incrementViews) {
        await updateDoc(docRef, {
          views: increment(1),
        });
      }

      return this.convertDocToQnA(docSnap);
    }

    return null;
  }

  // 서버에서 작성자·관리자 권한을 확인해 QnA 조회
  static async getQnAWithAccessCheck(qnaId: string): Promise<QnAAccessResult> {
    const currentUser = getAuth().currentUser;
    const token = currentUser ? await currentUser.getIdToken() : undefined;

    const response = await fetch('/api/qna/verify-secret', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        qnaId,
      }),
    });

    const body = await response.json().catch(() => ({}));
    const parsed = body as QnASecretVerifyResponse;

    if (!response.ok || !parsed.success) {
      return {
        success: false,
        qna: null,
        error: parsed.error || `HTTP ${response.status}`,
      };
    }

    if (!parsed.qna) {
      return {
        success: true,
        qna: null,
        error: '문의글을 찾을 수 없습니다.',
      };
    }

    return {
      success: true,
      qna: this.normalizeServerQnA(parsed.qna),
    };
  }

  static async answerQnA(
    qnaId: string,
    answer: Omit<QnAAnswer, 'answeredAt'>
  ): Promise<void> {
    const qnaRef = doc(db, COLLECTION_NAME, qnaId);
    await updateDoc(qnaRef, {
      answer: {
        content: answer.content,
        answeredBy: answer.answeredBy,
        isAdmin: answer.isAdmin,
        answeredAt: serverTimestamp(),
      },
      status: 'answered',
      updatedAt: serverTimestamp(),
    });
  }

  static async updateQnAStatus(
    qnaId: string,
    status: QnA['status']
  ): Promise<void> {
    const qnaRef = doc(db, COLLECTION_NAME, qnaId);
    await updateDoc(qnaRef, {
      status,
      updatedAt: serverTimestamp(),
    });
  }

  static async updateQnA(
    qnaId: string,
    updateData: {
      title?: string;
      content?: string;
      category?: QnA['category'];
      isSecret?: boolean;
    }
  ): Promise<void> {
    const qnaRef = doc(db, COLLECTION_NAME, qnaId);
    const nextData: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };

    if (updateData.title !== undefined) {
      nextData.title = updateData.title;
    }
    if (updateData.content !== undefined) {
      nextData.content = updateData.content;
    }
    if (updateData.category !== undefined) {
      nextData.category = updateData.category;
    }

    if (updateData.isSecret !== undefined) {
      nextData.isSecret = updateData.isSecret;
    }

    await updateDoc(qnaRef, nextData);
  }

  static async deleteQnA(qnaId: string): Promise<void> {
    const qnaRef = doc(db, COLLECTION_NAME, qnaId);
    await updateDoc(qnaRef, {
      status: 'closed',
      updatedAt: serverTimestamp(),
    });
  }

  static async getUserQnAs(userId: string): Promise<QnA[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => this.convertDocToQnA(doc));
  }

  static async getQnAStats(): Promise<Record<string, number>> {
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    const stats: Record<string, number> = {};

    querySnapshot.docs.forEach(doc => {
      const data = doc.data();
      const category = data.category || 'general';
      stats[category] = (stats[category] || 0) + 1;
    });

    return stats;
  }

  static async getRecentQnAs(limitCount: number = 5): Promise<QnA[]> {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('isSecret', '==', false),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => this.convertDocToQnA(doc));
  }

  private static normalizeServerQnA(qna: RawQnAFromServer): QnA {
    return {
      ...qna,
      createdAt: this.toDate(qna.createdAt),
      updatedAt: this.toDate(qna.updatedAt),
      answer: qna.answer
        ? {
            ...qna.answer,
            answeredAt: this.toDate(qna.answer.answeredAt),
          }
        : undefined,
    } as QnA;
  }

  private static toDate(value: string | Timestamp | Date): Date {
    if (value instanceof Date) {
      return value;
    }

    if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
      return value.toDate();
    }

    return value ? new Date(String(value)) : new Date();
  }

  private static convertDocToQnA(doc: QueryDocumentSnapshot): QnA {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      answer: data.answer
        ? {
            ...data.answer,
            answeredAt: data.answer.answeredAt?.toDate() || new Date(),
          }
        : undefined,
    } as QnA;
  }

}
