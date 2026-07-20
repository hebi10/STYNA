import { readFileSync } from 'fs';
import { resolve } from 'path';
import { QnAService } from './qnaService';

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: null })),
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((db, name) => ({ kind: 'collection', name })),
  doc: jest.fn(),
  getCountFromServer: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  increment: jest.fn((value) => ({ type: 'increment', value })),
  limit: jest.fn((count) => ({ type: 'limit', count })),
  orderBy: jest.fn((field, direction) => ({ type: 'orderBy', field, direction })),
  query: jest.fn((...args) => ({ kind: 'query', args })),
  serverTimestamp: jest.fn(() => ({ kind: 'serverTimestamp' })),
  startAfter: jest.fn((cursor) => ({ type: 'startAfter', cursor })),
  Timestamp: jest.fn(),
  updateDoc: jest.fn(),
  where: jest.fn((field, op, value) => ({ type: 'where', field, op, value })),
}));

jest.mock('@/shared/libs/firebase/firebase', () => ({
  db: {},
}));

describe('QnAService public access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('loads public QnAs through the server projection endpoint', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        qnas: [{
          id: 'qna-1',
          userId: 'owner-1',
          userEmail: 'owner@example.com',
          userName: 'owner name',
          category: 'product',
          title: '문의',
          content: '내용',
          images: [],
          isSecret: false,
          status: 'waiting',
          views: 0,
          isNotified: true,
          internalNote: 'must not cross the client boundary',
          createdAt: '2026-07-20T00:00:00.000Z',
          updatedAt: '2026-07-20T00:00:00.000Z',
        }],
        pagination: { page: 2, limit: 10, totalCount: 11, totalPages: 2 },
      }),
    }) as jest.Mock;

    const result = await QnAService.getQnAList(
      { status: 'waiting' },
      2,
      10
    );

    expect(global.fetch).toHaveBeenCalledWith('/api/qna/public', expect.objectContaining({
      method: 'POST',
      cache: 'no-store',
      body: JSON.stringify({
        action: 'publicList',
        filters: { status: 'waiting' },
        page: 2,
        limit: 10,
      }),
    }));
    expect(result.qnas[0].createdAt).toEqual(new Date('2026-07-20T00:00:00.000Z'));
    expect(result.qnas[0]).not.toHaveProperty('userId');
    expect(result.qnas[0]).not.toHaveProperty('userEmail');
    expect(result.qnas[0]).not.toHaveProperty('isNotified');
    expect(result.qnas[0]).not.toHaveProperty('internalNote');
    expect(result.pagination.totalCount).toBe(11);
  });

  test.each([
    [{ isSecret: true }],
    [{ userId: 'owner-1' }],
  ])('rejects a private filter at the public service boundary: %p', async (filters) => {
    global.fetch = jest.fn();

    await expect(QnAService.getQnAList(filters as never)).rejects.toThrow(
      'Public QnA queries do not accept private filters.'
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('QnA public query indexes', () => {
  test.each([
    ['category', ['category', 'isSecret', 'createdAt']],
    ['product', ['productId', 'isSecret', 'createdAt']],
    ['status', ['status', 'isSecret', 'createdAt']],
  ])('declares the %s plus visibility composite index', (_queryName, expectedFields) => {
    const indexConfig = JSON.parse(
      readFileSync(resolve(process.cwd(), 'firestore.indexes.json'), 'utf8')
    ) as {
      indexes: Array<{
        collectionGroup: string;
        queryScope: string;
        fields: Array<{ fieldPath: string }>;
      }>;
    };
    const qnaIndexFields = indexConfig.indexes
      .filter((index) => index.collectionGroup === 'qna' && index.queryScope === 'COLLECTION')
      .map((index) => index.fields.map((field) => field.fieldPath));

    expect(qnaIndexFields).toContainEqual(expectedFields);
  });
});
