'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/authProvider';
import {
  getEventUiMeta,
  getEventUiVariant,
} from '@/shared/constants/eventUiMeta';
import {
  EventService,
  getEventParticipationErrorCode,
  getEventParticipationErrorMessage,
  getEventStatus,
} from '@/shared/services/eventService';
import { Event, EventUiVariant } from '@/shared/types/event';
import { sanitizeEventHtml } from '@/shared/utils/eventHtml';
import { getEventDisplayImages } from '@/shared/utils/eventImages';
import Link from 'next/link';
import EventActionBar, {
  EventActionSummaryItem,
} from './_components/EventActionBar';
import EventCommerceHero from './_components/EventCommerceHero';
import EventInformationSections from './_components/EventInformationSections';
import EventMobileStickyAction from './_components/EventMobileStickyAction';
import EventProductShowcase from './_components/EventProductShowcase';
import { getEventProductSectionMeta } from './eventProductSelection';
import styles from './EventDetailClient.module.css';

interface EventDetailClientProps {
  event: Event;
}

interface CtaFeedback {
  tone: 'success' | 'error' | 'info';
  message: string;
}

type CtaAction = 'coupons' | 'support' | 'recommend' | 'notice' | 'reviews' | 'events';

interface PrimaryCtaConfig {
  eyebrow: string;
  label: string;
  description: string;
  action: 'participate' | CtaAction;
  pendingLabel?: string;
  completedLabel?: string;
  postParticipationLabel?: string;
  followUpAction?: Extract<CtaAction, 'coupons' | 'recommend' | 'reviews'>;
}

const HTML_TAG_PATTERN = /<\/?[a-z][\s\S]*>/i;

const formatDate = (date: Date) =>
  date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });

const hasHtmlContent = (content?: string | null) =>
  Boolean(content && HTML_TAG_PATTERN.test(content));

const getContentParagraphs = (content?: string | null) =>
  (content ?? '')
    .split(/\n{2,}/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean);

const getParticipationMethod = (event: Event, uiVariant: EventUiVariant) => {
  switch (uiVariant) {
    case 'coupon':
      return event.couponType === 'manual'
        ? '고객센터 또는 별도 안내를 통해 받은 쿠폰 코드를 직접 입력해 참여합니다.'
        : '로그인 후 조건을 충족하면 쿠폰이 자동으로 지급되는 방식입니다.';
    case 'sale':
      return '대상 상품 또는 카테고리에서 혜택이 적용된 상태로 바로 구매하는 방식입니다.';
    case 'review':
      return '구매 완료 후 리뷰를 작성하고 참여 조건을 충족하면 보상이 지급되는 방식입니다.';
    case 'new':
      return '신상품 공개 일정에 맞춰 컬렉션을 확인하고 대상 상품에 참여하는 방식입니다.';
    case 'special':
    default:
      return '이벤트 조건을 확인한 뒤 참여 절차를 완료하면 혜택이 반영되는 방식입니다.';
  }
};

const getBenefitItems = (event: Event, uiVariant: EventUiVariant, typeLabel: string) => {
  const items: string[] = [];

  if (event.discountRate && event.discountRate > 0) {
    items.push(`최대 ${event.discountRate}% 할인 혜택이 적용됩니다.`);
  }

  if (event.discountAmount && event.discountAmount > 0) {
    items.push(`${event.discountAmount.toLocaleString()}원 적립 또는 보상 혜택이 제공됩니다.`);
  }

  if (event.couponCode) {
    items.push(`쿠폰 코드 ${event.couponCode}를 사용할 수 있습니다.`);
  }

  if (uiVariant === 'review' && items.length === 0) {
    items.push('리뷰 작성 완료 시 후기 보상 또는 적립 혜택이 제공됩니다.');
  }

  if (event.targetCategories && event.targetCategories.length > 0) {
    items.push(`대상 카테고리: ${event.targetCategories.join(', ')}`);
  }

  if (items.length === 0) {
    items.push(`${typeLabel} 이벤트 전용 혜택이 적용됩니다.`);
  }

  return items;
};

