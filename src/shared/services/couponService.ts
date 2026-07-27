// 쿠폰 관리 서비스

import { 
  collection, 
  doc, 
  getCountFromServer,
  getDoc, 
  getDocs, 
  limit,
  query, 
  where, 
  documentId,
  orderBy,
  type QueryConstraint,
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

export interface UserCouponOverview {
  coupons: UserCouponView[];
  stats: CouponStats;
  isTruncated: boolean;
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

    const snapshots = await Promise.all(chunk(uniqueIds, 10).map((ids) => getDocs(query(
        collection(db, 'coupons'),
        where(documentId(), 'in', ids)
      ))));

    for (const snapshot of snapshots) {
      snapshot.docs.forEach(doc => {
        coupons.set(doc.id, normalizeCoupon(doc.id, doc.data()));
      });
    }

    return coupons;
  }

  // ============ 유저 쿠폰 관련 ============

  private static async loadUserCouponViews(
    uid: string,
    filter: CouponFilter,
    limitCount: number,
    queryLimitCount?: number,
    sortByCreatedAt: boolean = false,
  ): Promise<{ coupons: UserCouponView[]; records: UserCoupon[] }> {
    const queryConstraints: QueryConstraint[] = [where('uid', '==', uid)];

    if (filter.status && filter.status !== '전체') {
      queryConstraints.push(where('status', '==', filter.status));
    }

    if (queryLimitCount) {
      queryConstraints.push(orderBy('createdAt', 'desc'));
      queryConstraints.push(limit(queryLimitCount));
    }

    const userCouponQuery = query(collection(db, 'user_coupons'), ...queryConstraints);
    const userCouponsSnapshot = await getDocs(userCouponQuery);
    const records = userCouponsSnapshot.docs.map((userCouponDoc) => {
      const data = userCouponDoc.data();
      return {
        id: userCouponDoc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as UserCoupon;
    });
    const visibleRecords = [...records];

    if (sortByCreatedAt) {
      visibleRecords.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } else if (filter.sortBy) {
      visibleRecords.sort((a, b) => {
        const sortBy = filter.sortBy || 'issuedDate';
        const sortOrder = filter.sortOrder || 'desc';
        let aValue = 0;
        let bValue = 0;

        if (sortBy === 'issuedDate') {
          aValue = new Date(a.issuedDate).getTime();
          bValue = new Date(b.issuedDate).getTime();
        } else if (sortBy === 'name') {
          return 0;
        } else {
          const aRecord = a as unknown as Record<string, unknown>;
          const bRecord = b as unknown as Record<string, unknown>;
          aValue = Number(aRecord[sortBy]) || 0;
          bValue = Number(bRecord[sortBy]) || 0;
        }

        return sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
      });
    }

    const couponMap = await this.getCouponsByIds(
      visibleRecords.map((userCoupon) => userCoupon.couponId),
    );
    const coupons = visibleRecords.flatMap((userCoupon) => {
      const coupon = couponMap.get(userCoupon.couponId);
      if (!coupon || (filter.type && filter.type !== '전체' && coupon.type !== filter.type)) {
        return [];
      }
      return [{ ...userCoupon, coupon }];
    });

    if (filter.sortBy === 'name') {
      coupons.sort((a, b) => {
        const comparison = a.coupon.name.localeCompare(b.coupon.name);
        return filter.sortOrder === 'asc' ? comparison : -comparison;
      });
    }

    return { coupons: coupons.slice(0, limitCount), records };
  }

  private static countUserCoupons(uid: string, status?: UserCoupon['status']) {
    return getCountFromServer(query(
      collection(db, 'user_coupons'),
      where('uid', '==', uid),
      ...(status ? [where('status', '==', status)] : []),
    ));
  }
  
  /**
   * 사용자의 쿠폰 목록 조회 (쿠폰 마스터 정보 포함)
   */
  static async getUserCoupons(
    uid: string, 
    filter: CouponFilter = {},
    limitCount: number = 50
  ): Promise<UserCouponView[]> {
    try {
      return (await this.loadUserCouponViews(uid, filter, limitCount)).coupons;
    } catch (error) {
 console.error(' 사용자 쿠폰 목록 조회 실패:', error);
      throw new Error('쿠폰 목록을 불러오는데 실패했습니다.');
    }
  }

  /**
   * 사용자의 쿠폰 목록과 통계를 같은 user_coupons snapshot에서 조회
   */
  static async getUserCouponOverview(uid: string): Promise<UserCouponOverview> {
    try {
      const totalSnapshot = await this.countUserCoupons(uid);
      const total = totalSnapshot.data().count;

      const { coupons, records } = await this.loadUserCouponViews(
        uid,
        { sortBy: 'issuedDate', sortOrder: 'desc' },
        50,
        total > 50 ? 50 : undefined,
        true,
      );

      if (total > 50) {
        const [availableSnapshot, usedSnapshot, expiredSnapshot] = await Promise.all([
          this.countUserCoupons(uid, '사용가능'),
          this.countUserCoupons(uid, '사용완료'),
          this.countUserCoupons(uid, '기간만료'),
        ]);
        return {
          coupons,
          stats: {
            total,
            available: availableSnapshot.data().count,
            used: usedSnapshot.data().count,
            expired: expiredSnapshot.data().count,
          },
          isTruncated: true,
        };
      }

      return {
        coupons,
        stats: {
          total: records.length,
          available: records.filter((coupon) => coupon.status === '사용가능').length,
          used: records.filter((coupon) => coupon.status === '사용완료').length,
          expired: records.filter((coupon) => coupon.status === '기간만료').length,
        },
        isTruncated: records.length > 50,
      };
    } catch (error) {
      console.error('사용자 쿠폰 목록 조회 실패:', error);
      throw new Error('쿠폰 목록을 불러오는데 실패했습니다.');
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
      }, Number.MAX_SAFE_INTEGER);

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
