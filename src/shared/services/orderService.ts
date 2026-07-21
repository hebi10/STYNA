import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '@/shared/libs/firebase/firebase';
import { Order, OrderStatus } from '@/shared/types/order';

interface CreateOrderItemRequest {
  id?: string;
  productId: string;
  size?: string;
  color?: string;
  quantity: number;
}

export interface CreateOrderRequest {
  items: CreateOrderItemRequest[];
  deliveryAddress: {
    id: string;
    name: string;
    recipient: string;
    phone: string;
    address: string;
    detailAddress: string;
    zipCode: string;
    isDefault?: boolean;
  };
  paymentMethod: string;
  deliveryOption: string;
  selectedCoupon?: string;
  requestedPointAmount?: number;
}

export interface CreateOrderResponse {
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  discountAmount: number;
  deliveryFee: number;
  finalAmount: number;
  pointUsed: number;
  paymentMethod: string;
  status: OrderStatus;
}

interface CancelOrderRequest {
  action: 'cancel';
  orderId: string;
  reason?: string;
}

async function getIdToken(): Promise<string> {
  const user = getAuth().currentUser;
  if (!user) {
    throw new Error('로그인이 필요합니다.');
  }
  return user.getIdToken();
}

async function callOrdersAPI(payload: CreateOrderRequest): Promise<CreateOrderResponse> {
  const token = await getIdToken();
  const res = await fetch('/api/order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || '주문 생성 API 오류가 발생했습니다.');
  }

  return data.data as CreateOrderResponse;
}

async function callOrderAdminAPI(payload: Record<string, unknown>): Promise<void> {
  const token = await getIdToken();
  const res = await fetch('/api/order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || '주문 관리자 요청에 실패했습니다.');
  }
}

async function callOrderMutationAPI(payload: CancelOrderRequest): Promise<void> {
  const token = await getIdToken();
  const res = await fetch('/api/order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || '주문 요청에 실패했습니다.');
  }
}

export class OrderService {
  private static readonly COLLECTION_NAME = 'orders';

  private static normalizeDate(value: unknown): Date {
    if (value instanceof Date) {
      return value;
    }

    if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
      return (value as { toDate: () => Date }).toDate();
    }

