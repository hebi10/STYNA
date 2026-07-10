export interface QnA {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  category: 'product' | 'size' | 'delivery' | 'return' | 'payment' | 'general' | 'other';
  title: string;
  content: string;
  images?: string[];
  isSecret: boolean;
  status: 'waiting' | 'answered' | 'closed';
  views: number;
  isNotified: boolean;
  createdAt: Date;
  updatedAt: Date;
  productId?: string;
  productName?: string;
  answer?: {
    content: string;
    answeredBy: string;
    answeredAt: Date;
    isAdmin: boolean;
  };
}

export interface CreateQnAData {
  category: QnA['category'];
  title: string;
  content: string;
  images?: string[];
  isSecret: boolean;
  isNotified: boolean;
  productId?: string;
  productName?: string;
}

export interface QnAAnswer {
  content: string;
  answeredBy: string;
  answeredAt: Date;
  isAdmin: boolean;
}

export interface QnAFilter {
  category?: QnA['category'];
  status?: QnA['status'];
  isSecret?: boolean;
  userId?: string;
  productId?: string;
  searchTerm?: string;
}

export interface QnAPagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}
