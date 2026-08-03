export interface Inquiry {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  category: 'order' | 'delivery' | 'exchange' | 'product' | 'account' | 'other';
  title: string;
  content: string;
  status: 'waiting' | 'answered' | 'closed';
  createdAt: Date;
  updatedAt: Date;
  unreadForAdmin: boolean;
  unreadForCustomer: boolean;
  answer?: {
    content: string;
    answeredBy: string;
    answeredAt: Date;
  };
}

export interface CreateInquiryData {
  category: Inquiry['category'];
  title: string;
  content: string;
}

export interface InquiryAnswer {
  content: string;
  answeredBy: string;
  answeredAt: Date;
}

export type InquiryNotificationAudience = 'admin' | 'customer';

export interface SubscribeToUnreadInquiryOptions {
  audience: InquiryNotificationAudience;
  userId: string;
}
