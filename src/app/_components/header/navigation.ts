export interface HeaderCategory {
  id: string;
  name: string;
  href: string;
}

export interface HeaderNavItem {
  label: string;
  href: string;
}

export interface HeaderNavDisclosure {
  id: 'categories';
  label: string;
  items: HeaderNavItem[];
}

export type HeaderNavEntry = HeaderNavItem | HeaderNavDisclosure;

export interface HeaderNavGroup {
  id: 'shop' | 'recommend' | 'events' | 'reviews' | 'support';
  label: string;
  href?: string;
  items: HeaderNavEntry[];
}

export function getHeaderNavHref(group: HeaderNavGroup): string | null {
  return group.items.length === 0 && group.href ? group.href : null;
}

const SHOP_DESTINATIONS: HeaderNavItem[] = [
  { label: '전체 상품', href: '/products' },
];

const SHOP_AFTER_CATEGORIES: HeaderNavItem[] = [
  { label: '신상', href: '/recommend?filter=new' },
  { label: '베스트', href: '/recommend?filter=review' },
  { label: '세일', href: '/main/sale' },
  { label: '브랜드', href: '/brand' },
];

const SUPPORT_DESTINATIONS: HeaderNavItem[] = [
  { label: 'FAQ', href: '/cs/faq' },
  { label: '1:1문의', href: '/cs/inquiry' },
  { label: '상품문의', href: '/qna' },
];

export function buildDesktopHeaderNav(categories: HeaderCategory[]): {
  primaryItems: HeaderNavItem[];
  secondaryItems: HeaderNavItem[];
} {
  const featuredCategory = categories[0]
    ? { label: categories[0].name, href: categories[0].href }
    : { label: '카테고리', href: '/categories' };

  return {
    primaryItems: [
      ...SHOP_DESTINATIONS,
      SHOP_AFTER_CATEGORIES[0],
      SHOP_AFTER_CATEGORIES[1],
      featuredCategory,
      SHOP_AFTER_CATEGORIES[2],
      SHOP_AFTER_CATEGORIES[3],
    ],
    secondaryItems: [
      { label: '추천', href: '/recommend' },
      { label: '이벤트', href: '/events' },
      { label: '리뷰', href: '/reviews' },
      ...SUPPORT_DESTINATIONS.filter(({ href }) => href !== '/cs/faq'),
    ],
  };
}

export function buildHeaderNavGroups(categories: HeaderCategory[]): HeaderNavGroup[] {
  const knownCategoryIds = new Set<string>();
  const knownCategoryHrefs = new Set([
    { label: '카테고리 전체 보기', href: '/categories' },
    ...SHOP_DESTINATIONS,
    ...SHOP_AFTER_CATEGORIES,
  ].map((item) => item.href));
  const categoryItems = categories.flatMap((category) => {
    if (knownCategoryIds.has(category.id) || knownCategoryHrefs.has(category.href)) {
      return [];
    }

    knownCategoryIds.add(category.id);
    knownCategoryHrefs.add(category.href);
    return [{ label: category.name, href: category.href }];
  });

  return [
    {
      id: 'shop',
      label: 'SHOP',
      items: [
        ...SHOP_DESTINATIONS,
        {
          id: 'categories',
          label: '카테고리',
          items: [
            { label: '카테고리 전체 보기', href: '/categories' },
            ...categoryItems,
          ],
        },
        ...SHOP_AFTER_CATEGORIES,
      ],
    },
    { id: 'recommend', label: '추천', href: '/recommend', items: [] },
    { id: 'events', label: '이벤트', href: '/events', items: [] },
    { id: 'reviews', label: '리뷰', href: '/reviews', items: [] },
    { id: 'support', label: '고객지원', items: SUPPORT_DESTINATIONS },
  ];
}