    return new Date();
  }

  private static normalizeOrder(orderId: string, data: Record<string, unknown>): Order {
    const shippingAddress = data.shippingAddress || data.deliveryAddress;

    return {
      id: orderId,
      ...data,
      shippingAddress,
      deliveryAddress: data.deliveryAddress || shippingAddress,
      createdAt: this.normalizeDate(data.createdAt),
      updatedAt: this.normalizeDate(data.updatedAt),
      estimatedDeliveryDate: data.estimatedDeliveryDate
        ? this.normalizeDate(data.estimatedDeliveryDate)
        : undefined,
      cancelledAt: data.cancelledAt ? this.normalizeDate(data.cancelledAt) : undefined,
      cancellationRestoredAt: data.cancellationRestoredAt
        ? this.normalizeDate(data.cancellationRestoredAt)
        : undefined,
    } as Order;
  }

  static async createOrder(orderData: CreateOrderRequest): Promise<CreateOrderResponse> {
    try {
      return await callOrdersAPI(orderData);
    } catch (error) {
      console.error('Failed to create order:', error);
      throw error;
    }
  }

  static async getOrder(orderId: string): Promise<Order | null> {
    try {
      const orderRef = doc(db, this.COLLECTION_NAME, orderId);
      const orderSnap = await getDoc(orderRef);

      if (!orderSnap.exists()) {
        return null;
      }

      return this.normalizeOrder(orderSnap.id, orderSnap.data());
    } catch (error) {
      console.error('Failed to load order:', error);
      throw error;
    }
  }

  static async getUserOrders(userId: string, limitCount: number = 20): Promise<Order[]> {
    try {
      const ordersRef = collection(db, this.COLLECTION_NAME);
      const simpleQuery = query(ordersRef, where('userId', '==', userId), limit(limitCount));
      const querySnapshot = await getDocs(simpleQuery);

      return querySnapshot.docs
        .map((orderDoc) => this.normalizeOrder(orderDoc.id, orderDoc.data()))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      console.error('Failed to load user orders:', error);

      let userMessage = '주문 목록을 불러오지 못했습니다.';
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.includes('index')) {
        userMessage = '인덱스를 준비 중입니다. 잠시 후 다시 시도해 주세요.';
      } else if (errorMessage.includes('permission')) {
        userMessage = '접근 권한이 없습니다. 로그인 상태를 확인해 주세요.';
      }

      throw new Error(userMessage);
    }
  }

  static async getAllOrders(limitCount: number = 50): Promise<Order[]> {
    try {
      const ordersRef = collection(db, this.COLLECTION_NAME);
      const q = query(ordersRef, orderBy('createdAt', 'desc'), limit(limitCount));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((orderDoc) => this.normalizeOrder(orderDoc.id, orderDoc.data()));
    } catch (error) {
      console.error('Failed to load all orders:', error);
      throw error;
    }
  }

  static async getOrdersByStatus(status: OrderStatus, limitCount: number = 20): Promise<Order[]> {
    try {
      const ordersRef = collection(db, this.COLLECTION_NAME);
      const q = query(
        ordersRef,
        where('status', '==', status),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((orderDoc) => this.normalizeOrder(orderDoc.id, orderDoc.data()));
    } catch (error) {
      console.error('Failed to load orders by status:', error);
      throw error;
    }
  }

  static async updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
    try {
      await callOrderAdminAPI({
        action: 'updateStatus',
        orderId,
        status,
      });
    } catch (error) {
      console.error('Failed to update order status:', error);
      throw error;
    }
  }

  static async getOrderByOrderNumber(orderNumber: string): Promise<Order | null> {
    try {
      const ordersRef = collection(db, this.COLLECTION_NAME);
      const q = query(ordersRef, where('orderNumber', '==', orderNumber));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }

      const orderDoc = querySnapshot.docs[0];
      return this.normalizeOrder(orderDoc.id, orderDoc.data());
    } catch (error) {
      console.error('Failed to load order by orderNumber:', error);
      throw error;
    }
  }

  static async getOrderStats(): Promise<{
    total: number;
    pending: number;
    confirmed: number;
    shipped: number;
    delivered: number;
    cancelled: number;
    totalAmount: number;
  }> {
    try {
      const orders = await this.getAllOrders(1000);

      return {
        total: orders.length,
        pending: orders.filter((order) => order.status === 'pending').length,
        confirmed: orders.filter((order) => order.status === 'confirmed').length,
        shipped: orders.filter((order) => order.status === 'shipped').length,
        delivered: orders.filter((order) => order.status === 'delivered').length,
        cancelled: orders.filter((order) => order.status === 'cancelled').length,
        totalAmount: orders.reduce((sum, order) => sum + order.finalAmount, 0),
      };
    } catch (error) {
      console.error('Failed to load order stats:', error);
      return {
        total: 0,
        pending: 0,
        confirmed: 0,
        shipped: 0,
        delivered: 0,
        cancelled: 0,
        totalAmount: 0,
      };
    }
  }

  static async getRecentOrders(limitCount: number = 10): Promise<Order[]> {
    try {
      const ordersRef = collection(db, this.COLLECTION_NAME);
      const q = query(ordersRef, orderBy('createdAt', 'desc'), limit(limitCount));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((orderDoc) => this.normalizeOrder(orderDoc.id, orderDoc.data()));
    } catch (error) {
      console.error('Failed to load recent orders:', error);
      throw error;
    }
  }

  static async cancelOrder(orderId: string, reason?: string): Promise<void> {
    try {
      await callOrderMutationAPI({
        action: 'cancel',
        orderId,
        reason,
      });
    } catch (error) {
      console.error('Failed to cancel order:', error);
      throw error;
    }
  }

}
