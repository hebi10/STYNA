/**
 * @jest-environment node
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setLogLevel,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

const projectId = 'demo-hebimall-rules-test';
const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');
const fixedTime = Timestamp.fromDate(new Date('2026-07-20T00:00:00.000Z'));

let testEnv: RulesTestEnvironment;

setLogLevel('silent');

type AccountStatus = 'active' | 'inactive' | 'banned' | 'deleted';
type AccountRole = 'user' | 'admin';

function userData(
  userId: string,
  status: AccountStatus = 'active',
  role: AccountRole = 'user'
) {
  return {
    id: userId,
    email: `${userId}@example.com`,
    name: `${userId} name`,
    status,
    role,
    createdAt: fixedTime,
    updatedAt: fixedTime,
  };
}

function signupUserData(userId = 'new-user') {
  return {
    id: userId,
    email: 'new-user@example.com',
    name: '신규 사용자',
    phone: '010-1234-5678',
    birth: {
      year: '1990',
      month: '7',
      day: '20',
    },
    gender: 'female',
    termsAgree: true,
    privacyAgree: true,
    marketingAgree: false,
    status: 'active',
    role: 'user',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function qnaData(userId = 'owner-1', isSecret = true) {
  return {
    userId,
    userEmail: `${userId}@example.com`,
    userName: `${userId} name`,
    category: 'general',
    title: '문의 제목',
    content: '문의 내용',
    images: [],
    isSecret,
    status: 'waiting',
    views: 0,
    isNotified: true,
    createdAt: fixedTime,
    updatedAt: fixedTime,
  };
}

function validQnACreate(userId = 'owner-1') {
  return {
    userId,
    userEmail: `${userId}@example.com`,
    userName: `${userId} name`,
    category: 'product',
    title: '새 문의',
    content: '새 문의 내용',
    images: [],
    isSecret: false,
    status: 'waiting',
    views: 0,
    isNotified: false,
    productId: 'product-1',
    productName: '테스트 상품',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function inquiryData(userId = 'owner-1') {
  return {
    userId,
    userEmail: `${userId}@example.com`,
    userName: `${userId} name`,
    category: 'order',
    title: '일반 문의',
    content: '문의 내용',
    status: 'waiting',
    createdAt: fixedTime,
    updatedAt: fixedTime,
  };
}

function validInquiryCreate(userId = 'owner-1') {
  return {
    ...inquiryData(userId),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'users', 'owner-1'), userData('owner-1')),
      setDoc(doc(db, 'users', 'user-1'), userData('user-1')),
      setDoc(doc(db, 'users', 'inactive-1'), userData('inactive-1', 'inactive')),
      setDoc(doc(db, 'users', 'banned-1'), userData('banned-1', 'banned')),
      setDoc(doc(db, 'users', 'deleted-1'), userData('deleted-1', 'deleted')),
      setDoc(doc(db, 'users', 'admin-1'), userData('admin-1', 'active', 'admin')),
      setDoc(doc(db, 'users', 'admin-role-token'), userData('admin-role-token', 'active', 'admin')),
      setDoc(doc(db, 'users', 'claim-only'), userData('claim-only')),
      setDoc(doc(db, 'users', 'role-only'), userData('role-only', 'active', 'admin')),
      setDoc(doc(db, 'users', 'inactive-admin'), userData('inactive-admin', 'inactive', 'admin')),
      setDoc(doc(db, 'qna', 'secret-qna'), qnaData()),
      setDoc(doc(db, 'qna', 'public-qna'), qnaData('owner-1', false)),
      setDoc(doc(db, 'inquiries', 'inquiry-1'), inquiryData()),
      setDoc(doc(db, 'orders', 'order-1'), {
        userId: 'owner-1',
        status: 'pending',
        createdAt: fixedTime,
      }),
      setDoc(doc(db, 'featuredProducts', 'mainPageFeatured'), {
        productIds: ['product-1'],
      }),
      setDoc(doc(db, 'reviews', 'review-1'), {
        productId: 'product-1',
        userId: 'owner-1',
        userName: 'owner-1 name',
        rating: 5,
        title: '좋아요',
        content: '리뷰 내용',
        images: [],
        size: 'M',
        color: 'black',
        isRecommended: true,
        createdAt: fixedTime,
        updatedAt: fixedTime,
      }),
    ]);
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('self signup and profile rules', () => {
  test('allows only an exact active/user bootstrap with request timestamps', async () => {
    const userDb = testEnv.authenticatedContext('new-user', {
      email: 'new-user@example.com',
    }).firestore();

    await assertSucceeds(setDoc(doc(userDb, 'users', 'new-user'), signupUserData()));
  });

  test.each([
    ['admin role', { role: 'admin' }],
    ['inactive status', { status: 'inactive' }],
    ['banned status', { status: 'banned' }],
    ['deleted status', { status: 'deleted' }],
    ['arbitrary field', { unexpectedAccess: true }],
    ['arbitrary createdAt', { createdAt: fixedTime }],
    ['arbitrary updatedAt', { updatedAt: fixedTime }],
  ])('denies signup with %s', async (_caseName, override) => {
    const userDb = testEnv.authenticatedContext('new-user', {
      email: 'new-user@example.com',
    }).firestore();

    await assertFails(setDoc(doc(userDb, 'users', 'new-user'), {
      ...signupUserData(),
      ...override,
    }));
  });

  test.each(['status', 'role', 'createdAt', 'updatedAt'])(
    'denies signup missing required %s',
    async (field) => {
      const userDb = testEnv.authenticatedContext('new-user', {
        email: 'new-user@example.com',
      }).firestore();
      const profile = signupUserData() as Record<string, unknown>;
      delete profile[field];

      await assertFails(setDoc(doc(userDb, 'users', 'new-user'), profile));
    }
  );

  test('allows an active owner to update profile fields with request.time', async () => {
    const ownerDb = testEnv.authenticatedContext('owner-1', {
      email: 'owner-1@example.com',
    }).firestore();

    await assertSucceeds(updateDoc(doc(ownerDb, 'users', 'owner-1'), {
      name: '수정한 이름',
      updatedAt: serverTimestamp(),
    }));
  });

  test('binds signup and profile email to the authenticated email claim', async () => {
    const signupDb = testEnv.authenticatedContext('new-user', {
      email: 'auth@example.com',
    }).firestore();
    const refreshedOwnerDb = testEnv.authenticatedContext('owner-1', {
      email: 'changed@example.com',
    }).firestore();

    await assertFails(setDoc(doc(signupDb, 'users', 'new-user'), {
      ...signupUserData(),
      email: 'forged@example.com',
    }));
    await assertSucceeds(updateDoc(doc(refreshedOwnerDb, 'users', 'owner-1'), {
      email: 'changed@example.com',
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(refreshedOwnerDb, 'users', 'owner-1'), {
      email: 'forged@example.com',
      updatedAt: serverTimestamp(),
    }));
  });

  test.each([
    ['name', { name: 123 }],
    ['email', { email: { value: 'owner-1@example.com' } }],
  ])('denies a non-string profile %s', async (_field, change) => {
    const ownerDb = testEnv.authenticatedContext('owner-1', {
      email: 'owner-1@example.com',
    }).firestore();

    await assertFails(updateDoc(doc(ownerDb, 'users', 'owner-1'), {
      ...change,
      updatedAt: serverTimestamp(),
    }));
  });

  test.each([
    ['status', { status: 'banned', updatedAt: serverTimestamp() }],
    ['role', { role: 'admin', updatedAt: serverTimestamp() }],
    ['createdAt', { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }],
    ['arbitrary updatedAt', { name: '변경', updatedAt: fixedTime }],
  ])('denies owner profile changes to %s', async (_field, change) => {
    const ownerDb = testEnv.authenticatedContext('owner-1', {
      email: 'owner-1@example.com',
    }).firestore();

    await assertFails(updateDoc(doc(ownerDb, 'users', 'owner-1'), change));
  });

  test('preserves self-read so a blocked user can inspect account status', async () => {
    const inactiveDb = testEnv.authenticatedContext('inactive-1').firestore();

    await assertSucceeds(getDoc(doc(inactiveDb, 'users', 'inactive-1')));
  });
});

describe('active account write boundary', () => {
  test('allows active owners to write cart, nested/root wishlist, and recent products', async () => {
    const ownerDb = testEnv.authenticatedContext('owner-1').firestore();

    await assertSucceeds(setDoc(doc(ownerDb, 'carts', 'owner-1'), { items: [] }));
    await assertSucceeds(setDoc(doc(ownerDb, 'users', 'owner-1', 'wishlist', 'product-1'), {
      productId: 'product-1',
    }));
    await assertSucceeds(setDoc(doc(ownerDb, 'users', 'owner-1', 'recentProducts', 'product-1'), {
      productId: 'product-1',
    }));
    await assertSucceeds(setDoc(doc(ownerDb, 'userWishlist', 'owner_product-1'), {
      userId: 'owner-1',
      productId: 'product-1',
    }));
    await assertSucceeds(setDoc(doc(ownerDb, 'userRecentProducts', 'owner_product-1'), {
      userId: 'owner-1',
      productId: 'product-1',
    }));
  });

  test.each(['inactive-1', 'banned-1', 'deleted-1', 'missing-1'])(
    'denies all user writes when account %s is not active',
    async (userId) => {
      const userDb = testEnv.authenticatedContext(userId).firestore();

      await assertFails(updateDoc(doc(userDb, 'users', userId), {
        name: '차단된 변경',
        updatedAt: serverTimestamp(),
      }));
      await assertFails(setDoc(doc(userDb, 'carts', userId), { items: [] }));
      await assertFails(setDoc(doc(userDb, 'users', userId, 'wishlist', 'product-1'), {
        productId: 'product-1',
      }));
      await assertFails(setDoc(doc(userDb, 'users', userId, 'recentProducts', 'product-1'), {
        productId: 'product-1',
      }));
      await assertFails(setDoc(doc(userDb, 'userWishlist', `${userId}_product-1`), {
        userId,
        productId: 'product-1',
      }));
      await assertFails(setDoc(doc(userDb, 'userRecentProducts', `${userId}_product-1`), {
        userId,
        productId: 'product-1',
      }));
      await assertFails(addDoc(collection(userDb, 'qna'), validQnACreate(userId)));
      await assertFails(addDoc(collection(userDb, 'inquiries'), validInquiryCreate(userId)));
    }
  );
});

describe('strict admin boundary', () => {
  test('allows claim plus active admin document to manage public content', async () => {
    const adminDb = testEnv.authenticatedContext('admin-1', { admin: true }).firestore();

    for (const collectionName of ['categories', 'products', 'notices', 'featuredProducts']) {
      await assertSucceeds(setDoc(doc(adminDb, collectionName, `strict-${collectionName}`), {
        name: collectionName,
      }));
    }
  });

  test('accepts the role claim only when the active user document is also admin', async () => {
    const adminDb = testEnv.authenticatedContext('admin-role-token', { role: 'admin' }).firestore();

    await assertSucceeds(setDoc(doc(adminDb, 'featuredProducts', 'role-token'), {
      productIds: ['product-2'],
    }));
  });

  test.each([
    ['claim-only', 'claim-only', { admin: true }],
    ['role-only', 'role-only', {}],
    ['inactive admin', 'inactive-admin', { admin: true }],
    ['missing admin document', 'missing-admin', { admin: true }],
  ])('denies %s public content writes', async (_caseName, userId, claims) => {
    const adminDb = testEnv.authenticatedContext(userId, claims).firestore();

    await assertFails(setDoc(doc(adminDb, 'featuredProducts', `denied-${userId}`), {
      productIds: ['product-2'],
    }));
  });

  test('keeps public reads for featured content', async () => {
    const publicDb = testEnv.unauthenticatedContext().firestore();

    await assertSucceeds(getDoc(doc(publicDb, 'featuredProducts', 'mainPageFeatured')));
  });
});

describe('server-managed users and orders', () => {
  test('denies direct user lifecycle writes even from a strict admin browser', async () => {
    const adminDb = testEnv.authenticatedContext('admin-1', { admin: true }).firestore();

    await assertFails(setDoc(doc(adminDb, 'users', 'admin-created-user'), userData('admin-created-user')));
    await assertFails(updateDoc(doc(adminDb, 'users', 'owner-1'), {
      status: 'banned',
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(adminDb, 'users', 'owner-1'), {
      role: 'admin',
      updatedAt: serverTimestamp(),
    }));
    await assertFails(deleteDoc(doc(adminDb, 'users', 'owner-1')));
  });

  test('denies every direct order mutation, including strict admin writes', async () => {
    const ownerDb = testEnv.authenticatedContext('owner-1').firestore();
    const adminDb = testEnv.authenticatedContext('admin-1', { admin: true }).firestore();

    await assertFails(setDoc(doc(ownerDb, 'orders', 'forged-order'), {
      userId: 'owner-1',
      status: 'paid',
    }));
    await assertFails(setDoc(doc(adminDb, 'orders', 'admin-order'), {
      userId: 'owner-1',
      status: 'paid',
    }));
    await assertFails(updateDoc(doc(adminDb, 'orders', 'order-1'), { status: 'delivered' }));
    await assertFails(deleteDoc(doc(adminDb, 'orders', 'order-1')));
  });

  test('allows only an active owner or strict admin to read an order', async () => {
    const ownerDb = testEnv.authenticatedContext('owner-1').firestore();
    const adminDb = testEnv.authenticatedContext('admin-1', { admin: true }).firestore();
    const inactiveDb = testEnv.authenticatedContext('inactive-1').firestore();
    const claimOnlyDb = testEnv.authenticatedContext('claim-only', { admin: true }).firestore();

    await assertSucceeds(getDoc(doc(ownerDb, 'orders', 'order-1')));
    await assertSucceeds(getDoc(doc(adminDb, 'orders', 'order-1')));
    await assertFails(getDoc(doc(inactiveDb, 'orders', 'order-1')));
    await assertFails(getDoc(doc(claimOnlyDb, 'orders', 'order-1')));
  });
});

describe('QnA rules', () => {
  test('allows an active user to create the exact QnA client schema', async () => {
    const ownerDb = testEnv.authenticatedContext('owner-1', {
      email: 'owner-1@example.com',
    }).firestore();

    await assertSucceeds(addDoc(collection(ownerDb, 'qna'), validQnACreate()));
  });

  test.each([
    ['userId', { userId: 'other-1' }],
    ['userEmail', { userEmail: 'forged@example.com' }],
    ['userName', { userName: '위조 작성자' }],
    ['status', { status: 'answered' }],
    ['views', { views: 1 }],
    ['answer', { answer: { content: '선답변' } }],
    ['password', { password: 'plaintext' }],
    ['createdAt', { createdAt: fixedTime }],
    ['updatedAt', { updatedAt: fixedTime }],
    ['productId type', { productId: { id: 'product-1' } }],
    ['productName type', { productName: ['product'] }],
    ['extra key', { privileged: true }],
  ])('denies QnA creation with forged/server-managed %s', async (_field, override) => {
    const ownerDb = testEnv.authenticatedContext('owner-1', {
      email: 'owner-1@example.com',
    }).firestore();

    await assertFails(addDoc(collection(ownerDb, 'qna'), {
      ...validQnACreate(),
      ...override,
    }));
  });

  test('denies QnA creation when the user document email differs from the Auth token', async () => {
    const mismatchedDb = testEnv.authenticatedContext('owner-1', {
      email: 'different@example.com',
    }).firestore();

    await assertFails(addDoc(collection(mismatchedDb, 'qna'), validQnACreate()));
  });

  test('allows the active owner to edit content or soft-close with request.time', async () => {
    const ownerDb = testEnv.authenticatedContext('owner-1').firestore();

    await assertSucceeds(updateDoc(doc(ownerDb, 'qna', 'secret-qna'), {
      title: '수정한 제목',
      content: '수정한 내용',
      updatedAt: serverTimestamp(),
    }));
    await assertSucceeds(updateDoc(doc(ownerDb, 'qna', 'secret-qna'), {
      status: 'closed',
      updatedAt: serverTimestamp(),
    }));
  });

  test.each([
    ['answer', { answer: { content: '관리자 답변' }, updatedAt: serverTimestamp() }],
    ['answered status', { status: 'answered', updatedAt: serverTimestamp() }],
    ['views', { views: 99, updatedAt: serverTimestamp() }],
    ['userId', { userId: 'other-user', updatedAt: serverTimestamp() }],
    ['userEmail', { userEmail: 'other@example.com', updatedAt: serverTimestamp() }],
    ['createdAt', { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }],
    ['arbitrary updatedAt', { content: '변경', updatedAt: fixedTime }],
  ])('denies an owner changing QnA %s', async (_field, change) => {
    const ownerDb = testEnv.authenticatedContext('owner-1').firestore();

    await assertFails(updateDoc(doc(ownerDb, 'qna', 'secret-qna'), change));
  });

  test.each([
    ['title type', { title: 123 }],
    ['content type', { content: { text: 'invalid' } }],
    ['category enum', { category: 'privileged' }],
    ['images type', { images: { url: '/invalid.png' } }],
    ['secret type', { isSecret: 'false' }],
    ['notification type', { isNotified: 'true' }],
  ])('denies an owner update with an invalid QnA %s', async (_field, change) => {
    const ownerDb = testEnv.authenticatedContext('owner-1').firestore();

    await assertFails(updateDoc(doc(ownerDb, 'qna', 'secret-qna'), {
      ...change,
      updatedAt: serverTimestamp(),
    }));
  });

  test('allows a strict admin to change only answer management fields', async () => {
    const adminDb = testEnv.authenticatedContext('admin-1', { admin: true }).firestore();

    await assertSucceeds(updateDoc(doc(adminDb, 'qna', 'secret-qna'), {
      answer: {
        content: '관리자 답변',
        answeredBy: 'admin-1',
        answeredAt: serverTimestamp(),
        isAdmin: true,
      },
      status: 'answered',
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(adminDb, 'qna', 'secret-qna'), {
      title: '관리자 본문 위조',
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(adminDb, 'qna', 'secret-qna'), {
      userId: 'admin-1',
      updatedAt: serverTimestamp(),
    }));
  });

  test.each([
    ['non-map answer', { answer: 'invalid' }],
    ['missing answer fields', { answer: { content: '답변' } }],
    ['arbitrary answer time', {
      answer: {
        content: '답변',
        answeredBy: 'admin-1',
        answeredAt: fixedTime,
        isAdmin: true,
      },
    }],
    ['false admin marker', {
      answer: {
        content: '답변',
        answeredBy: 'admin-1',
        answeredAt: serverTimestamp(),
        isAdmin: false,
      },
    }],
    ['extra answer field', {
      answer: {
        content: '답변',
        answeredBy: 'admin-1',
        answeredAt: serverTimestamp(),
        isAdmin: true,
        internal: true,
      },
    }],
  ])('denies an invalid admin QnA %s', async (_caseName, change) => {
    const adminDb = testEnv.authenticatedContext('admin-1', { admin: true }).firestore();

    await assertFails(updateDoc(doc(adminDb, 'qna', 'secret-qna'), {
      ...change,
      updatedAt: serverTimestamp(),
    }));
  });

  test.each([
    ['claim-only', 'claim-only', { admin: true }],
    ['role-only', 'role-only', {}],
    ['inactive admin', 'inactive-admin', { admin: true }],
  ])('denies %s QnA answer writes', async (_caseName, userId, claims) => {
    const adminDb = testEnv.authenticatedContext(userId, claims).firestore();

    await assertFails(updateDoc(doc(adminDb, 'qna', 'secret-qna'), {
      answer: { content: '권한 없는 답변' },
      status: 'answered',
      updatedAt: serverTimestamp(),
    }));
  });

  test('allows direct QnA reads only to an active owner or strict admin', async () => {
    const publicDb = testEnv.unauthenticatedContext().firestore();
    const ownerDb = testEnv.authenticatedContext('owner-1').firestore();
    const otherDb = testEnv.authenticatedContext('user-1').firestore();
    const inactiveOwnerDb = testEnv.authenticatedContext('inactive-1').firestore();
    const adminDb = testEnv.authenticatedContext('admin-1', { admin: true }).firestore();

    await assertFails(getDoc(doc(publicDb, 'qna', 'public-qna')));
    await assertFails(getDocs(query(
      collection(publicDb, 'qna'),
      where('isSecret', '==', false)
    )));
    await assertFails(getDocs(collection(publicDb, 'qna')));
    await assertSucceeds(getDoc(doc(ownerDb, 'qna', 'public-qna')));
    await assertSucceeds(getDoc(doc(ownerDb, 'qna', 'secret-qna')));
    await assertSucceeds(getDoc(doc(adminDb, 'qna', 'public-qna')));
    await assertSucceeds(getDocs(query(
      collection(ownerDb, 'qna'),
      where('userId', '==', 'owner-1'),
      orderBy('createdAt', 'desc')
    )));
    await assertSucceeds(getDocs(query(
      collection(adminDb, 'qna'),
      orderBy('createdAt', 'desc')
    )));
    await assertFails(getDoc(doc(otherDb, 'qna', 'secret-qna')));
    await assertFails(getDoc(doc(inactiveOwnerDb, 'qna', 'secret-qna')));
  });

  test('denies hard deletion even to a strict admin', async () => {
    const adminDb = testEnv.authenticatedContext('admin-1', { admin: true }).firestore();

    await assertFails(deleteDoc(doc(adminDb, 'qna', 'secret-qna')));
  });
});

describe('inquiry rules', () => {
  test('allows an active user to create the exact inquiry client schema', async () => {
    const ownerDb = testEnv.authenticatedContext('owner-1', {
      email: 'owner-1@example.com',
    }).firestore();

    await assertSucceeds(addDoc(collection(ownerDb, 'inquiries'), validInquiryCreate()));
  });

  test.each([
    ['userId', { userId: 'other-1' }],
    ['userEmail', { userEmail: 'forged@example.com' }],
    ['userName', { userName: '위조 작성자' }],
    ['status', { status: 'answered' }],
    ['answer', { answer: { content: '선답변' } }],
    ['createdAt', { createdAt: fixedTime }],
    ['updatedAt', { updatedAt: fixedTime }],
    ['extra key', { privileged: true }],
  ])('denies inquiry creation with forged/server-managed %s', async (_field, override) => {
    const ownerDb = testEnv.authenticatedContext('owner-1', {
      email: 'owner-1@example.com',
    }).firestore();

    await assertFails(addDoc(collection(ownerDb, 'inquiries'), {
      ...validInquiryCreate(),
      ...override,
    }));
  });

  test('denies inquiry creation when the user document email differs from the Auth token', async () => {
    const mismatchedDb = testEnv.authenticatedContext('owner-1', {
      email: 'different@example.com',
    }).firestore();

    await assertFails(addDoc(collection(mismatchedDb, 'inquiries'), validInquiryCreate()));
  });

  test('allows only strict admin management-field updates', async () => {
    const ownerDb = testEnv.authenticatedContext('owner-1').firestore();
    const adminDb = testEnv.authenticatedContext('admin-1', { admin: true }).firestore();

    await assertSucceeds(updateDoc(doc(adminDb, 'inquiries', 'inquiry-1'), {
      answer: {
        content: '관리자 답변',
        answeredBy: 'admin-1',
        answeredAt: serverTimestamp(),
      },
      status: 'answered',
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(adminDb, 'inquiries', 'inquiry-1'), {
      content: '관리자가 본문 변경',
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(ownerDb, 'inquiries', 'inquiry-1'), {
      content: '작성자가 본문 변경',
      updatedAt: serverTimestamp(),
    }));
  });

  test.each([
    ['non-map answer', { answer: 'invalid' }],
    ['missing answer fields', { answer: { content: '답변' } }],
    ['arbitrary answer time', {
      answer: {
        content: '답변',
        answeredBy: 'admin-1',
        answeredAt: fixedTime,
      },
    }],
    ['extra answer field', {
      answer: {
        content: '답변',
        answeredBy: 'admin-1',
        answeredAt: serverTimestamp(),
        internal: true,
      },
    }],
  ])('denies an invalid admin inquiry %s', async (_caseName, change) => {
    const adminDb = testEnv.authenticatedContext('admin-1', { admin: true }).firestore();

    await assertFails(updateDoc(doc(adminDb, 'inquiries', 'inquiry-1'), {
      ...change,
      updatedAt: serverTimestamp(),
    }));
  });

  test.each([
    ['claim-only', 'claim-only', { admin: true }],
    ['role-only', 'role-only', {}],
    ['inactive admin', 'inactive-admin', { admin: true }],
  ])('denies %s inquiry answer writes', async (_caseName, userId, claims) => {
    const adminDb = testEnv.authenticatedContext(userId, claims).firestore();

    await assertFails(updateDoc(doc(adminDb, 'inquiries', 'inquiry-1'), {
      answer: { content: '권한 없는 답변' },
      status: 'answered',
      updatedAt: serverTimestamp(),
    }));
  });

  test('allows an active owner or strict admin to read an inquiry', async () => {
    const ownerDb = testEnv.authenticatedContext('owner-1').firestore();
    const adminDb = testEnv.authenticatedContext('admin-1', { admin: true }).firestore();
    const inactiveDb = testEnv.authenticatedContext('inactive-1').firestore();

    await assertSucceeds(getDoc(doc(ownerDb, 'inquiries', 'inquiry-1')));
    await assertSucceeds(getDoc(doc(adminDb, 'inquiries', 'inquiry-1')));
    await assertFails(getDoc(doc(inactiveDb, 'inquiries', 'inquiry-1')));
  });
});

describe('other server-managed collections', () => {
  test('denies direct coupon, event, participant, and review creation by a user', async () => {
    const userDb = testEnv.authenticatedContext('user-1').firestore();

    await assertFails(setDoc(doc(userDb, 'user_coupons', 'coupon-1'), {
      uid: 'user-1',
      couponId: 'coupon-1',
      status: '사용가능',
    }));
    await assertFails(updateDoc(doc(userDb, 'events', 'event-1'), {
      participantCount: 1,
    }));
    await assertFails(setDoc(doc(userDb, 'eventParticipants', 'event-1_user-1'), {
      eventId: 'event-1',
      userId: 'user-1',
    }));
    await assertFails(setDoc(doc(userDb, 'reviews', 'forged-review'), {
      productId: 'product-1',
      userId: 'user-1',
      content: '주문 검증 없는 리뷰',
    }));
  });

  test('allows only an active review owner to edit permitted fields', async () => {
    const ownerDb = testEnv.authenticatedContext('owner-1').firestore();
    const inactiveDb = testEnv.authenticatedContext('inactive-1').firestore();

    await assertSucceeds(updateDoc(doc(ownerDb, 'reviews', 'review-1'), {
      content: '수정한 리뷰 내용',
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(ownerDb, 'reviews', 'review-1'), {
      productId: 'product-2',
    }));
    await assertFails(updateDoc(doc(inactiveDb, 'reviews', 'review-1'), {
      content: '비활성 계정 변경',
    }));
  });
});
