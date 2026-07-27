import { getEventDisplayImages } from './eventImages';
import { Event } from '@/shared/types/event';

const baseEvent: Event = {
  id: 'event-1',
  title: '봄맞이 특가 세일',
  description: '봄 신상품 최대 50% 할인!',
  content: '',
  bannerImage: '',
  thumbnailImage: '',
  eventType: 'sale',
  startDate: new Date('2026-03-01T00:00:00.000Z'),
  endDate: new Date('2026-12-31T00:00:00.000Z'),
  isActive: true,
  participantCount: 0,
  hasMaxParticipants: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('getEventDisplayImages', () => {
  it('uses local editorial images when event images are missing', () => {
    const result = getEventDisplayImages(baseEvent);

    expect(result.bannerImage).toBe('/main/hero_editorial_sale_fixed.webp');
    expect(result.thumbnailImage).toBe('/main/hero_editorial_sale.webp');
    expect(result.detailImage).toBe('/main/hero_editorial_sale_fixed.webp');
  });

  it('keeps custom uploaded images when they are present', () => {
    const result = getEventDisplayImages({
      ...baseEvent,
      bannerImage: 'https://cdn.example.com/events/custom-banner.webp',
      thumbnailImage: 'https://cdn.example.com/events/custom-thumb.webp',
    });

    expect(result.bannerImage).toBe('https://cdn.example.com/events/custom-banner.webp');
    expect(result.thumbnailImage).toBe('https://cdn.example.com/events/custom-thumb.webp');
    expect(result.detailImage).toBe('https://cdn.example.com/events/custom-banner.webp');
  });

  it('uses an explicit detail image when it is present', () => {
    const result = getEventDisplayImages({
      ...baseEvent,
      bannerImage: '/event-assets/midyear-sale-banner.webp',
      thumbnailImage: '/event-assets/midyear-sale-thumb.webp',
      detailImage: '/event-assets/midyear-sale-detail.webp',
    });

    expect(result.bannerImage).toBe('/event-assets/midyear-sale-banner.webp');
    expect(result.thumbnailImage).toBe('/event-assets/midyear-sale-thumb.webp');
    expect(result.detailImage).toBe('/event-assets/midyear-sale-detail.webp');
  });

  it.each([
    '/events/2026/event-banner.webp',
    '/events/2026-v2/event-banner.webp',
    'https://hebimall.web.app/events/2026-v3/event-banner.webp?version=1',
    '/events/2026-editorial/event-20260715-banner.webp',
    '/events/2026-editorial/event-20260721-detail.webp?version=2',
  ])('replaces Firebase Hosting redirected image path %s with editorial images', (redirectedPath) => {
    const result = getEventDisplayImages({
      ...baseEvent,
      bannerImage: redirectedPath,
      thumbnailImage: redirectedPath,
      detailImage: redirectedPath,
    });

    expect(result.bannerImage).toBe('/main/hero_editorial_sale_fixed.webp');
    expect(result.thumbnailImage).toBe('/main/hero_editorial_sale.webp');
    expect(result.detailImage).toBe('/main/hero_editorial_sale_fixed.webp');
  });

  it('keeps editorial images that are not covered by Firebase Hosting redirects', () => {
    const result = getEventDisplayImages({
      ...baseEvent,
      bannerImage: '/events/2026-editorial/current-sale-banner.webp',
      thumbnailImage: '/events/2026-editorial/current-sale-thumb.webp',
      detailImage: '/events/2026-editorial/current-sale-detail.webp',
    });

    expect(result.bannerImage).toBe('/events/2026-editorial/current-sale-banner.webp');
    expect(result.thumbnailImage).toBe('/events/2026-editorial/current-sale-thumb.webp');
    expect(result.detailImage).toBe('/events/2026-editorial/current-sale-detail.webp');
  });

  it('falls back safely when an image URL is malformed', () => {
    const result = getEventDisplayImages({
      ...baseEvent,
      bannerImage: 'http://[invalid',
      thumbnailImage: 'http://[invalid',
      detailImage: 'http://[invalid',
    });

    expect(result.bannerImage).toBe('/main/hero_editorial_sale_fixed.webp');
    expect(result.thumbnailImage).toBe('/main/hero_editorial_sale.webp');
    expect(result.detailImage).toBe('/main/hero_editorial_sale_fixed.webp');
  });

  it.each([
    'javascript:alert(1)',
    'data:image/svg+xml,<svg></svg>',
    'http://cdn.example.com/events/banner.webp',
    '//cdn.example.com/events/banner.webp',
    'events/banner.webp',
  ])('replaces an image URL that next/image cannot safely render: %s', (unsafeUrl) => {
    const result = getEventDisplayImages({
      ...baseEvent,
      bannerImage: unsafeUrl,
      thumbnailImage: unsafeUrl,
      detailImage: unsafeUrl,
    });

    expect(result.bannerImage).toBe('/main/hero_editorial_sale_fixed.webp');
    expect(result.thumbnailImage).toBe('/main/hero_editorial_sale.webp');
    expect(result.detailImage).toBe('/main/hero_editorial_sale_fixed.webp');
  });

  it('trims a valid local or HTTPS image URL before rendering it', () => {
    const result = getEventDisplayImages({
      ...baseEvent,
      bannerImage: '  /event-assets/banner.webp  ',
      thumbnailImage: '  https://cdn.example.com/events/thumb.webp  ',
    });

    expect(result.bannerImage).toBe('/event-assets/banner.webp');
    expect(result.thumbnailImage).toBe('https://cdn.example.com/events/thumb.webp');
  });

  it('replaces known placeholder event image paths with editorial images', () => {
    const result = getEventDisplayImages({
      ...baseEvent,
      eventType: 'coupon',
      bannerImage: '/images/events/spring-sale.jpg',
      thumbnailImage: '/api/placeholder/300/200',
    });

    expect(result.bannerImage).toBe('/main/hero_editorial_sale_fixed.webp');
    expect(result.thumbnailImage).toBe('/main/hero_editorial_sale.webp');
    expect(result.detailImage).toBe('/main/hero_editorial_sale_fixed.webp');
  });

  it('replaces stale generated event placeholder uploads with editorial images', () => {
    const result = getEventDisplayImages({
      ...baseEvent,
      bannerImage:
        'https://firebasestorage.googleapis.com/v0/b/example/o/events%2Fbanner%2F1754898091622_ChatGPT%20Image%202025%EB%85%84.webp?alt=media',
      thumbnailImage:
        'https://firebasestorage.googleapis.com/v0/b/example/o/events%2Fthumbnail%2F1754898099153_ChatGPT%20Image%202025%EB%85%84.webp?alt=media',
    });

    expect(result.bannerImage).toBe('/main/hero_editorial_sale_fixed.webp');
    expect(result.thumbnailImage).toBe('/main/hero_editorial_sale.webp');
    expect(result.detailImage).toBe('/main/hero_editorial_sale_fixed.webp');
  });

  it('uses review editorial images for special events focused on reviews', () => {
    const result = getEventDisplayImages({
      ...baseEvent,
      eventType: 'special',
      title: '리뷰 작성 이벤트',
      description: '후기를 남기면 적립금을 드립니다.',
    });

    expect(result.bannerImage).toBe('/main/hero_editorial_best_fixed.webp');
    expect(result.thumbnailImage).toBe('/main/hero_editorial_best.webp');
    expect(result.detailImage).toBe('/main/hero_editorial_best_fixed.webp');
  });

  it('does not mistake spring preview for a review event', () => {
    const result = getEventDisplayImages({
      ...baseEvent,
      id: 'event-2026-02-spring-preview',
      eventType: 'new',
      title: '스프링 프리뷰',
      description: '봄 신상품 선공개',
    });

    expect(result.thumbnailImage).toBe('/main/hero_editorial_outer.webp');
  });
});
