import { notFound } from 'next/navigation';
import { EventService } from '@/shared/services/eventService';
import type { Event } from '@/shared/types/event';
import EventDetailPage, { generateMetadata } from './page';

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

jest.mock('@/shared/services/eventService', () => ({
  EventService: {
    getPublicEventById: jest.fn(),
  },
}));

jest.mock('./EventDetailClient', () => ({
  __esModule: true,
  default: () => null,
}));

function createEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'event-1',
    title: '검증된 이벤트',
    description: '검증된 이벤트 설명',
    content: '<p>검증된 본문</p>',
    bannerImage: 'https://example.com/verified-banner.webp',
    thumbnailImage: 'https://example.com/verified-thumbnail.webp',
    eventType: 'special',
    eligibilityType: 'none',
    rewardType: 'none',
    publicPolicyVerified: true,
    startDate: new Date('2026-07-01T00:00:00+09:00'),
    endDate: new Date('2026-07-31T23:59:59+09:00'),
    isActive: true,
    participantCount: 0,
    hasMaxParticipants: false,
    createdAt: new Date('2026-07-01T00:00:00+09:00'),
    updatedAt: new Date('2026-07-01T00:00:00+09:00'),
    ...overrides,
  };
}

function pageProps(eventId = 'event-1') {
  return { params: Promise.resolve({ eventId }) };
}

describe('event detail public policy boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test.each([undefined, false])(
    'uses generic not-found metadata without leaking raw fields when verification is %s',
    async (publicPolicyVerified) => {
      const rawEvent = createEvent({
        publicPolicyVerified,
        title: '비공개 원본 제목',
        description: '비공개 원본 설명',
        bannerImage: 'https://private.example/raw-banner.webp',
      });
      jest.mocked(EventService.getPublicEventById).mockResolvedValue(rawEvent);

      const metadata = await generateMetadata(pageProps());

      expect(metadata).toEqual({
        title: '이벤트를 찾을 수 없습니다 - STYNA',
        description: '요청하신 이벤트를 찾을 수 없습니다.',
        robots: { index: false, follow: false },
      });
      expect(JSON.stringify(metadata)).not.toContain(rawEvent.title);
      expect(JSON.stringify(metadata)).not.toContain(rawEvent.description);
      expect(JSON.stringify(metadata)).not.toContain(rawEvent.bannerImage);
    },
  );

  test.each([undefined, false])(
    'routes an unverified event to notFound when verification is %s',
    async (publicPolicyVerified) => {
      jest.mocked(EventService.getPublicEventById).mockResolvedValue(createEvent({
        publicPolicyVerified,
        title: '비공개 원본 제목',
      }));

      await expect(EventDetailPage(pageProps())).rejects.toThrow('NEXT_NOT_FOUND');
      expect(notFound).toHaveBeenCalled();
    },
  );

  test('keeps canonical metadata for a verified public event', async () => {
    const verifiedEvent = createEvent();
    jest.mocked(EventService.getPublicEventById).mockResolvedValue(verifiedEvent);

    await expect(generateMetadata(pageProps())).resolves.toEqual({
      title: `${verifiedEvent.title} - STYNA`,
      description: verifiedEvent.description,
      alternates: {
        canonical: 'https://hebimall.web.app/events/event-1/',
      },
      openGraph: {
        title: verifiedEvent.title,
        description: verifiedEvent.description,
        siteName: 'STYNA',
        type: 'website',
        url: 'https://hebimall.web.app/events/event-1/',
        images: [{
          url: verifiedEvent.bannerImage,
          alt: verifiedEvent.title,
          type: 'image/webp',
        }],
      },
      twitter: {
        card: 'summary_large_image',
        title: verifiedEvent.title,
        description: verifiedEvent.description,
        images: [verifiedEvent.bannerImage],
      },
    });
  });

  test('encodes a dynamic event id before building canonical URLs', async () => {
    const verifiedEvent = createEvent();
    jest.mocked(EventService.getPublicEventById).mockResolvedValue(verifiedEvent);

    const metadata = await generateMetadata(pageProps('summer event?#'));

    expect(metadata.alternates?.canonical).toBe(
      'https://hebimall.web.app/events/summer%20event%3F%23/',
    );
    expect(metadata.openGraph).toEqual(expect.objectContaining({
      url: 'https://hebimall.web.app/events/summer%20event%3F%23/',
    }));
  });

  test('propagates Firestore failures instead of converting them to notFound', async () => {
    jest.mocked(EventService.getPublicEventById).mockRejectedValue(
      new Error('firestore unavailable'),
    );

    await expect(EventDetailPage(pageProps())).rejects.toThrow('firestore unavailable');
    await expect(generateMetadata(pageProps())).rejects.toThrow('firestore unavailable');
    expect(notFound).not.toHaveBeenCalled();
  });
});
