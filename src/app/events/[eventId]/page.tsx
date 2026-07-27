import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EventService } from '@/shared/services/eventService';
import EventDetailClient from './EventDetailClient';
import { isPublicEventReady } from '@/shared/utils/eventPublicPolicy';
import { getEventDisplayImages } from '@/shared/utils/eventImages';
import {
  absoluteSiteUrl,
  canonicalUrl,
  getOpenGraphImage,
} from '@/shared/constants/seo';

interface Props {
  params: Promise<{
    eventId: string;
  }>;
}

const getPublicEvent = cache((eventId: string) => (
  EventService.getPublicEventById(eventId)
));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { eventId } = await params;
  const event = await getPublicEvent(eventId);
  if (!event || !isPublicEventReady(event)) {
    return {
      title: '이벤트를 찾을 수 없습니다 - STYNA',
      description: '요청하신 이벤트를 찾을 수 없습니다.',
      robots: { index: false, follow: false },
    };
  }

  const canonical = canonicalUrl(`/events/${encodeURIComponent(eventId)}`);
  const { bannerImage } = getEventDisplayImages(event);
  const openGraphImage = getOpenGraphImage(bannerImage, event.title);

  return {
    title: `${event.title} - STYNA`,
    description: event.description,
    alternates: { canonical },
    openGraph: {
      title: event.title,
      description: event.description,
      siteName: 'STYNA',
      type: 'website',
      url: canonical,
      images: [openGraphImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: event.title,
      description: event.description,
      images: [absoluteSiteUrl(bannerImage)],
    },
  };
}

export default async function EventDetailPage({ params }: Props) {
  const { eventId } = await params;
  const event = await getPublicEvent(eventId);
  if (!event || !isPublicEventReady(event)) {
    notFound();
  }

  return <EventDetailClient event={event} />;
}
