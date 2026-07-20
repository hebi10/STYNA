import {
  collection,
  getDocs,
  doc,
  query,
  orderBy,
  where,
  limit,
  getDoc,
  QueryDocumentSnapshot,
  DocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { getAuth, signOut } from 'firebase/auth';
import { db } from '@/shared/libs/firebase/firebase';
import {
  MutableUserAccountStatus,
  UserAccountStatus,
  UserProfile,
  UserRole,
} from '@/shared/types/user';
import { PointHistory } from '@/shared/types/point';
import { notifyAuthAccessChanged } from '@/shared/utils/authAccess';
import { createCsv } from '@/shared/utils/csv';

const COLLECTION_NAME = 'users';

async function getIdToken(): Promise<string> {
  const user = getAuth().currentUser;
  if (!user) {
    throw new Error('로그인이 필요합니다.');
  }

  return user.getIdToken();
}

async function callAdminUsersAPI(action: string, data: Record<string, unknown>): Promise<void> {
  const token = await getIdToken();
  const response = await fetch('/api/admin/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, ...data }),
  });

  let result: { success?: boolean; error?: string } = {};
  try {
    result = await response.json();
  } catch {
    result = { success: false, error: `HTTP ${response.status}` };
  }

  if (!response.ok || !result.success) {
    throw new Error(result.error || '관리자 권한 요청에 실패했습니다.');
  }
}

async function refreshCurrentUserAccess(userId: string): Promise<void> {
  const auth = getAuth();
  const currentUser = auth.currentUser;

  if (!currentUser || currentUser.uid !== userId) {
    return;
  }

  try {
    await currentUser.getIdToken(true);
    notifyAuthAccessChanged(userId);
  } catch (error) {
    try {
      await signOut(auth);
    } catch (signOutError) {
      console.error('Failed to sign out after access refresh failure:', signOutError);
    }
    throw error;
  }
}

async function callPointsAPI(action: string, data: Record<string, unknown>): Promise<void> {
  const token = await getIdToken();
  const response = await fetch('/api/points', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, ...data }),
  });

  let result: { success?: boolean; error?: string } = {};
  try {
    result = await response.json();
  } catch {
    result = { success: false, error: `HTTP ${response.status}` };
  }

  if (!response.ok || !result.success) {
    throw new Error(result.error || '포인트 요청에 실패했습니다.');
  }
}

export interface AdminUserData extends UserProfile {
  lastLogin: Date;
  orders: number;
  totalSpent: number;
  status: UserAccountStatus;
  role: UserRole;
  pointBalance: number;
}

export interface UserStats {
  total: number;
  active: number;
  admin: number;
  newUsers: number;
  totalPoints: number;
}

export interface UserFilter {
  searchTerm?: string;
  role?: string;
  status?: string;
}

export interface PointOperation {
  userId: string;
  amount: number;
  description: string;
  type: 'add' | 'subtract';
}

