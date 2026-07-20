import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from '@/shared/libs/firebase/firebase';
import { QnA, CreateQnAData } from '@/shared/types/qna';

const COLLECTION_NAME = 'qna';

export class SimpleQnAService {
  // QnA 생성 (간단한 버전)
  static async createQnA(
    userId: string,
    userEmail: string,
    userName: string,
    data: CreateQnAData
  ): Promise<string> {
    try {
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
        ...(data.productId !== undefined ? { productId: data.productId } : {}),
        ...(data.productName !== undefined ? { productName: data.productName } : {}),
      };

      const docRef = await addDoc(collection(db, COLLECTION_NAME), qnaData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating QnA:', error);
      throw error;
    }
  }

  // 사용자별 QnA 목록 (간단한 버전)
  static async getUserQnAs(userId: string): Promise<QnA[]> {
    try {
      // 복합 인덱스 없이 단순 쿼리
      const q = query(
        collection(db, COLLECTION_NAME),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => this.convertDocToQnA(doc));
    } catch (error) {
      console.error('Error fetching user QnAs:', error);
      throw error;
    }
  }

  // 모든 QnA 목록 (간단한 버전)
  static async getAllQnAs(limitCount: number = 10): Promise<QnA[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => this.convertDocToQnA(doc));
    } catch (error) {
      console.error('Error fetching QnAs:', error);
      throw error;
    }
  }

  // Firestore 문서를 QnA 객체로 변환
  private static convertDocToQnA(doc: QueryDocumentSnapshot<DocumentData>): QnA {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      answer: data.answer ? {
        ...data.answer,
        answeredAt: data.answer.answeredAt?.toDate() || new Date(),
      } : undefined,
    } as QnA;
  }
}
