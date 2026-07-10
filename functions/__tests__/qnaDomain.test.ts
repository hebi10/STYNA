import { toSafeQnA } from '../src/domain/qnaDomain';

describe('qna domain logic', () => {
  test('safe QnA response omits password material', () => {
    const safe = toSafeQnA('qna-1', {
      userId: 'user-1',
      userEmail: 'u@example.com',
      userName: '사용자',
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
      isSecret: true,
      createdAt: '2026-05-11T00:00:00.000Z',
      updatedAt: '2026-05-11T01:00:00.000Z',
    });
    expect(safe).not.toHaveProperty('passwordHash');
    expect(safe).not.toHaveProperty('passwordSalt');
    expect(safe).not.toHaveProperty('password');
  });
});