const getParticipationSteps = (
  event: Event,
  status: ReturnType<typeof getEventStatus>,
  participationMethod: string
) => {
  const steps = [
    `이벤트 기간인 ${formatDate(event.startDate)}부터 ${formatDate(event.endDate)}까지 참여 조건을 확인합니다.`,
    participationMethod,
  ];

  if (event.targetCategories && event.targetCategories.length > 0) {
    steps.push(`대상 범위는 ${event.targetCategories.join(', ')} 카테고리 중심으로 확인합니다.`);
  }

  if (event.hasMaxParticipants && event.maxParticipants && event.maxParticipants > 0) {
    steps.push(`선착순 ${event.maxParticipants.toLocaleString()}명 마감 전에 참여를 완료해야 합니다.`);
  }

  if (status === 'upcoming') {
    steps.push('시작 전에는 참여가 열리지 않으므로 일정에 맞춰 다시 확인해야 합니다.');
  }

  if (status === 'ongoing') {
    steps.push('상단 CTA를 누르면 실제 참여 처리 또는 관련 액션으로 이어집니다.');
  }

  if (status === 'ended') {
    steps.push('종료된 이벤트는 신규 참여가 불가하며 지급 결과 또는 후속 안내만 확인할 수 있습니다.');
  }

  return steps;
};

const getNoticeItems = (
  event: Event,
  status: ReturnType<typeof getEventStatus>,
  uiVariant: EventUiVariant
) => {
  const notices = ['이벤트 상세 본문과 지급 시점을 함께 확인한 뒤 참여 여부를 결정해주세요.'];

  if (event.hasMaxParticipants && event.maxParticipants && event.maxParticipants > 0) {
    notices.push(`참여 인원은 최대 ${event.maxParticipants.toLocaleString()}명으로 제한됩니다.`);
  } else {
    notices.push('참여 인원 제한이 없는 이벤트지만 기간 종료 후에는 신규 참여가 불가능합니다.');
  }

  if (event.eventType === 'coupon' && event.couponType === 'manual') {
    notices.push('수동 쿠폰 이벤트는 고객센터 또는 별도 공지로 받은 코드 입력이 필요합니다.');
  }

  if (uiVariant === 'sale') {
    notices.push('세일 대상 상품과 할인율은 재고 상황에 따라 일부 조정될 수 있습니다.');
  }

  if (uiVariant === 'review') {
    notices.push('리뷰 삭제 또는 운영 정책에 맞지 않는 내용은 보상 지급 대상에서 제외될 수 있습니다.');
  }

  if (uiVariant === 'new') {
    notices.push('신상품 공개 일정에 따라 일부 상품은 순차적으로 노출될 수 있습니다.');
  }

  if (status === 'upcoming') {
    notices.push('예정 상태에서는 혜택이 아직 적용되지 않으므로 시작일 이후 다시 확인해야 합니다.');
  }

  if (status === 'ended') {
    notices.push('종료된 이벤트는 신규 참여 대신 혜택 지급 여부와 안내 내용을 확인해야 합니다.');
  }

  notices.push(`참여 기간은 ${formatDate(event.startDate)}부터 ${formatDate(event.endDate)}까지입니다.`);

  return notices;
};

