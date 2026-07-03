import { 
  collection, 
  doc, 
  deleteDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  setDoc,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { db } from '@/shared/libs/firebase/firebase';
import { RecentProduct, WishlistItem } from '@/shared/types/userActivity';

const RECENT_PRODUCTS_KEY = 'hebimall_recent_products';
const WISHLIST_KEY = 'hebimall_wishlist';
const MAX_RECENT_PRODUCTS = 20; // 최대 20개까지 저장

function getUserProductDocId(userId: string, productId: string): string {
  return `${userId}_${productId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 180);
}

function toDateValue(value: unknown): Date {
  if (value && typeof value === 'object' && 'toDate' in value) {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isFinite(date.getTime()) ? date : new Date(0);
  }

  const date = new Date(String(value || ''));
  return Number.isFinite(date.getTime()) ? date : new Date(0);
}

function isFirestoreIndexError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('requires an index') || message.includes('failed-precondition');
}

function mapRecentProductDoc(docSnap: QueryDocumentSnapshot<DocumentData>): RecentProduct {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    viewedAt: toDateValue(data.viewedAt),
  } as RecentProduct;
}

function mapWishlistDoc(docSnap: QueryDocumentSnapshot<DocumentData>): WishlistItem {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    addedAt: toDateValue(data.addedAt),
  } as WishlistItem;
}

export class HybridUserActivityService {
  // 사용자 로그인 여부 확인 (실제 구현 시 auth 상태 확인)
  private static isUserLoggedIn(userId?: string): boolean {
    return Boolean(userId && userId !== 'anonymous' && userId.length > 0);
  }

  // ===========================================
  // 최근 본 상품 관리
  // ===========================================

  // 최근 본 상품 추가 (하이브리드)
  static async addRecentProduct(userId: string = 'anonymous', productId: string): Promise<void> {
    if (this.isUserLoggedIn(userId)) {
      return this.addRecentProductFirebase(userId, productId);
    } else {
      return this.addRecentProductLocal(userId, productId);
    }
  }

  // Firebase에 최근 본 상품 추가
  private static async addRecentProductFirebase(userId: string, productId: string): Promise<void> {
    try {
      // 기존에 있는지 확인하고 있으면 업데이트
      const recentCollection = collection(db, 'userRecentProducts');
      const existingQuery = query(
        recentCollection,
        where('userId', '==', userId),
        where('productId', '==', productId)
      );
      
      const existingSnapshot = await getDocs(existingQuery);
      
      if (!existingSnapshot.empty) {
        // 기존 항목이 있으면 업데이트
        const docRef = doc(db, 'userRecentProducts', existingSnapshot.docs[0].id);
        await setDoc(docRef, {
          userId,
          productId,
          viewedAt: Timestamp.now()
        });
      } else {
        // 새 항목 추가
        await setDoc(doc(db, 'userRecentProducts', getUserProductDocId(userId, productId)), {
          userId,
          productId,
          viewedAt: Timestamp.now()
        });
      }

      // 20개 초과 시 오래된 항목 삭제
      const allUserRecentSnapshot = await this.getRecentProductSnapshot(userId, 100);
      if (allUserRecentSnapshot.docs.length > MAX_RECENT_PRODUCTS) {
        const docsToDelete = allUserRecentSnapshot.docs.slice(MAX_RECENT_PRODUCTS);
        for (const docToDelete of docsToDelete) {
          await deleteDoc(docToDelete.ref);
        }
      }
    } catch (error) {
      console.error('Firebase 최근 본 상품 추가 실패:', error);
      // Firebase 실패 시 LocalStorage로 fallback
      this.addRecentProductLocal(userId, productId);
    }
  }

  // LocalStorage에 최근 본 상품 추가
  private static addRecentProductLocal(userId: string, productId: string): void {
    try {
      const key = `${RECENT_PRODUCTS_KEY}_${userId}`;
      const existing = this.getRecentProductsLocal(userId);
      
      // 이미 존재하는 상품 제거 (중복 방지)
      const filtered = existing.filter(item => item.productId !== productId);
      
      // 새 항목을 맨 앞에 추가
      const newItem: RecentProduct = {
        id: `recent_${Date.now()}_${productId}`,
        productId,
        userId,
        viewedAt: new Date()
      };
      
      const updated = [newItem, ...filtered].slice(0, MAX_RECENT_PRODUCTS);
      
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (error) {
      console.error('LocalStorage 최근 본 상품 추가 실패:', error);
    }
  }

  // 최근 본 상품 조회 (하이브리드)
  static async getRecentProducts(userId: string = 'anonymous', limitCount: number = 10): Promise<RecentProduct[]> {
    if (this.isUserLoggedIn(userId)) {
      return this.getRecentProductsFirebase(userId, limitCount);
    } else {
      return this.getRecentProductsLocal(userId).slice(0, limitCount);
    }
  }

  // Firebase에서 최근 본 상품 조회
  private static async getRecentProductsFirebase(userId: string, limitCount: number): Promise<RecentProduct[]> {
    try {
      const querySnapshot = await this.getRecentProductSnapshot(userId, limitCount);
      return querySnapshot.docs.map(mapRecentProductDoc);
    } catch (error) {
      console.error('Firebase 최근 본 상품 조회 실패:', error);
      // Firebase 실패 시 LocalStorage로 fallback
      return this.getRecentProductsLocal(userId).slice(0, limitCount);
    }
  }

  private static async getRecentProductSnapshot(userId: string, limitCount: number) {
    const recentCollection = collection(db, 'userRecentProducts');
    const orderedQuery = query(
      recentCollection,
      where('userId', '==', userId),
      orderBy('viewedAt', 'desc'),
      limit(limitCount)
    );

    try {
      return await getDocs(orderedQuery);
    } catch (error) {
      if (!isFirestoreIndexError(error)) {
        throw error;
      }

      const fallbackQuery = query(recentCollection, where('userId', '==', userId), limit(100));
      const snapshot = await getDocs(fallbackQuery);
      return {
        docs: [...snapshot.docs]
          .sort((a, b) => toDateValue(b.data().viewedAt).getTime() - toDateValue(a.data().viewedAt).getTime())
          .slice(0, limitCount),
      };
    }
  }

  // LocalStorage에서 최근 본 상품 조회
  private static getRecentProductsLocal(userId: string): RecentProduct[] {
    try {
      const key = `${RECENT_PRODUCTS_KEY}_${userId}`;
      const data = localStorage.getItem(key);
      if (!data) return [];
      
      const items = JSON.parse(data) as RecentProduct[];
      return items.map(item => ({
        ...item,
        viewedAt: new Date(item.viewedAt)
      }));
    } catch (error) {
      console.error('LocalStorage 최근 본 상품 조회 실패:', error);
      return [];
    }
  }

  // 최근 본 상품 삭제 (하이브리드)
  static async removeRecentProduct(userId: string = 'anonymous', productId: string): Promise<void> {
    if (this.isUserLoggedIn(userId)) {
      return this.removeRecentProductFirebase(userId, productId);
    } else {
      return this.removeRecentProductLocal(userId, productId);
    }
  }

  // Firebase에서 최근 본 상품 삭제
  private static async removeRecentProductFirebase(userId: string, productId: string): Promise<void> {
    try {
      const recentCollection = collection(db, 'userRecentProducts');
      const q = query(
        recentCollection,
        where('userId', '==', userId),
        where('productId', '==', productId)
      );
      
      const querySnapshot = await getDocs(q);
      for (const docSnap of querySnapshot.docs) {
        await deleteDoc(docSnap.ref);
      }
    } catch (error) {
      console.error('Firebase 최근 본 상품 삭제 실패:', error);
      // Firebase 실패 시 LocalStorage에서도 삭제 시도
      this.removeRecentProductLocal(userId, productId);
    }
  }

  // LocalStorage에서 최근 본 상품 삭제
  private static removeRecentProductLocal(userId: string, productId: string): void {
    try {
      const key = `${RECENT_PRODUCTS_KEY}_${userId}`;
      const existing = this.getRecentProductsLocal(userId);
      const updated = existing.filter(item => item.productId !== productId);
      
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (error) {
      console.error('LocalStorage 최근 본 상품 삭제 실패:', error);
    }
  }

  // ===========================================
  // 위시리스트 관리
  // ===========================================

  // 위시리스트 추가 (하이브리드)
  static async addToWishlist(userId: string = 'anonymous', productId: string): Promise<void> {
    if (this.isUserLoggedIn(userId)) {
      return this.addToWishlistFirebase(userId, productId);
    } else {
      return this.addToWishlistLocal(userId, productId);
    }
  }

  // Firebase에 위시리스트 추가
  private static async addToWishlistFirebase(userId: string, productId: string): Promise<void> {
    try {
      // 이미 존재하는지 확인
      const wishlistCollection = collection(db, 'userWishlist');
      const existingQuery = query(
        wishlistCollection,
        where('userId', '==', userId),
        where('productId', '==', productId)
      );
      
      const existingSnapshot = await getDocs(existingQuery);
      
      if (existingSnapshot.empty) {
        // 새 항목 추가
        await setDoc(doc(db, 'userWishlist', getUserProductDocId(userId, productId)), {
          userId,
          productId,
          addedAt: Timestamp.now()
        });
      }
    } catch (error) {
      console.error('Firebase 위시리스트 추가 실패:', error);
      // Firebase 실패 시 LocalStorage로 fallback
      this.addToWishlistLocal(userId, productId);
    }
  }

  // LocalStorage에 위시리스트 추가
  private static addToWishlistLocal(userId: string, productId: string): void {
    try {
      const key = `${WISHLIST_KEY}_${userId}`;
      const existing = this.getWishlistLocal(userId);
      
      // 이미 존재하는지 확인
      if (!existing.some(item => item.productId === productId)) {
        const newItem: WishlistItem = {
          id: `wishlist_${Date.now()}_${productId}`,
          productId,
          userId,
          addedAt: new Date()
        };
        
        const updated = [...existing, newItem];
        localStorage.setItem(key, JSON.stringify(updated));
      }
    } catch (error) {
      console.error('LocalStorage 위시리스트 추가 실패:', error);
    }
  }

  // 위시리스트 조회 (하이브리드)
  static async getWishlist(userId: string = 'anonymous'): Promise<WishlistItem[]> {
    if (this.isUserLoggedIn(userId)) {
      return this.getWishlistFirebase(userId);
    } else {
      return this.getWishlistLocal(userId);
    }
  }

  // Firebase에서 위시리스트 조회
  private static async getWishlistFirebase(userId: string): Promise<WishlistItem[]> {
    try {
      const querySnapshot = await this.getWishlistSnapshot(userId);
      return querySnapshot.docs.map(mapWishlistDoc);
    } catch (error) {
      console.error('Firebase 위시리스트 조회 실패:', error);
      // Firebase 실패 시 LocalStorage로 fallback
      return this.getWishlistLocal(userId);
    }
  }

  private static async getWishlistSnapshot(userId: string) {
    const wishlistCollection = collection(db, 'userWishlist');
    const orderedQuery = query(
      wishlistCollection,
      where('userId', '==', userId),
      orderBy('addedAt', 'desc')
    );

    try {
      return await getDocs(orderedQuery);
    } catch (error) {
      if (!isFirestoreIndexError(error)) {
        throw error;
      }

      const snapshot = await getDocs(query(wishlistCollection, where('userId', '==', userId)));
      return {
        docs: [...snapshot.docs]
          .sort((a, b) => toDateValue(b.data().addedAt).getTime() - toDateValue(a.data().addedAt).getTime()),
      };
    }
  }

  // LocalStorage에서 위시리스트 조회
  private static getWishlistLocal(userId: string): WishlistItem[] {
    try {
      const key = `${WISHLIST_KEY}_${userId}`;
      const data = localStorage.getItem(key);
      if (!data) return [];
      
      const items = JSON.parse(data) as WishlistItem[];
      return items.map(item => ({
        ...item,
        addedAt: new Date(item.addedAt)
      }));
    } catch (error) {
      console.error('LocalStorage 위시리스트 조회 실패:', error);
      return [];
    }
  }

  // 위시리스트 삭제 (하이브리드)
  static async removeFromWishlist(userId: string = 'anonymous', productId: string): Promise<void> {
    if (this.isUserLoggedIn(userId)) {
      return this.removeFromWishlistFirebase(userId, productId);
    } else {
      return this.removeFromWishlistLocal(userId, productId);
    }
  }

  // Firebase에서 위시리스트 삭제
  private static async removeFromWishlistFirebase(userId: string, productId: string): Promise<void> {
    try {
      const wishlistCollection = collection(db, 'userWishlist');
      const q = query(
        wishlistCollection,
        where('userId', '==', userId),
        where('productId', '==', productId)
      );
      
      const querySnapshot = await getDocs(q);
      for (const docSnap of querySnapshot.docs) {
        await deleteDoc(docSnap.ref);
      }
    } catch (error) {
      console.error('Firebase 위시리스트 삭제 실패:', error);
      // Firebase 실패 시 LocalStorage에서도 삭제 시도
      this.removeFromWishlistLocal(userId, productId);
    }
  }

  // LocalStorage에서 위시리스트 삭제
  private static removeFromWishlistLocal(userId: string, productId: string): void {
    try {
      const key = `${WISHLIST_KEY}_${userId}`;
      const existing = this.getWishlistLocal(userId);
      const updated = existing.filter(item => item.productId !== productId);
      
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (error) {
      console.error('LocalStorage 위시리스트 삭제 실패:', error);
    }
  }

  // 위시리스트에 있는지 확인 (하이브리드)
  static async isInWishlist(userId: string = 'anonymous', productId: string): Promise<boolean> {
    try {
      const wishlist = await this.getWishlist(userId);
      return wishlist.some(item => item.productId === productId);
    } catch (error) {
      console.error('위시리스트 확인 실패:', error);
      return false;
    }
  }

  // ===========================================
  // 데이터 마이그레이션 (로그인 시 LocalStorage → Firebase)
  // ===========================================

  // 로그인 시 LocalStorage 데이터를 Firebase로 마이그레이션
  static async migrateLocalDataToFirebase(oldUserId: string = 'anonymous', newUserId: string): Promise<void> {
    if (!this.isUserLoggedIn(newUserId)) return;

    try {
      // 최근 본 상품 마이그레이션
      const localRecents = this.getRecentProductsLocal(oldUserId);
      for (const item of localRecents) {
        await this.addRecentProductFirebase(newUserId, item.productId);
      }
      
      // 위시리스트 마이그레이션
      const localWishlist = this.getWishlistLocal(oldUserId);
      for (const item of localWishlist) {
        await this.addToWishlistFirebase(newUserId, item.productId);
      }
      
      // LocalStorage 데이터 삭제
      localStorage.removeItem(`${RECENT_PRODUCTS_KEY}_${oldUserId}`);
      localStorage.removeItem(`${WISHLIST_KEY}_${oldUserId}`);
      
    } catch (error) {
      console.error('데이터 마이그레이션 실패:', error);
    }
  }

  // 전체 데이터 삭제
  static async clearAllUserData(userId: string): Promise<void> {
    if (this.isUserLoggedIn(userId)) {
      // Firebase 데이터 삭제
      try {
        const recentCollection = collection(db, 'userRecentProducts');
        const wishlistCollection = collection(db, 'userWishlist');
        
        const [recentQuery, wishlistQuery] = await Promise.all([
          getDocs(query(recentCollection, where('userId', '==', userId))),
          getDocs(query(wishlistCollection, where('userId', '==', userId)))
        ]);
        
        const deletePromises: Promise<void>[] = [];
        
        recentQuery.docs.forEach(doc => {
          deletePromises.push(deleteDoc(doc.ref));
        });
        
        wishlistQuery.docs.forEach(doc => {
          deletePromises.push(deleteDoc(doc.ref));
        });
        
        await Promise.all(deletePromises);
      } catch (error) {
        console.error('Firebase 데이터 삭제 실패:', error);
      }
    }
    
    // LocalStorage 데이터 삭제
    localStorage.removeItem(`${RECENT_PRODUCTS_KEY}_${userId}`);
    localStorage.removeItem(`${WISHLIST_KEY}_${userId}`);
  }
}
