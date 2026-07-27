import { getDocs } from 'firebase/firestore';
import { getSafeInternalPath, SiteContentService } from './siteContentService';

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

  test('replaces stale known FAQ policy copy with reviewed canonical copy', async () => {
    jest.mocked(getDocs).mockResolvedValueOnce(mockQuerySnapshot([
      {
        id: 'shipping-period',
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
        id: 'shipping-period',
        category: '배송',
        question: '배송 기간은 얼마나 걸리나요?',
        answer: '확정 배송일은 약속하지 않으며 주문별 배송 상태에서 진행 상황을 확인할 수 있습니다.',
        order: 2,
      },
    ]);
  });

  test('hides unreviewed FAQ documents and allows explicitly verified copy', async () => {
    jest.mocked(getDocs).mockResolvedValueOnce(mockQuerySnapshot([
      {
        id: 'unreviewed',
        data: {
          category: '혜택',
          question: '구매 적립은 언제 받나요?',
          answer: '구매 확정 후 24시간 이내 적립됩니다.',
          order: 1,
          isActive: true,
        },
      },
      {
        id: 'reviewed',
        data: {
          category: '데모',
          question: '실제 결제가 되나요?',
          answer: '실제 결제는 진행되지 않습니다.',
          order: 2,
          isActive: true,
          publicPolicyVerified: true,
        },
      },
    ]) as never);

    await expect(SiteContentService.getFaqs()).resolves.toEqual([
      {
        id: 'reviewed',
        category: '데모',
        question: '실제 결제가 되나요?',
        answer: '실제 결제는 진행되지 않습니다.',
        order: 2,
      },
    ]);
  });

  test('hides legacy legal and fulfillment notices without a public policy gate', async () => {
    jest.mocked(getDocs).mockResolvedValueOnce(mockQuerySnapshot([
      {
        id: 'privacy-policy-2025',
        data: {
          title: '[중요] 개인정보처리방침 개정 안내',
          content: '개인정보 제3자 제공 관련 내용이 추가됩니다.',
          date: '2024-12-20',
          important: true,
          order: 1,
          isActive: true,
        },
      },
      {
        id: 'new-year-shipping-2025',
        data: {
          title: '설 연휴 배송 안내',
          content: '배송 중단과 고객센터 운영 일정입니다.',
          date: '2024-12-15',
          important: false,
          order: 2,
          isActive: true,
        },
      },
    ]) as never);

    await expect(SiteContentService.getNotices()).resolves.toEqual([]);
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

  test.each([
    'https://evil.example/path',
    '//evil.example/path',
    '/\\evil.example/path',
    'javascript:alert(1)',
    'data:text/html,unsafe',
  ])('replaces an unsafe banner path: %s', (candidate) => {
    expect(getSafeInternalPath(candidate, '/products')).toBe('/products');
  });

  test('keeps a local path with query and hash', () => {
    expect(getSafeInternalPath('/products?q=linen#results', '/products'))
      .toBe('/products?q=linen#results');
  });
});
