import {
  parsePublicQnAListRequest,
  toSafeQnA,
} from '../src/domain/qnaDomain';

describe('qna domain logic', () => {
  test('safe QnA response omits password material', () => {
    const safe = toSafeQnA('qna-1', {
      userId: 'user-1',
      userEmail: 'u@example.com',
      userName: '홍길동',
      category: 'product',
      title: '문의',
      content: '내용',
      isSecret: true,
      status: 'waiting',
      views: 3,
      isNotified: false,
      createdAt: { toDate: () => new Date('2026-05-11T00:00:00.000Z') },
      updatedAt: { toDate: () => new Date('2026-05-11T01:00:00.000Z') },
      passwordHash: 'hash',
      passwordSalt: 'salt',
      password: '1234',
    });

    expect(safe).toMatchObject({
      id: 'qna-1',
      title: '문의',
      userName: '홍**',
      isSecret: true,
      createdAt: '2026-05-11T00:00:00.000Z',
      updatedAt: '2026-05-11T01:00:00.000Z',
    });
    expect(safe).not.toHaveProperty('passwordHash');
    expect(safe).not.toHaveProperty('passwordSalt');
    expect(safe).not.toHaveProperty('password');
    expect(safe).not.toHaveProperty('userEmail');
    expect(safe).not.toHaveProperty('userId');
    expect(safe).not.toHaveProperty('isNotified');
  });

  test.each(['김', '홍 길동', '   ', 123])(
    'uses a generic public author name for unsafe input %p',
    (userName) => {
      expect(toSafeQnA('qna-1', { userName }).userName).toBe('사용자');
    }
  );

  test('replaces legacy answer author identity with a public role label', () => {
    const safe = toSafeQnA('qna-1', {
      answer: {
        content: '답변',
        answeredBy: 'admin@example.com',
        answeredAt: { toDate: () => new Date('2026-07-20T00:00:00.000Z') },
        isAdmin: true,
      },
    });

    expect(safe.answer?.answeredBy).toBe('관리자');
    expect(safe.answer?.answeredBy).not.toContain('@');
  });

  test('accepts one whitelisted public filter with bounded pagination', () => {
    expect(parsePublicQnAListRequest({
      filters: { category: 'product' },
      page: 2,
      limit: 25,
    })).toEqual({
      filters: { category: 'product' },
      page: 2,
      limit: 25,
    });
  });

  test.each([undefined, null])('treats legacy isSecret=%s as protected', (isSecret) => {
    const safe = toSafeQnA('legacy-qna', {
      userName: 'legacy owner',
      category: 'general',
      title: 'legacy',
      content: 'legacy content',
      isSecret,
      status: 'waiting',
      views: 0,
    });

    expect(safe.isSecret).toBe(true);
  });

  test.each([
    [{ filters: { category: 'admin' }, page: 1, limit: 10 }],
    [{ filters: { productId: '../users' }, page: 1, limit: 10 }],
    [{ filters: { category: 'product', status: 'waiting' }, page: 1, limit: 10 }],
    [{ filters: { userId: 'owner-1' }, page: 1, limit: 10 }],
    [{ filters: {}, page: 0, limit: 10 }],
    [{ filters: {}, page: 1, limit: 51 }],
  ])('rejects an invalid public list request %#', (input) => {
    expect(parsePublicQnAListRequest(input)).toBeNull();
  });
});
