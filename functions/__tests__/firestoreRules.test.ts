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
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const projectId = 'hebimall-rules-test';
const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');

let testEnv: RulesTestEnvironment;

function qnaData(userId = 'owner-1') {
  return {
    userId,
    userEmail: 'owner@example.com',
    userName: '작성자',
    category: 'general',
    title: '문의 제목',
    content: '문의 내용',
    images: [],
    isSecret: true,
    status: 'waiting',
    views: 0,
    isNotified: true,
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
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
    await setDoc(doc(context.firestore(), 'qna', 'secret-qna'), qnaData());
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('QnA Firestore rules', () => {
  test('allows the owner to edit only permitted QnA content fields', async () => {
    const ownerDb = testEnv.authenticatedContext('owner-1').firestore();

    await assertSucceeds(updateDoc(doc(ownerDb, 'qna', 'secret-qna'), {
      title: '수정한 제목',
      content: '수정한 내용',
      updatedAt: '2026-07-10T01:00:00.000Z',
    }));
  });

  test.each([
    ['answer', { answer: { content: '관리자 답변' } }],
    ['status', { status: 'answered' }],
    ['views', { views: 99 }],
    ['userId', { userId: 'other-user' }],
    ['createdAt', { createdAt: '2026-07-11T00:00:00.000Z' }],
  ])('denies an owner changing server-managed %s', async (_field, change) => {
    const ownerDb = testEnv.authenticatedContext('owner-1').firestore();

    await assertFails(updateDoc(doc(ownerDb, 'qna', 'secret-qna'), change));
  });

  test('allows an admin to answer and change QnA status', async () => {
    const adminDb = testEnv.authenticatedContext('admin-1', { admin: true }).firestore();

    await assertSucceeds(updateDoc(doc(adminDb, 'qna', 'secret-qna'), {
      answer: { content: '관리자 답변' },
      status: 'answered',
      updatedAt: '2026-07-10T01:00:00.000Z',
    }));
  });

  test('denies a non-owner secret QnA read and update', async () => {
    const otherDb = testEnv.authenticatedContext('other-1').firestore();

    await assertFails(getDoc(doc(otherDb, 'qna', 'secret-qna')));
    await assertFails(updateDoc(doc(otherDb, 'qna', 'secret-qna'), {
      content: '변경 시도',
    }));
  });
});

describe('client writes to server-managed collections', () => {
  test('denies direct coupon, event, and participant writes by a signed-in user', async () => {
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
  });
});

describe('review Firestore rules', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'reviews', 'review-1'), {
        productId: 'product-1',
        userId: 'owner-1',
        userName: '작성자',
        rating: 5,
        title: '좋아요',
        content: '리뷰 내용',
        images: [],
        size: 'M',
        color: 'black',
        isRecommended: true,
        createdAt: '2026-07-10T00:00:00.000Z',
        updatedAt: '2026-07-10T00:00:00.000Z',
      });
    });
  });

  test('allows an owner to edit review content but not ownership fields', async () => {
    const ownerDb = testEnv.authenticatedContext('owner-1').firestore();

    await assertSucceeds(updateDoc(doc(ownerDb, 'reviews', 'review-1'), {
      content: '수정한 리뷰 내용',
      updatedAt: '2026-07-10T01:00:00.000Z',
    }));
    await assertFails(updateDoc(doc(ownerDb, 'reviews', 'review-1'), {
      productId: 'product-2',
    }));
    await assertFails(updateDoc(doc(ownerDb, 'reviews', 'review-1'), {
      userId: 'other-1',
    }));
  });

  test('denies direct review creation even when the user claims ownership', async () => {
    const ownerDb = testEnv.authenticatedContext('owner-1').firestore();

    await assertFails(setDoc(doc(ownerDb, 'reviews', 'forged-review'), {
      productId: 'product-1',
      userId: 'owner-1',
      userName: '작성자',
      rating: 5,
      title: '임의 작성',
      content: '주문 검증 없는 리뷰',
      images: [],
      size: 'M',
      color: 'black',
      isRecommended: true,
      createdAt: '2026-07-10T00:00:00.000Z',
      updatedAt: '2026-07-10T00:00:00.000Z',
    }));
  });
});