export class AdminUserService {
  // 사용자 목록 조회
  static async getUsers(
    filters: UserFilter = {},
    page: number = 1,
    limitCount: number = 10
  ): Promise<{ users: AdminUserData[]; totalCount: number }> {
    try {      
      // 복합 인덱스 문제를 피하기 위해 간단한 쿼리 사용
      let q = query(collection(db, COLLECTION_NAME));

      // 단일 필터만 적용 (인덱스 문제 방지)
      if (filters.role && filters.role !== 'all') {
        q = query(q, where('role', '==', filters.role));
      } else if (filters.status && filters.status !== 'all') {
        q = query(q, where('status', '==', filters.status));
      }

      const querySnapshot = await getDocs(q);
      
      let users = querySnapshot.docs.map(doc => {
        return this.convertDocToUser(doc);
      });

      // 클라이언트 사이드 필터링
      if (filters.role && filters.role !== 'all' && filters.status && filters.status !== 'all') {
        // 두 조건 모두 적용
        users = users.filter(user => 
          user.role === filters.role && user.status === filters.status
        );
      }

      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        users = users.filter(user =>
          user.name?.toLowerCase().includes(searchLower) ||
          user.email?.toLowerCase().includes(searchLower)
        );
      }

      // 클라이언트 사이드 정렬 (createdAt이 있는 경우)
      users.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA; // 최신 순
      });

      // 클라이언트 사이드 페이지네이션
      const totalCount = users.length;
      const startIndex = (page - 1) * limitCount;
      const paginatedUsers = users.slice(startIndex, startIndex + limitCount);

      return { users: paginatedUsers, totalCount };
    } catch (error) {
 console.error(' Error fetching users:', error);
      throw error;
    }
  }

  // 모든 사용자 조회 (간단한 쿼리, 인덱스 불필요)
  static async getAllUsersSimple(): Promise<AdminUserData[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME));
      const querySnapshot = await getDocs(q);
      
      const users = querySnapshot.docs.map(doc => {
        return this.convertDocToUser(doc);
      });
      
      return users;
    } catch (error) {
 console.error(' Error fetching all users (simple):', error);
      throw error;
    }
  }

  // 사용자 통계 조회
  static async getUserStats(): Promise<UserStats> {
    try {
      const users = await this.getAllUsersSimple();
      
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const totalPoints = users.reduce((sum: number, user: AdminUserData) => sum + (user.pointBalance || 0), 0);

      return {
        total: users.length,
        active: users.filter((user: AdminUserData) => user.status === 'active').length,
        admin: users.filter((user: AdminUserData) => user.role === 'admin').length,
        newUsers: users.filter((user: AdminUserData) => {
          const joinDate = new Date(user.joinDate || user.createdAt);
          return joinDate >= weekAgo;
        }).length,
        totalPoints
      };
    } catch (error) {
 console.error('Error fetching user stats:', error);
      return { total: 0, active: 0, admin: 0, newUsers: 0, totalPoints: 0 };
    }
  }

  // 사용자 상태 업데이트
  static async updateUserStatus(
    userId: string,
    status: MutableUserAccountStatus
  ): Promise<void> {
    try {
      await callAdminUsersAPI('setStatus', { userId, status });
      await refreshCurrentUserAccess(userId);
    } catch (error) {
 console.error('Error updating user status:', error);
      throw error;
    }
  }

  // 사용자 역할 업데이트
  static async updateUserRole(
    userId: string,
    role: UserRole
  ): Promise<void> {
    try {
      await callAdminUsersAPI('setRole', { userId, role });
      await refreshCurrentUserAccess(userId);
    } catch (error) {
 console.error('Error updating user role:', error);
      throw error;
    }
  }

  // 사용자 삭제 (실제로는 상태를 deleted로 변경)
  static async deleteUser(userId: string): Promise<void> {
    try {
      await callAdminUsersAPI('deleteUser', { userId });
      await refreshCurrentUserAccess(userId);
    } catch (error) {
 console.error('Error deleting user:', error);
      throw error;
    }
  }

  // 사용자 데이터 내보내기 (CSV)
  static async exportUsersToCSV(): Promise<string> {
    try {
      const users = await this.getAllUsersSimple();
      
      const headers = [
        'ID', '이름', '이메일', '역할', '상태', '가입일', 
        '마지막 로그인', '주문수', '총 구매액', '포인트 잔액'
      ];
      
      const rows = [
        headers,
        ...users.map((user: AdminUserData) => [
          user.id,
          user.name,
          user.email,
          user.role,
          user.status,
          user.joinDate,
          user.lastLogin,
          user.orders,
          user.totalSpent,
          user.pointBalance || 0
        ])
      ];

      return `\ufeff${createCsv(rows)}`;
    } catch (error) {
 console.error('Error exporting users to CSV:', error);
      throw error;
    }
  }

  // 사용자 포인트 업데이트
  static async updateUserPoints(operation: PointOperation): Promise<void> {
    try {
      await callPointsAPI(operation.type === 'add' ? 'add' : 'subtract', {
        userId: operation.userId,
        amount: operation.amount,
        description: operation.description,
      });
    } catch (error) {
 console.error('Error updating user points:', error);
      throw error;
    }
  }

  // 사용자 포인트 히스토리 조회
  static async getUserPointHistory(
    userId: string,
    limitCount: number = 50
  ): Promise<PointHistory[]> {
    try {
      const pointHistoryRef = collection(db, COLLECTION_NAME, userId, 'pointHistory');
      const q = query(pointHistoryRef, orderBy('date', 'desc'), limit(limitCount));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: data.type || 'earn',
          amount: Number(data.amount) || 0,
          description: data.description || '',
          date: data.date?.toDate() || new Date(),
          orderId: data.orderId,
          balanceAfter: Number(data.balanceAfter) || 0,
          expired: Boolean(data.expired),
        };
      });
    } catch (error) {
 console.error('Error fetching user point history:', error);
      throw error;
    }
  }

  // 사용자 상세 정보 조회 (포인트 정보 포함)
  static async getUserDetail(userId: string): Promise<AdminUserData | null> {
    try {
      const userRef = doc(db, COLLECTION_NAME, userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        return null;
      }

      return this.convertDocToUser(userDoc);
    } catch (error) {
 console.error('Error fetching user detail:', error);
      throw error;
    }
  }

  // 포인트 일괄 지급
  static async givePointsToAllUsers(amount: number, description: string): Promise<number> {
    try {
      const users = await this.getAllUsersSimple();
      let successCount = 0;

      for (const user of users) {
        if (user.status === 'active') {
          try {
            await this.updateUserPoints({
              userId: user.id,
              amount,
              description,
              type: 'add'
            });
            successCount++;
          } catch (error) {
 console.error(`Failed to give points to user ${user.id}:`, error);
          }
        }
      }

      return successCount;
    } catch (error) {
 console.error('Error giving points to all users:', error);
      throw error;
    }
  }

  // Firestore 문서를 사용자 객체로 변환
  private static convertDocToUser(doc: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>): AdminUserData {
    const data = doc.data() || {};
    
    // 기본값과 null 체크 강화
    const user: AdminUserData = {
      id: doc.id,
      name: data.name || data.displayName || data.username || '이름 없음',
      email: data.email || '',
      phone: data.phone || data.phoneNumber || '',
      role: data.role || 'user',
      status: data.status || 'active',
      joinDate: data.joinDate || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
      orders: data.orders || data.orderCount || 0,
      totalSpent: data.totalSpent || data.totalPurchase || 0,
      pointBalance: data.pointBalance || data.point || data.points || 0,
      isAdmin: data.role === 'admin' || data.isAdmin || false,
      lastLogin: data.lastLogin?.toDate ? data.lastLogin.toDate() : (data.lastLoginAt?.toDate ? data.lastLoginAt.toDate() : new Date()),
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
      birthDate: data.birthDate?.toDate ? data.birthDate.toDate() : undefined,
      gender: data.gender || 'male',
      addresses: data.addresses || [],
      preferences: data.preferences || {
        favoriteCategories: [],
        favoriteBrands: [],
        sizes: {},
        newsletter: false,
        smsMarketing: false,
      },
      point: data.pointBalance || data.point || data.points || 0,
      grade: data.grade || data.tier || 'bronze',
    };

    return user;
  }
}
