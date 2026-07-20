import { getDocs } from 'firebase/firestore';
import { SiteContentService } from './siteContentService';

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, name) => ({ name })),
  doc: jest.fn((_db, collectionName, id) => ({ collectionName, id })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  orderBy: jest.fn((field, direction) => ({ field, direction })),
  query: jest.fn((collectionRef, ...constraints) => ({ collectionRef, constraints })),
  where: jest.fn((field, op, value) => ({ field, op, value })),
}));

jest.mock('@/shared/libs/firebase/firebase', () => ({
  db: {},
}));

function mockQuerySnapshot(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  return {
    docs: docs.map((item) => ({
      id: item.id,
      data: () => item.data,
    })),
  };
}

describe('SiteContentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('loads active FAQs ordered by Firestore query result', async () => {
    jest.mocked(getDocs).mockResolvedValueOnce(mockQuerySnapshot([
      {
        id: 'shipping',
        data: {
          category: '배송',
          question: '배송 기간은 얼마나 걸리나요?',
          answer: '일반 배송은 1-3영업일이 걸립니다.',
          order: 2,
          isActive: true,
        },
      },
    ]) as never);

    await expect(SiteContentService.getFaqs()).resolves.toEqual([
      {
        id: 'shipping',
        category: '배송',
        question: '배송 기간은 얼마나 걸리나요?',
        answer: '일반 배송은 1-3영업일이 걸립니다.',
        order: 2,
      },
    ]);
  });

  test('returns only active banner slides with display fields', async () => {
    jest.mocked(getDocs).mockResolvedValueOnce(mockQuerySnapshot([
      {
        id: 'sale',
        data: {
          eyebrow: '오늘 마감',
          title: '상반기 베스트 최대 60%',
          description: '인기 아이템을 강한 혜택으로 정리했습니다.',
          ctaLabel: '세일 보기',
          href: '/events/sale',
          image: '/main/sale.webp',
          backgroundColor: '#c9c0b3',
          order: 1,
          isActive: true,
        },
      },
    ]) as never);

    await expect(SiteContentService.getMainBanners()).resolves.toEqual([
      {
        id: 'sale',
        eyebrow: '오늘 마감',
        title: '상반기 베스트 최대 60%',
        description: '인기 아이템을 강한 혜택으로 정리했습니다.',
        ctaLabel: '세일 보기',
        href: '/events/sale',
        image: '/main/sale.webp',
        backgroundColor: '#c9c0b3',
        order: 1,
      },
    ]);
  });
});
