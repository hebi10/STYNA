// 쿠폰 관리 서비스

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  documentId,
  orderBy
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '@/shared/libs/firebase/firebase';
import { 
  Coupon, 
  UserCoupon, 
  UserCouponView,
  CouponResponse,
  CouponFilter,
  CouponStats
} from '@/shared/types/coupon';
import { isExpiredOnKstDay, parseCouponExpiryDay, toKstDayKey } from '@/shared/utils/kstDate';

/** Firebase Auth ID 토큰을 가져오는 헬퍼 */
async function getIdToken(): Promise<string> {
  const user = getAuth().currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');
  return user.getIdToken();
}

/** 통합 Coupon API 호출 헬퍼 */
type ApiPayload = Record<string, unknown>;
type CouponApiResult = ApiPayload & {
  couponId?: string;
  message?: string;
};

function getUnknownErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

async function callCouponAPI(action: string, data?: object): Promise<CouponApiResult> {
  const token = await getIdToken();
  const res = await fetch('/api/coupon', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, ...data }),
  });

  const json = await res.json();

  if (!json.success) {
    throw new Error(json.error || '요청에 실패했습니다.');
  }

  return (json.data ?? {}) as CouponApiResult;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function normalizeCoupon(id: string, data: Record<string, unknown>): Coupon {
  return {
    id,
    ...data,
    createdAt: (data.createdAt as { toDate?: () => Date } | undefined)?.toDate?.() || new Date(),
    updatedAt: (data.updatedAt as { toDate?: () => Date } | undefined)?.toDate?.() || new Date()
  } as Coupon;
}

export class CouponService {
  
  // ============ 쿠폰 마스터 관련 ============
  
  /**
   * 모든 쿠폰 마스터 조회 (관리자용)
   */
  static async getAllCoupons(): Promise<Coupon[]> {
    try {
      const q = query(
        collection(db, 'coupons'),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as Coupon[];
    } catch (error) {
 console.error('모든 쿠폰 조회 실패:', error);
      throw new Error('쿠폰 정보를 불러오는데 실패했습니다.');
    }
  }

  /**
   * 쿠폰 마스터 생성 (관리자용)
   */
  static async createCoupon(couponData: Omit<Coupon, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const result = await callCouponAPI('adminCreate', couponData);
      if (!result.couponId) {
        throw new Error('생성된 쿠폰 ID를 확인할 수 없습니다.');
      }
      return result.couponId;
    } catch (error) {
 console.error('쿠폰 생성 실패:', error);
      throw new Error('쿠폰 생성에 실패했습니다.');
    }
  }

  /**
   * 쿠폰 마스터 수정 (관리자용)
   */
  static async updateCoupon(couponId: string, updateData: Partial<Coupon>): Promise<void> {
    try {
      // undefined 값들을 제거한 클린 데이터 생성
      const cleanedData: Record<string, unknown> = {};
      
      Object.entries(updateData).forEach(([key, value]) => {
        if (value !== undefined) {
          cleanedData[key] = value;
        }
      });
      
      await callCouponAPI('adminUpdate', {
        couponId,
        ...cleanedData,
      });
    } catch (error) {
 console.error('쿠폰 수정 실패:', error);
      throw new Error('쿠폰 수정에 실패했습니다.');
    }
  }

  /**
   * 쿠폰 마스터 삭제 (관리자용)
   */
  static async deleteCoupon(couponId: string): Promise<void> {
    try {
      await callCouponAPI('adminArchive', { couponId });
    } catch (error) {
 console.error('쿠폰 삭제 실패:', error);
      throw new Error('쿠폰 삭제에 실패했습니다.');
    }
  }

  /**
   * 전체 쿠폰 통계 조회 (관리자용)
   */
  static async getCouponStats(): Promise<CouponStats> {
    try {
      const q = query(collection(db, 'user_coupons'));
      const querySnapshot = await getDocs(q);
      const userCoupons = querySnapshot.docs.map(doc => doc.data()) as UserCoupon[];

      const stats: CouponStats = {
        total: userCoupons.length,
        available: userCoupons.filter(c => c.status === '사용가능').length,
        used: userCoupons.filter(c => c.status === '사용완료').length,
        expired: userCoupons.filter(c => c.status === '기간만료').length
      };

      return stats;
    } catch (error) {
 console.error('전체 쿠폰 통계 조회 실패:', error);
      throw new Error('쿠폰 통계를 불러오는데 실패했습니다.');
    }
  }
  
