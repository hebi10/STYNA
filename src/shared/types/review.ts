export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  title: string;
  content: string;
  images: string[];
  size: string;
  color: string;
  height?: number;
  weight?: number;
  isRecommended: boolean;
  orderId?: string;
  verifiedPurchase?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewSummary {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
  recommendationRate: number;
}
