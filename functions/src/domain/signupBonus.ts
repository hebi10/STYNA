import { COMMERCE_POLICY } from '../commercePolicy';

export const SIGNUP_BONUS_AMOUNT = COMMERCE_POLICY.signupBonusPoints;
export const SIGNUP_BONUS_DESCRIPTION = '신규 회원가입 적립';
export const SIGNUP_BONUS_SOURCE = 'signupBonus';

export function isSignupBonusHistory(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const history = value as Record<string, unknown>;
  return history.type === 'earn'
    && history.amount === SIGNUP_BONUS_AMOUNT
    && (
      history.source === SIGNUP_BONUS_SOURCE
      || history.description === SIGNUP_BONUS_DESCRIPTION
    );
}
