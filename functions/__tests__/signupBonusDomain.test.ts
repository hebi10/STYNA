import {
  SIGNUP_BONUS_AMOUNT,
  SIGNUP_BONUS_DESCRIPTION,
  isSignupBonusHistory,
} from '../src/domain/signupBonus';

describe('signup bonus history compatibility', () => {
  test.each([
    ['canonical source', {
      type: 'earn',
      amount: SIGNUP_BONUS_AMOUNT,
      source: 'signupBonus',
      description: 'renamed copy',
    }],
    ['legacy description', {
      type: 'earn',
      amount: SIGNUP_BONUS_AMOUNT,
      description: SIGNUP_BONUS_DESCRIPTION,
    }],
  ])('recognizes %s evidence', (_label, history) => {
    expect(isSignupBonusHistory(history)).toBe(true);
  });

  test.each([
    { type: 'use', amount: SIGNUP_BONUS_AMOUNT, source: 'signupBonus' },
    { type: 'earn', amount: 1000, source: 'signupBonus' },
    { type: 'earn', amount: SIGNUP_BONUS_AMOUNT, description: '관리자 지급' },
    null,
  ])('rejects unrelated point history %#', (history) => {
    expect(isSignupBonusHistory(history)).toBe(false);
  });
});
