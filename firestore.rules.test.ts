import fs from 'fs';
import path from 'path';

const rules = fs.readFileSync(path.join(__dirname, 'firestore.rules'), 'utf8');

function block(matchName: string): string {
  const start = rules.indexOf(`match /${matchName}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = rules.indexOf('\n    match /', start + 1);
  return rules.slice(start, next === -1 ? rules.length : next);
}

describe('firestore.rules sensitive writes', () => {
  test('qna owner updates are limited to user-editable fields', () => {
    const qnaRules = block('qna/{qnaId}');

    expect(qnaRules).not.toContain('allow update, delete: if isAdmin() ||');
    expect(qnaRules).toContain('isValidOwnerQnaUpdate()');
    expect(rules).toContain('qnaOwnerUpdateAllowedKeys()');
  });

  test('review owner updates are limited to user-editable fields', () => {
    const reviewRules = block('reviews/{reviewId}');

    expect(reviewRules).not.toContain('allow update, delete: if isSignedIn() &&');
    expect(reviewRules).toContain('isValidOwnerReviewUpdate()');
    expect(rules).toContain('reviewOwnerUpdateAllowedKeys()');
  });

  test('coupon master documents are not readable by every signed-in user', () => {
    const couponRules = block('coupons/{couponId}');

    expect(couponRules).not.toContain('allow read: if isSignedIn();');
    expect(couponRules).toContain('allow read: if isAdmin();');
  });
});
