const admin = require('firebase-admin');

// Firebase Admin SDK 초기화
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'hebimall'
  });
}

const db = admin.firestore();

// 테스트용 사용자 데이터
const mockUsers = [
  {
    id: 'test-user-1',
    email: 'test@example.com',
    name: '테스트 사용자',
    phoneNumber: '010-1234-5678',
    address: {
      street: '서울특별시 강남구 테헤란로 123',
      city: '서울',
      zipCode: '12345',
    },
    pointBalance: 10000, // 초기 포인트 잔액
    status: 'active',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'test-user-2', 
    email: 'user2@example.com',
    name: '테스트 사용자2',
    phoneNumber: '010-5678-9012',
    address: {
      street: '서울특별시 서초구 강남대로 456',
      city: '서울',
      zipCode: '54321',
    },
    pointBalance: 5000,
    status: 'active',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
];

// 테스트용 포인트 내역 데이터
const mockPointHistory = [
  {
    userId: 'test-user-1',
    history: [
      {
        id: 'point-1',
        type: 'earn',
        amount: 5000,
        description: '신규 회원가입 적립',
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7일 전
        balanceAfter: 5000,
        expired: false,
      },
      {
        id: 'point-2',
        type: 'earn',
        amount: 3000,
        description: '주문 완료 적립 (주문 금액: 300,000원)',
        orderId: 'order-123',
        date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5일 전
        balanceAfter: 8000,
        expired: false,
      },
      {
        id: 'point-3',
        type: 'use',
        amount: 2000,
        description: '포인트 사용 (주문: order-456)',
        orderId: 'order-456',
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3일 전
        balanceAfter: 6000,
      },
      {
        id: 'point-4',
        type: 'earn',
        amount: 500,
        description: '리뷰 작성 적립 (상품: 나이키 에어맥스)',
        orderId: 'order-789',
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1일 전
        balanceAfter: 6500,
        expired: false,
      },
      {
        id: 'point-5',
        type: 'earn',
        amount: 3500,
        description: '생일 축하 포인트',
        date: new Date(), // 오늘
        balanceAfter: 10000,
        expired: false,
      }
    ]
  },
  {
    userId: 'test-user-2',
    history: [
      {
        id: 'point-6',
        type: 'earn',
        amount: 5000,
        description: '신규 회원가입 적립',
        date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10일 전
        balanceAfter: 5000,
        expired: false,
      }
    ]
  }
];

const seedUsers = async () => {
  try {
    const batch = db.batch();

    mockUsers.forEach((user) => {
      const userRef = db.collection('users').doc(user.id);
      batch.set(userRef, user);
    });

    await batch.commit();
  } catch (error) {
    console.error('❌ 사용자 추가 중 오류 발생:', error);
    throw error;
  }
};

const seedPointHistory = async () => {
  try {
    for (const userPointData of mockPointHistory) {
      const batch = db.batch();

      userPointData.history.forEach((point) => {
        const pointRef = db.collection('users').doc(userPointData.userId).collection('pointHistory').doc(point.id);
        batch.set(pointRef, point);
      });

      await batch.commit();
    }
  } catch (error) {
    console.error('❌ 포인트 내역 추가 중 오류 발생:', error);
    throw error;
  }
};

const seedUserData = async () => {
  try {
    await seedUsers();
    await seedPointHistory();
  } catch (error) {
    console.error('💥 사용자 시드 데이터 추가 중 오류 발생:', error);
    process.exit(1);
  }
};

// 스크립트 실행
seedUserData();