const getPrimaryCtaConfig = (
  event: Event,
  status: ReturnType<typeof getEventStatus>,
  isLoggedIn: boolean,
  isDirectParticipationAvailable: boolean,
  uiVariant: EventUiVariant
): PrimaryCtaConfig => {
  const uiMeta = getEventUiMeta(uiVariant);

  if (status === 'upcoming') {
    return {
      eyebrow: '오픈 전 안내',
      label: '오픈 일정 확인하기',
      description: '이벤트 시작 전이므로 오픈 일정과 참여 조건을 먼저 확인해주세요.',
      action: 'notice',
    };
  }

  if (status === 'ended') {
    switch (uiVariant) {
      case 'sale':
      case 'new':
        return {
          eyebrow: '다음 쇼핑 안내',
          label: '추천 상품 보기',
          description: '종료된 이벤트와 관련된 추천 상품을 둘러보세요.',
          action: 'recommend',
        };
      case 'review':
        return {
          eyebrow: '다음 참여 안내',
          label: '리뷰 보러가기',
          description: '리뷰 화면에서 다음 참여 기회와 상품 후기를 확인해 보세요.',
          action: 'reviews',
        };
      case 'coupon':
      case 'special':
        return {
          eyebrow: '다른 이벤트 안내',
          label: '전체 이벤트 보기',
          description: '현재 참여할 수 있는 다른 이벤트를 확인해 보세요.',
          action: 'events',
        };
    }
  }

  if (!isDirectParticipationAvailable) {
    return {
      eyebrow: '쿠폰 코드 안내',
      label: '쿠폰 코드 문의하기',
      description: '수동 쿠폰 이벤트이므로 고객센터에서 코드와 지급 조건을 먼저 확인해주세요.',
      action: 'support',
    };
  }

  const config: PrimaryCtaConfig = {
    eyebrow: '핵심 행동',
    label: isLoggedIn ? uiMeta.primaryActionLabel : uiMeta.primaryActionLoggedOutLabel,
    description: uiMeta.primaryActionDescription,
    action: 'participate',
    pendingLabel: uiMeta.primaryPendingLabel,
    completedLabel: uiMeta.primaryCompletedLabel,
    postParticipationLabel: uiMeta.primaryPostParticipationLabel,
  };

  if (uiVariant === 'sale' || uiVariant === 'new') {
    config.followUpAction = 'recommend';
  }

  if (uiVariant === 'review') {
    config.followUpAction = 'reviews';
  }

  return config;
};

const getScopeSummary = (event: Event, uiVariant: EventUiVariant) => {
  if (event.targetCategories && event.targetCategories.length > 0) {
    return event.targetCategories.join(', ');
  }

  switch (uiVariant) {
    case 'coupon':
      return '쿠폰 지급 대상 전체';
    case 'review':
      return '구매 완료 상품 리뷰';
    case 'new':
      return '신규 공개 상품 전체';
    default:
      return '전체 이벤트 대상';
  }
};