  /**
   * 모든 활성화된 쿠폰 마스터 조회
   */
  static async getActiveCoupons(): Promise<Coupon[]> {
    try {
      const q = query(
        collection(db, 'coupons'),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as Coupon[];
    } catch (error) {
 console.error('쿠폰 마스터 조회 실패:', error);
      // 대시보드가 중단되지 않도록 빈 배열 반환
 console.warn('쿠폰 데이터를 불러올 수 없습니다. 빈 배열을 반환합니다.');
      return [];
    }
  }

  /**
   * 특정 쿠폰 마스터 조회
   */
  static async getCouponById(couponId: string): Promise<Coupon | null> {
    try {
      const docRef = doc(db, 'coupons', couponId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }
      
      return {
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate() || new Date(),
        updatedAt: docSnap.data().updatedAt?.toDate() || new Date()
      } as Coupon;
    } catch (error) {
 console.error('쿠폰 조회 실패:', error);
      throw new Error('쿠폰 정보를 불러오는데 실패했습니다.');
    }
  }

  private static async getCouponsByIds(couponIds: string[]): Promise<Map<string, Coupon>> {
    const uniqueIds = Array.from(new Set(couponIds)).filter(Boolean);
    const coupons = new Map<string, Coupon>();

    for (const ids of chunk(uniqueIds, 10)) {
      const snapshot = await getDocs(query(
        collection(db, 'coupons'),
        where(documentId(), 'in', ids)
      ));

      snapshot.docs.forEach(doc => {
        coupons.set(doc.id, normalizeCoupon(doc.id, doc.data()));
      });
    }

    return coupons;
  }

  // ============ 유저 쿠폰 관련 ============
  
  /**
   * 사용자의 쿠폰 목록 조회 (쿠폰 마스터 정보 포함)
   */
  static async getUserCoupons(
    uid: string, 
    filter: CouponFilter = {},
    limitCount: number = 50
  ): Promise<UserCouponView[]> {
    try {
      // 1. user_coupons 조회 (단순 쿼리로 수정)
      let q = query(
        collection(db, 'user_coupons'),
        where('uid', '==', uid)
      );

      // 상태별 필터링이 있는 경우에만 추가 조건
      if (filter.status && filter.status !== '전체') {
        q = query(
          collection(db, 'user_coupons'),
          where('uid', '==', uid),
          where('status', '==', filter.status)
        );
      }

      const userCouponsSnapshot = await getDocs(q);
      
      let userCoupons = userCouponsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as UserCoupon[];

      // 클라이언트 사이드에서 정렬 및 제한
      if (filter.sortBy) {
        userCoupons = userCoupons.sort((a, b) => {
          const sortBy = filter.sortBy || 'issuedDate';
          const sortOrder = filter.sortOrder || 'desc';
          
          let aValue = 0;
          let bValue = 0;
          
          if (sortBy === 'issuedDate') {
            aValue = new Date(a.issuedDate).getTime();
            bValue = new Date(b.issuedDate).getTime();
          } else if (sortBy === 'name') {
            // 이름은 쿠폰 마스터에서 가져와야 하므로 나중에 처리
            return 0;
          } else {
            const aRecord = a as unknown as Record<string, unknown>;
            const bRecord = b as unknown as Record<string, unknown>;
            aValue = Number(aRecord[sortBy]) || 0;
            bValue = Number(bRecord[sortBy]) || 0;
          }
          
          if (sortOrder === 'desc') {
            return bValue - aValue;
          } else {
            return aValue - bValue;
          }
        });
      }

      // 제한 적용
      userCoupons = userCoupons.slice(0, limitCount);

      const couponMap = await this.getCouponsByIds(userCoupons.map(userCoupon => userCoupon.couponId));
      const userCouponViews: UserCouponView[] = [];
      
      for (const userCoupon of userCoupons) {
        const coupon = couponMap.get(userCoupon.couponId);
        if (coupon) {
          // 타입별 필터링
          if (filter.type && filter.type !== '전체' && coupon.type !== filter.type) {
            continue;
          }
          
          userCouponViews.push({
            ...userCoupon,
            coupon
          });
        }
      }

      // 쿠폰 이름으로 정렬이 필요한 경우
      if (filter.sortBy === 'name') {
        userCouponViews.sort((a, b) => {
          const sortOrder = filter.sortOrder || 'desc';
          if (sortOrder === 'desc') {
            return b.coupon.name.localeCompare(a.coupon.name);
          } else {
            return a.coupon.name.localeCompare(b.coupon.name);
          }
        });
      }
      
      return userCouponViews;
    } catch (error) {
 console.error(' 사용자 쿠폰 목록 조회 실패:', error);
      throw new Error('쿠폰 목록을 불러오는데 실패했습니다.');
    }
  }

  /**
   * 사용자의 쿠폰 통계 조회
   */
  static async getUserCouponStats(uid: string): Promise<CouponStats> {
    try {
      const q = query(
        collection(db, 'user_coupons'),
        where('uid', '==', uid)
      );

      const querySnapshot = await getDocs(q);
      const userCoupons = querySnapshot.docs.map(doc => doc.data()) as UserCoupon[];

      const stats: CouponStats = {
        total: userCoupons.length,
        available: userCoupons.filter(c => c.status === '사용가능').length,
        used: userCoupons.filter(c => c.status === '사용완료').length,
        expired: userCoupons.filter(c => c.status === '기간만료').length
      };

      return stats;
    } catch (error) {
 console.error('쿠폰 통계 조회 실패:', error);
      throw new Error('쿠폰 통계를 불러오는데 실패했습니다.');
    }
  }

  /**
   * 특정 유저쿠폰 조회
   */
  static async getUserCouponById(userCouponId: string): Promise<UserCoupon | null> {
    try {
      const docRef = doc(db, 'user_coupons', userCouponId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }
      
      return {
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate() || new Date(),
        updatedAt: docSnap.data().updatedAt?.toDate() || new Date()
      } as UserCoupon;
    } catch (error) {
 console.error('유저쿠폰 조회 실패:', error);
      throw new Error('쿠폰 정보를 불러오는데 실패했습니다.');
    }
  }

  /**
   * 주문에 사용 가능한 쿠폰 목록 조회
   */
  static async getAvailableCouponsForOrder(
    uid: string, 
    orderAmount: number
  ): Promise<UserCouponView[]> {
    try {
      const userCoupons = await this.getUserCoupons(uid, { 
        status: '사용가능' 
      });

      // 최소 주문 금액 조건 확인 및 만료일 확인
      const today = new Date();
      const availableCoupons = userCoupons.filter(userCouponView => {
        const { coupon } = userCouponView;
        
        // 최소 주문 금액 확인
        if (coupon.minOrderAmount && orderAmount < coupon.minOrderAmount) {
          return false;
        }
        
        // 만료일 확인
        if (isExpiredOnKstDay(coupon.expiryDate, today)) {
          return false;
        }
        
        return true;
      });

      return availableCoupons;
    } catch (error) {
 console.error('주문 사용가능 쿠폰 조회 실패:', error);
      throw new Error('사용 가능한 쿠폰을 불러오는데 실패했습니다.');
    }
  }

  // ============ 쿠폰 발급/사용/등록 (Firebase Functions) ============
  
  /**
   * 쿠폰 사용 (REST API 호출)
   */
  static async redeemCoupon(
    userCouponId: string,
    orderId: string,
    uid: string
  ): Promise<CouponResponse> {
    void uid;
    try {
      const result = await callCouponAPI('use', { userCouponId, orderId });
      return { success: true, message: result.message || '쿠폰이 사용되었습니다.', data: result };
    } catch (error) {
 console.error('쿠폰 사용 실패:', error);
      throw new Error(getUnknownErrorMessage(error, '쿠폰 사용에 실패했습니다.'));
    }
  }

  /**
   * 쿠폰 코드로 등록 (REST API 호출)
   */
  static async registerCouponByCode(uid: string, couponCode: string): Promise<CouponResponse> {
    try {
 console.log('쿠폰 등록 시도:', { uid, couponCode });
      const result = await callCouponAPI('register', { couponCode });
 console.log('쿠폰 등록 결과:', result);
      return { success: true, message: result.message || '쿠폰이 등록되었습니다.', data: result };
    } catch (error) {
 console.error('쿠폰 등록 실패 상세:', error);
      throw new Error(getUnknownErrorMessage(error, '쿠폰 등록에 실패했습니다.'));
    }
  }

  // ============ 유틸리티 메서드 ============
  
  /**
   * 만료일까지 남은 일수 계산
   */
  static getDaysUntilExpiry(expiryDate: string): number {
    const expiryDay = parseCouponExpiryDay(expiryDate);
    if (!expiryDay) {
      return 0;
    }

    const dayToUtcTime = (day: string) => {
      const [year, month, date] = day.split('-').map(Number);
      return Date.UTC(year, month - 1, date);
    };
    return (dayToUtcTime(expiryDay) - dayToUtcTime(toKstDayKey(new Date()))) / (1000 * 60 * 60 * 24);
  }

  /**
   * 쿠폰 할인 금액 계산
   */
  static calculateDiscount(coupon: Coupon, orderAmount: number): number {
    switch (coupon.type) {
      case '할인금액':
        return Math.min(coupon.value, orderAmount);
      case '할인율':
        return Math.floor(orderAmount * (coupon.value / 100));
      case '무료배송':
        return 0; // 배송비는 별도 처리
      default:
        return 0;
    }
  }
}
