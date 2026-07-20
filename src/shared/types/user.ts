export type UserRole = 'user' | 'admin';
export type UserAccountStatus = 'active' | 'inactive' | 'banned' | 'deleted';
export type MutableUserAccountStatus = Exclude<UserAccountStatus, 'deleted'>;

// 사용자(기본 정보)
export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  birthDate?: Date;
  gender?: 'male' | 'female';
  isAdmin?: boolean;
  pointBalance: number;
  createdAt: Date;
  updatedAt: Date;
}

// 회원가입 폼 데이터 (폼에서만 사용)
export interface SignUpFormData {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  phone: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  gender: string;
  termsAgree: boolean;
  privacyAgree: boolean;
  marketingAgree: boolean;
}

// 주소 정보
export interface Address {
  id: string;
  name: string;
  recipient: string;
  phone: string;
  address: string;
  detailAddress: string;
  zipCode: string;
  isDefault: boolean;
}

// 유저 선호도
export interface UserPreferences {
  favoriteCategories: string[];
  favoriteBrands: string[];
  sizes: {
    top?: string;
    bottom?: string;
    shoes?: string;
  };
  newsletter: boolean;
  smsMarketing: boolean;
}

// 사용자 프로필 (서비스에서 활용하는 실제 유저 객체)
export interface UserProfile extends User {
  birthDate: Date;
  gender: 'male' | 'female';
  addresses: Address[];
  preferences: UserPreferences;
  point: number;
  grade: 'bronze' | 'silver' | 'gold' | 'platinum';
  status: UserAccountStatus;
  role: UserRole;
  joinDate: string;
}
