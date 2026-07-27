import { Event } from '@/shared/types/event';
import { isValidFirestoreDocumentId } from './firestoreDocumentId';

const VALID_ELIGIBILITY_TYPES = new Set(['none', 'purchase', 'delivered', 'review']);
const EVIDENCE_ELIGIBILITY_TYPES = new Set(['purchase', 'delivered', 'review']);

export function isPublicEventReady(event: Event): boolean {
  if (event.isActive !== true || event.publicPolicyVerified !== true) {
    return false;
  }

  if (!event.eligibilityType || !VALID_ELIGIBILITY_TYPES.has(event.eligibilityType)) {
    return false;
  }

  if (event.rewardType !== 'none' && event.rewardType !== 'coupon') {
    return false;
  }

  if (event.eligibilityType === 'none') {
    if (event.targetProducts !== undefined) {
      return false;
    }
  } else if (
    !EVIDENCE_ELIGIBILITY_TYPES.has(event.eligibilityType)
    || !Array.isArray(event.targetProducts)
    || event.targetProducts.length === 0
    || !event.targetProducts.every(isValidFirestoreDocumentId)
  ) {
    return false;
  }

  if (event.rewardType === 'coupon') {
    return isValidFirestoreDocumentId(event.rewardCouponId);
  }

  return event.rewardCouponId === undefined;
}
