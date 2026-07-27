import type { MetadataRoute } from 'next';
import { EventService } from '@/shared/services/eventService';
import {
  SitemapFirestoreService,
  type SitemapProductCursor,
} from '@/shared/services/sitemapFirestoreService';
import { canonicalUrl } from '@/shared/constants/seo';
import { isPublicEventReady } from '@/shared/utils/eventPublicPolicy';

export const revalidate = 3600;
export const SITEMAP_URL_LIMIT = 50_000;

const SITEMAP_PRODUCT_PAGE_SIZE = 500;
const STATIC_PUBLIC_PATHS = [
  '/',
  '/products',
  '/categories',
  '/events',
  '/brand',
  '/recommend',
  '/reviews',
  '/main/sale',
  '/cs/faq',
  '/cs/notice_list',
  '/legal/privacy',
  '/legal/terms',
  '/legal/business-info',
  '/support/offline',
] as const;

export class SitemapUrlLimitExceededError extends Error {
  readonly limit: number;

  constructor(limit: number) {
    super(
      `Sitemap URL limit of ${limit.toLocaleString('en-US')} would be exceeded. `
      + 'Generate sitemap shards before publishing additional public URLs.',
    );
    this.name = 'SitemapUrlLimitExceededError';
    this.limit = limit;
  }
}

interface BuildSitemapOptions {
  maxUrls?: number;
}

function normalizeUrlLimit(maxUrls: number | undefined): number {
  const limit = maxUrls ?? SITEMAP_URL_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > SITEMAP_URL_LIMIT) {
    throw new RangeError(`Sitemap maxUrls must be an integer from 1 to ${SITEMAP_URL_LIMIT}.`);
  }

  return limit;
}

function addUniqueEntry(
  entries: Map<string, MetadataRoute.Sitemap[number]>,
  entry: MetadataRoute.Sitemap[number],
  maxUrls: number,
): void {
  if (!entries.has(entry.url) && entries.size >= maxUrls) {
    throw new SitemapUrlLimitExceededError(maxUrls);
  }

  entries.set(entry.url, entry);
}

function cursorKey(cursor: SitemapProductCursor): string {
  return `${cursor.createdAt.seconds}:${cursor.createdAt.nanoseconds}:${cursor.productId}`;
}

export async function buildSitemap(
  options: BuildSitemapOptions = {},
): Promise<MetadataRoute.Sitemap> {
  const maxUrls = normalizeUrlLimit(options.maxUrls);
  const entries = new Map<string, MetadataRoute.Sitemap[number]>();

  for (const pathname of STATIC_PUBLIC_PATHS) {
    addUniqueEntry(entries, { url: canonicalUrl(pathname) }, maxUrls);
  }

  const [categoryIds, events] = await Promise.all([
    SitemapFirestoreService.getCategoryIds(),
    EventService.getPublicEvents({ isActive: true }),
  ]);

  for (const categoryId of categoryIds) {
    if (categoryId.trim()) {
      addUniqueEntry(entries, {
        url: canonicalUrl(`/categories/${encodeURIComponent(categoryId)}`),
      }, maxUrls);
    }
  }

  for (const event of events.filter(isPublicEventReady)) {
    addUniqueEntry(entries, {
      url: canonicalUrl(`/events/${encodeURIComponent(event.id)}`),
      lastModified: event.updatedAt,
    }, maxUrls);
  }

  let cursor: SitemapProductCursor | null = null;
  const visitedCursors = new Set<string>();

  while (true) {
    const page = await SitemapFirestoreService.queryActiveProductsPage({
      pageSize: SITEMAP_PRODUCT_PAGE_SIZE,
      cursor,
    });

    for (const product of page.items) {
      addUniqueEntry(entries, {
        url: canonicalUrl(`/products/${encodeURIComponent(product.id)}`),
        ...(product.updatedAt ? { lastModified: product.updatedAt } : {}),
      }, maxUrls);
    }

    if (!page.hasMore) {
      break;
    }

    if (!page.nextCursor) {
      throw new Error('Sitemap product pagination returned hasMore=true without nextCursor.');
    }

    const nextCursorKey = cursorKey(page.nextCursor);
    if (visitedCursors.has(nextCursorKey)) {
      throw new Error('Sitemap product pagination returned a repeated nextCursor.');
    }

    visitedCursors.add(nextCursorKey);
    cursor = page.nextCursor;
  }

  return Array.from(entries.values());
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildSitemap();
}
