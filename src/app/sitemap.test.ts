import type { Event } from '@/shared/types/event';
import { EventService } from '@/shared/services/eventService';
import {
  SitemapFirestoreService,
  type SitemapProductCursor,
} from '@/shared/services/sitemapFirestoreService';
import sitemap, {
  buildSitemap,
  SITEMAP_URL_LIMIT,
  SitemapUrlLimitExceededError,
} from './sitemap';

jest.mock('@/shared/services/sitemapFirestoreService', () => ({
  SitemapFirestoreService: {
    getCategoryIds: jest.fn(),
    queryActiveProductsPage: jest.fn(),
  },
}));

jest.mock('@/shared/services/eventService', () => ({
  EventService: {
    getPublicEvents: jest.fn(),
  },
}));

const sitemapProduct = (id: string) => ({
  id,
  updatedAt: new Date('2026-07-20T00:00:00.000Z'),
});

const publicEvent = (id: string, overrides: Partial<Event> = {}): Event => ({
  id,
  title: id,
  description: id,
  bannerImage: '/event.webp',
  thumbnailImage: '/event-thumb.webp',
  eventType: 'sale',
  eligibilityType: 'none',
  rewardType: 'none',
  publicPolicyVerified: true,
  startDate: new Date('2026-07-01T00:00:00.000Z'),
  endDate: new Date('2026-08-01T00:00:00.000Z'),
  isActive: true,
  participantCount: 0,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-20T00:00:00.000Z'),
  ...overrides,
});

const nextProductCursor: SitemapProductCursor = {
  createdAt: {
    seconds: new Date('2026-07-01T00:00:00.000Z').getTime() / 1000,
    nanoseconds: 0,
  },
  productId: 'product-one',
};

describe('sitemap metadata route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('includes public static routes, categories, active products, and policy-ready events', async () => {
    jest.mocked(SitemapFirestoreService.getCategoryIds)
      .mockResolvedValue(['tops', 'bags', 'tops', '']);
    jest.mocked(SitemapFirestoreService.queryActiveProductsPage)
      .mockResolvedValueOnce({
        items: [sitemapProduct('product-one')],
        hasMore: true,
        nextCursor: nextProductCursor,
      })
      .mockResolvedValueOnce({
        items: [sitemapProduct('product-two')],
        hasMore: false,
      });
    jest.mocked(EventService.getPublicEvents).mockResolvedValue([
      publicEvent('ready-event'),
      publicEvent('inactive-event', { isActive: false }),
      publicEvent('unverified-event', { publicPolicyVerified: false }),
    ]);

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toEqual(expect.arrayContaining([
      'https://hebimall.web.app/',
      'https://hebimall.web.app/products/',
      'https://hebimall.web.app/categories/tops/',
      'https://hebimall.web.app/categories/bags/',
      'https://hebimall.web.app/products/product-one/',
      'https://hebimall.web.app/products/product-two/',
      'https://hebimall.web.app/events/ready-event/',
    ]));
    expect(urls).not.toEqual(expect.arrayContaining([
      'https://hebimall.web.app/events/inactive-event/',
      'https://hebimall.web.app/events/unverified-event/',
      'https://hebimall.web.app/admin/',
      'https://hebimall.web.app/auth/login/',
    ]));
    expect(new Set(urls).size).toBe(urls.length);
    expect(SitemapFirestoreService.queryActiveProductsPage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ cursor: nextProductCursor }),
    );
    expect(EventService.getPublicEvents).toHaveBeenCalledWith({ isActive: true });
  });

  test('continues beyond the previous 100-page cutoff without rereading a page', async () => {
    jest.mocked(SitemapFirestoreService.getCategoryIds).mockResolvedValue([]);
    jest.mocked(EventService.getPublicEvents).mockResolvedValue([]);
    jest.mocked(SitemapFirestoreService.queryActiveProductsPage).mockImplementation(
      async (input = {}) => {
        const { cursor } = input;
        const page = cursor ? Number(cursor.productId.replace('cursor-', '')) + 1 : 0;
        const hasMore = page < 100;

        return {
          items: [sitemapProduct(`product-${page}`)],
          hasMore,
          nextCursor: hasMore
            ? {
                createdAt: { seconds: 2_000_000_000 - page, nanoseconds: 0 },
                productId: `cursor-${page}`,
              }
            : undefined,
        };
      },
    );

    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls).toContain('https://hebimall.web.app/products/product-100/');
    expect(SitemapFirestoreService.queryActiveProductsPage).toHaveBeenCalledTimes(101);
  });

  test('propagates Firebase query failures instead of publishing a partial normal sitemap', async () => {
    jest.mocked(SitemapFirestoreService.getCategoryIds).mockResolvedValue(['shoes']);
    jest.mocked(SitemapFirestoreService.queryActiveProductsPage)
      .mockRejectedValue(new Error('products unavailable'));
    jest.mocked(EventService.getPublicEvents).mockResolvedValue([publicEvent('available-event')]);

    await expect(sitemap()).rejects.toThrow('products unavailable');
  });

  test('fails explicitly before a unique URL can exceed the configured limit', async () => {
    jest.mocked(SitemapFirestoreService.getCategoryIds).mockResolvedValue([]);
    jest.mocked(EventService.getPublicEvents).mockResolvedValue([]);
    jest.mocked(SitemapFirestoreService.queryActiveProductsPage).mockResolvedValue({
      items: [sitemapProduct('over-limit-product')],
      hasMore: false,
    });

    await expect(buildSitemap({ maxUrls: 14 })).rejects.toMatchObject({
      name: 'SitemapUrlLimitExceededError',
      limit: 14,
    } satisfies Partial<SitemapUrlLimitExceededError>);
    expect(SITEMAP_URL_LIMIT).toBe(50_000);
  });

  test('rejects an invalid pagination response instead of looping or truncating', async () => {
    jest.mocked(SitemapFirestoreService.getCategoryIds).mockResolvedValue([]);
    jest.mocked(EventService.getPublicEvents).mockResolvedValue([]);
    jest.mocked(SitemapFirestoreService.queryActiveProductsPage).mockResolvedValue({
      items: [sitemapProduct('product-without-cursor')],
      hasMore: true,
    });

    await expect(sitemap()).rejects.toThrow('nextCursor');
  });
});
