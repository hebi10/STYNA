import { buildHeaderNavGroups, getHeaderNavHref } from './navigation';

describe('buildHeaderNavGroups', () => {
  test('keeps six first-level SHOP destinations and nests active categories', () => {
    const groups = buildHeaderNavGroups([
      { id: 'bags', name: '가방', href: '/categories/bags' },
    ]);

    expect(groups.map((group) => group.label)).toEqual([
      'SHOP',
      '추천',
      '이벤트',
      '리뷰',
      '고객지원',
    ]);
    expect(groups[0].items).toEqual([
      { label: '전체 상품', href: '/products' },
      {
        id: 'categories',
        label: '카테고리',
        items: [
          { label: '카테고리 전체 보기', href: '/categories' },
          { label: '가방', href: '/categories/bags' },
        ],
      },
      { label: '신상', href: '/recommend?filter=new' },
      { label: '베스트', href: '/recommend?filter=review' },
      { label: '세일', href: '/main/sale' },
      { label: '브랜드', href: '/brand' },
    ]);
    expect(groups.slice(1)).toEqual([
      { id: 'recommend', label: '추천', href: '/recommend', items: [] },
      { id: 'events', label: '이벤트', href: '/events', items: [] },
      { id: 'reviews', label: '리뷰', href: '/reviews', items: [] },
      {
        id: 'support',
        label: '고객지원',
        items: [
          { label: 'FAQ', href: '/cs/faq' },
          { label: '1:1문의', href: '/cs/inquiry' },
          { label: '상품문의', href: '/qna' },
        ],
      },
    ]);
  });

  test('keeps the category hub without guessed details before categories load', () => {
    const [shop] = buildHeaderNavGroups([]);

    expect(shop.items).toContainEqual({
      id: 'categories',
      label: '카테고리',
      items: [{ label: '카테고리 전체 보기', href: '/categories' }],
    });
  });

  test('does not duplicate dynamic category destinations', () => {
    const [shop] = buildHeaderNavGroups([
      { id: 'bags', name: '가방', href: '/categories/bags' },
      { id: 'bags', name: '가방', href: '/categories/bags' },
      { id: 'bags-copy', name: '가방 복제', href: '/categories/bags' },
    ]);

    expect(shop.items).toContainEqual({
      id: 'categories',
      label: '카테고리',
      items: [
        { label: '카테고리 전체 보기', href: '/categories' },
        { label: '가방', href: '/categories/bags' },
      ],
    });
  });

  test('keeps the category hub unique when a loaded category reuses its href', () => {
    const [shop] = buildHeaderNavGroups([
      { id: 'all', name: '카테고리', href: '/categories' },
    ]);

    expect(shop.items).toContainEqual({
      id: 'categories',
      label: '카테고리',
      items: [{ label: '카테고리 전체 보기', href: '/categories' }],
    });
  });

  test('returns no direct destination for an incomplete direct-link group', () => {
    expect(getHeaderNavHref({ id: 'recommend', label: '추천', items: [] })).toBeNull();
  });
});
