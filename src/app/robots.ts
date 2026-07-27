import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/shared/constants/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/auth',
        '/mypage',
        '/orders',
        '/api',
        '/cart',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
