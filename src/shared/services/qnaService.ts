import {
  doc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '@/shared/libs/firebase/firebase';
import {
  PublicQnA,
  PublicQnAFilter,
  QnAAnswer,
  QnAPagination,
} from '@/shared/types/qna';

const COLLECTION_NAME = 'qna';

interface QnASecretVerifyResponse {
  success: boolean;
  qna?: RawQnAFromServer;
  error?: string;
}

interface RawQnAFromServer {
  id: string;
  userName: string;
  category: PublicQnA['category'];
  title: string;
  content: string;
  images?: string[];
  isSecret: boolean;
  status: PublicQnA['status'];
  views: number;
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

interface QnAPublicListResponse {
  success: boolean;
  qnas?: RawQnAFromServer[];
  pagination?: QnAPagination;
  error?: string;
}

interface QnAAccessResult {
  success: boolean;
  qna: PublicQnA | null;
  error?: string;
}

export class QnAService {
  // QnA 목록 조회
  static async getQnAList(
    filters: PublicQnAFilter = {},
    page: number = 1,
    limitCount: number = 10
  ): Promise<{ qnas: PublicQnA[]; pagination: QnAPagination }> {
    const rawFilters = filters as Record<string, unknown>;
    if ('isSecret' in rawFilters || 'userId' in rawFilters) {
      throw new Error('Public QnA queries do not accept private filters.');
    }
    const publicFilters = {
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.productId ? { productId: filters.productId } : {}),
    };
    if (Object.keys(publicFilters).length > 1) {
      throw new Error('Public QnA queries support one filter at a time.');
    }

    const response = await fetch('/api/qna/public', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'publicList',
        filters: publicFilters,
        page,
        limit: limitCount,
      }),
      cache: 'no-store',
    });
    const body = await response.json().catch(() => ({}));
    const parsed = body as QnAPublicListResponse;
    if (!response.ok || !parsed.success || !parsed.qnas || !parsed.pagination) {
      throw new Error(parsed.error || `HTTP ${response.status}`);
    }

    const qnas = parsed.qnas.map((qna) => this.normalizeServerQnA(qna));

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
      pagination: parsed.pagination,
    };
  }

  // 단일 QnA 조회 (권한 충족 시)
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
        action: 'getDetail',
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

  private static normalizeServerQnA(qna: RawQnAFromServer): PublicQnA {
    return {
      id: qna.id,
      userName: qna.userName,
      category: qna.category,
      title: qna.title,
      content: qna.content,
      images: qna.images,
      isSecret: qna.isSecret,
      status: qna.status,
      views: qna.views,
      createdAt: this.toDate(qna.createdAt),
      updatedAt: this.toDate(qna.updatedAt),
      productId: qna.productId,
      productName: qna.productName,
      answer: qna.answer
        ? {
            content: qna.answer.content,
            answeredBy: qna.answer.answeredBy,
            answeredAt: this.toDate(qna.answer.answeredAt),
            isAdmin: qna.answer.isAdmin,
          }
        : undefined,
    };
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

}
