import {
  getCountFromServer,
  getDocs,
} from 'firebase/firestore';
import { QnAService } from './qnaService';

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: null })),
}));

jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn(),
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

function timestamp(date: string) {
  return { toDate: () => new Date(date) };
}

function makeQnADoc(id: string) {
  return {
    id,
    data: () => ({
      userId: 'user-1',
      userEmail: 'user@example.com',
      userName: '사용자',
      category: 'product',
      title: '문의',
      content: '내용',
      images: [],
      isSecret: false,
      status: 'waiting',
      views: 0,
      isNotified: false,
      createdAt: timestamp('2026-01-01T00:00:00.000Z'),
      updatedAt: timestamp('2026-01-01T00:00:00.000Z'),
    }),
  };
}

describe('QnAService.getQnAList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('uses the same filters when probing the previous page cursor', async () => {
    jest.mocked(getCountFromServer).mockResolvedValue({
      data: () => ({ count: 25 }),
    } as unknown as Awaited<ReturnType<typeof getCountFromServer>>);
    jest
      .mocked(getDocs)
      .mockResolvedValueOnce({
        docs: Array.from({ length: 10 }, (_, index) => makeQnADoc(`cursor-${index}`)),
      } as unknown as Awaited<ReturnType<typeof getDocs>>)
      .mockResolvedValueOnce({
        docs: [makeQnADoc('qna-11')],
      } as unknown as Awaited<ReturnType<typeof getDocs>>);

    await QnAService.getQnAList({ status: 'waiting' }, 2, 10);

    const previousPageQuery = jest.mocked(getDocs).mock.calls[0][0];
    expect(JSON.stringify(previousPageQuery)).toContain('"field":"status"');
    expect(JSON.stringify(previousPageQuery)).toContain('"value":"waiting"');
  });
});