export default function EventDetailClient({ event }: EventDetailClientProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const noticeSectionRef = useRef<HTMLElement | null>(null);
  const status = getEventStatus(event);
  const uiVariant = useMemo(() => getEventUiVariant(event), [event]);
  const uiMeta = useMemo(() => getEventUiMeta(event), [event]);
  const displayImages = useMemo(() => getEventDisplayImages(event), [event]);
  const [participantCount, setParticipantCount] = useState(event.participantCount);
  const [hasParticipated, setHasParticipated] = useState(false);
  const [isParticipationChecking, setIsParticipationChecking] = useState(false);
  const [isParticipating, setIsParticipating] = useState(false);
  const [ctaFeedback, setCtaFeedback] = useState<CtaFeedback | null>(null);

  const rawContent = event.content?.trim() ?? '';
  const isHtmlContent = hasHtmlContent(rawContent);
  const participationMethod = useMemo(
    () => getParticipationMethod(event, uiVariant),
    [event, uiVariant]
  );
  const benefitItems = useMemo(
    () => getBenefitItems(event, uiVariant, uiMeta.typeLabel),
    [event, uiMeta.typeLabel, uiVariant]
  );
  const participationSteps = useMemo(
    () => getParticipationSteps(event, status, participationMethod),
    [event, participationMethod, status]
  );
  const noticeItems = useMemo(
    () => getNoticeItems(event, status, uiVariant),
    [event, status, uiVariant]
  );
  const isDirectParticipationAvailable =
    status === 'ongoing' && !(event.eventType === 'coupon' && event.couponType === 'manual');
  const primaryCta = useMemo(
    () =>
      getPrimaryCtaConfig(
        event,
        status,
        Boolean(user),
        isDirectParticipationAvailable,
        uiVariant
      ),
    [event, isDirectParticipationAvailable, status, uiVariant, user]
  );
  const contentParagraphs =
    isHtmlContent
      ? []
      : rawContent
        ? getContentParagraphs(rawContent)
        : [
          `${uiMeta.typeLabel} 이벤트의 상세 본문이 아직 등록되지 않았습니다.`,
          `${event.description} 참여 전 기간과 혜택, 지급 방식을 아래 정보에서 먼저 확인해주세요.`,
        ];
  const statusLabel = status === 'ongoing' ? '진행중' : status === 'upcoming' ? '예정' : '종료';
  const productSectionMeta = getEventProductSectionMeta(uiVariant);
  const actionItems: EventActionSummaryItem[] = [
    { label: '핵심 혜택', value: benefitItems[0] },
    { label: '대상', value: getScopeSummary(event, uiVariant) },
    {
      label: '기간',
      value: `${formatDate(event.startDate)} ~ ${formatDate(event.endDate)}`,
    },
  ];

  useEffect(() => {
    setParticipantCount(event.participantCount);
    setHasParticipated(false);
    setIsParticipationChecking(false);
    setIsParticipating(false);
    setCtaFeedback(null);
  }, [event.id, event.participantCount]);

  useEffect(() => {
    let isActive = true;

    if (authLoading || !user || !isDirectParticipationAvailable) {
      setIsParticipationChecking(false);
      setHasParticipated(false);
      setCtaFeedback(null);
      return () => {
        isActive = false;
      };
    }

    const checkParticipation = async () => {
      setIsParticipationChecking(true);

      try {
        const participated = await EventService.checkEventParticipation(event.id, user.uid);

        if (!isActive) {
          return;
        }

        setHasParticipated(participated);

        if (participated) {
          setCtaFeedback({
            tone: 'info',
            message: primaryCta.followUpAction
              ? '이미 참여가 완료된 이벤트입니다. 상단 CTA로 다음 화면을 바로 이어갈 수 있습니다.'
              : '이미 참여가 완료된 이벤트입니다. 지급 방식은 아래 안내를 확인해주세요.',
          });
        }
      } catch {
        if (!isActive) {
          return;
        }

        setCtaFeedback({
          tone: 'error',
          message: '참여 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.',
        });
      } finally {
        if (isActive) {
          setIsParticipationChecking(false);
        }
      }
    };

    checkParticipation();

    return () => {
      isActive = false;
    };
  }, [authLoading, event.id, isDirectParticipationAvailable, primaryCta.followUpAction, user]);

  const primaryCtaLabel = (() => {
    if (isParticipationChecking) {
      return '참여 상태 확인 중...';
    }

    if (isParticipating) {
      return primaryCta.pendingLabel ?? '처리 중...';
    }

    if (hasParticipated && primaryCta.action === 'participate') {
      if (primaryCta.followUpAction && primaryCta.postParticipationLabel) {
        return primaryCta.postParticipationLabel;
      }

      return primaryCta.completedLabel ?? '참여 완료';
    }

    return primaryCta.label;
  })();
  const isPrimaryActionDisabled =
    primaryCta.action === 'participate'
      ? isParticipationChecking
        || isParticipating
        || (hasParticipated && !primaryCta.followUpAction)
      : false;

  const navigateByAction = (action: CtaAction) => {
    switch (action) {
      case 'coupons':
        router.push(user ? '/mypage/coupons' : '/auth/login');
        break;
      case 'support':
        router.push('/cs/inquiry');
        break;
      case 'recommend':
        router.push('/recommend');
        break;
      case 'reviews':
        router.push('/reviews');
        break;
      case 'events':
        router.push('/events');
        break;
      case 'notice':
        noticeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      default:
        break;
    }
  };

  const handlePrimaryCta = async () => {
    if (primaryCta.action !== 'participate') {
      navigateByAction(primaryCta.action);
      return;
    }

    if (!user) {
      router.push('/auth/login');
      return;
    }

    if (isParticipationChecking || isParticipating) {
      return;
    }

    if (hasParticipated) {
      if (primaryCta.followUpAction) {
        navigateByAction(primaryCta.followUpAction);
      }

      return;
    }

    setIsParticipating(true);
    setCtaFeedback(null);

    try {
      const result = await EventService.participateInEvent(event.id);

      setHasParticipated(true);
      setParticipantCount(result.participantCount);
      setCtaFeedback({
        tone: result.alreadyParticipated ? 'info' : 'success',
        message:
          result.alreadyParticipated
            ? '이미 참여가 완료된 이벤트입니다. 지급 방식은 아래 안내를 확인해주세요.'
            : result.rewardIssued
            ? '이벤트 참여와 쿠폰 지급이 완료되었습니다. 하단 보조 행동에서 쿠폰함 또는 사용 조건을 바로 확인할 수 있습니다.'
            : uiVariant === 'review'
            ? '리뷰 이벤트 참여가 완료되었습니다. 상단 CTA 또는 리뷰 화면에서 다음 단계를 이어가세요.'
            : '이벤트 참여가 완료되었습니다. 아래 보조 행동과 상세 안내로 다음 단계를 이어가세요.',
      });

      if (primaryCta.followUpAction) {
        navigateByAction(primaryCta.followUpAction);
      }
    } catch (error) {
      const errorCode = getEventParticipationErrorCode(error);

      if (errorCode === 'already_participated') {
        setHasParticipated(true);
      }

      setCtaFeedback({
        tone: errorCode === 'already_participated' ? 'info' : 'error',
        message: getEventParticipationErrorMessage(error),
      });
    } finally {
      setIsParticipating(false);
    }
  };

  return (
    <div className={`${styles.container} ${styles[`${uiVariant}Theme`]}`}>
      <div className={styles.content}>
        <nav className={styles.breadcrumb} aria-label="현재 위치">
          <Link href="/" className={styles.breadcrumbLink}>홈</Link>
          <span className={styles.breadcrumbSeparator} aria-hidden="true">/</span>
          <Link href="/events" className={styles.breadcrumbLink}>이벤트</Link>
          <span className={styles.breadcrumbSeparator} aria-hidden="true">/</span>
          <span className={styles.breadcrumbCurrent}>{event.title}</span>
        </nav>

        <EventCommerceHero
          event={{ ...event, participantCount }}
          desktopImage={displayImages.detailImage}
          mobileImage={displayImages.thumbnailImage}
          statusLabel={statusLabel}
          periodLabel={`${formatDate(event.startDate)} ~ ${formatDate(event.endDate)}`}
        />

        <EventActionBar
          items={actionItems}
          label={primaryCtaLabel}
          disabled={isPrimaryActionDisabled}
          onAction={() => void handlePrimaryCta()}
        />

        {ctaFeedback ? (
          <p
            className={`${styles.ctaFeedback} ${styles[`ctaFeedback${ctaFeedback.tone === 'success' ? 'Success' : ctaFeedback.tone === 'error' ? 'Error' : 'Info'}`]}`}
            aria-live="polite"
          >
            {ctaFeedback.message}
          </p>
        ) : null}

        <EventProductShowcase event={event} variant={uiVariant} />

        <section ref={noticeSectionRef} className={styles.informationAnchor}>
          <EventInformationSections
            contentHtml={isHtmlContent ? sanitizeEventHtml(rawContent) : undefined}
            contentParagraphs={contentParagraphs}
            benefitItems={benefitItems}
            participationSteps={participationSteps}
            noticeItems={noticeItems}
          />
        </section>

        <nav className={styles.bottomLinks} aria-label="이벤트 후속 이동">
          <Link href={productSectionMeta.href}>{productSectionMeta.linkLabel}</Link>
          <Link href="/events">전체 이벤트 보기</Link>
        </nav>
      </div>

      <EventMobileStickyAction
        statusLabel={statusLabel}
        label={primaryCtaLabel}
        disabled={isPrimaryActionDisabled}
        onAction={() => void handlePrimaryCta()}
      />
    </div>
  );
}
