export type EventContent = string;
export type EventType = 'sale' | 'coupon' | 'special' | 'new';
export type EventUiVariant = EventType | 'review';
export type EventCouponType = 'manual' | 'auto';

export interface EventEditorialImages {
  benefit?: string;
  styling?: string;
  product?: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  content?: EventContent | null;
  bannerImage: string;
  thumbnailImage: string;
  detailImage?: string;
  editorialImages?: EventEditorialImages;
  eventType: EventType;
  couponType?: EventCouponType;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  discountRate?: number;
  discountAmount?: number;
  couponCode?: string;
  rewardCouponId?: string;
  targetProducts?: string[];
  targetCategories?: string[];
  participantCount: number;
  maxParticipants?: number;
  hasMaxParticipants?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventParticipant {
  id: string;
  eventId: string;
  userId: string;
  userName: string;
  participatedAt: Date;
  couponUsed?: boolean;
  rewardCouponId?: string;
  userCouponId?: string;
}

export interface EventFilter {
  eventType?: EventType;
  isActive?: boolean;
  startDate?: Date;
  endDate?: Date;
}
