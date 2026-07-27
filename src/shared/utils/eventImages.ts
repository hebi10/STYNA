import { getEventUiVariant } from '@/shared/constants/eventUiMeta';
import { Event, EventUiVariant } from '@/shared/types/event';

interface EventEditorialImages {
  bannerImage: string;
  thumbnailImage: string;
  detailImage: string;
}

const EDITORIAL_EVENT_IMAGES: Record<EventUiVariant, EventEditorialImages> = {
  sale: {
    bannerImage: '/main/hero_editorial_sale_fixed.webp',
    thumbnailImage: '/main/hero_editorial_sale.webp',
    detailImage: '/main/hero_editorial_sale_fixed.webp',
  },
  coupon: {
    bannerImage: '/main/hero_editorial_outer_fixed.webp',
    thumbnailImage: '/main/hero_editorial_outer.webp',
    detailImage: '/main/hero_editorial_outer_fixed.webp',
  },
  review: {
    bannerImage: '/main/hero_editorial_best_fixed.webp',
    thumbnailImage: '/main/hero_editorial_best.webp',
    detailImage: '/main/hero_editorial_best_fixed.webp',
  },
  new: {
    bannerImage: '/main/hero_editorial_outer_fixed.webp',
    thumbnailImage: '/main/hero_editorial_outer.webp',
    detailImage: '/main/hero_editorial_outer_fixed.webp',
  },
  special: {
    bannerImage: '/main/hero_editorial_best_fixed.webp',
    thumbnailImage: '/main/hero_editorial_best.webp',
    detailImage: '/main/hero_editorial_best_fixed.webp',
  },
};

const LEGACY_EVENT_IMAGE_PATTERNS = [
  '/images/events/',
  '/api/placeholder/',
  'placeholder',
  'ready',
  'preparing',
  'coming-soon',
  'coming_soon',
  'chatgpt%20image%202025',
  'chatgpt image 2025',
  '준비',
];

const FIREBASE_HOSTING_REDIRECTED_EVENT_IMAGE_PATTERNS = [
  /^\/events\/2026(?:\/|$)/,
  /^\/events\/2026-v2(?:\/|$)/,
  /^\/events\/2026-v3(?:\/|$)/,
  /^\/events\/2026-editorial\/[^/]*-202607(?:15|21)-[^/]*\.webp$/,
];

const SALE_KEYWORDS = ['sale', '세일', '특가', '할인'];
const NEW_KEYWORDS = ['new', '신상', 'collection', '컬렉션'];

const sanitizeEventImage = (imageUrl?: string | null): string | null => {
  const trimmedUrl = imageUrl?.trim();
  if (!trimmedUrl) {
    return null;
  }

  const normalizedUrl = trimmedUrl.toLowerCase();
  if (LEGACY_EVENT_IMAGE_PATTERNS.some((pattern) => normalizedUrl.includes(pattern))) {
    return null;
  }

  let parsedUrl: URL;
  try {
    if (trimmedUrl.startsWith('/') && !trimmedUrl.startsWith('//')) {
      parsedUrl = new URL(trimmedUrl, 'https://local.invalid');
    } else {
      parsedUrl = new URL(trimmedUrl);
      if (parsedUrl.protocol !== 'https:' || parsedUrl.username || parsedUrl.password) {
        return null;
      }
    }
  } catch {
    return null;
  }

  if (FIREBASE_HOSTING_REDIRECTED_EVENT_IMAGE_PATTERNS.some((pattern) => pattern.test(parsedUrl.pathname.toLowerCase()))) {
    return null;
  }

  return trimmedUrl;
};

const pickEditorialVariant = (event: Event): EventUiVariant => {
  const semanticVariant = getEventUiVariant(event);
  if (semanticVariant === 'review') {
    return semanticVariant;
  }

  const searchableText = [
    event.title,
    event.description,
    event.content ?? '',
    event.bannerImage,
    event.thumbnailImage,
  ]
    .join(' ')
    .toLowerCase();

  if (SALE_KEYWORDS.some((keyword) => searchableText.includes(keyword))) {
    return 'sale';
  }

  if (NEW_KEYWORDS.some((keyword) => searchableText.includes(keyword))) {
    return 'new';
  }

  return semanticVariant;
};

export const getEventDisplayImages = (event: Event): EventEditorialImages => {
  const editorialImages = EDITORIAL_EVENT_IMAGES[pickEditorialVariant(event)];
  const bannerImage = sanitizeEventImage(event.bannerImage);
  const thumbnailImage = sanitizeEventImage(event.thumbnailImage);
  const detailImage = sanitizeEventImage(event.detailImage ?? event.bannerImage);

  return {
    bannerImage: bannerImage ?? editorialImages.bannerImage,
    thumbnailImage: thumbnailImage ?? editorialImages.thumbnailImage,
    detailImage: detailImage ?? editorialImages.detailImage,
  };
};
