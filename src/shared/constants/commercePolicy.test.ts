import {
  COMMERCE_POLICY,
  buildChatPolicyPrompt,
  buildDemoDataNotice,
  formatShippingPolicy,
  formatSignupBenefit,
  formatSupportHours,
} from './commercePolicy';
import { getMenuResponse } from '@/shared/utils/chatResponses';
import { SITE_INFO } from './siteInfo';

const unsupportedPolicyPattern =
  /생일|등급별|구매[^\n]*1%|카카오페이|네이버페이|페이코|토스페이|당일|10% 할인|1,000원|첫 구매 무료배송|무료 교환/;

describe('canonical commerce policy', () => {
  test('publishes only implemented commerce benefits', () => {
    expect(COMMERCE_POLICY.signupBonusPoints).toBe(5000);
    expect(COMMERCE_POLICY.shipping.standardFee).toBe(3000);
    expect(COMMERCE_POLICY.shipping.expressFee).toBe(5000);
    expect(COMMERCE_POLICY.shipping.freeThreshold).toBe(50000);
    expect(COMMERCE_POLICY.shipping.promisedDispatch).toBe(false);
    expect(formatSignupBenefit()).toContain('5,000P');
    expect(buildChatPolicyPrompt()).not.toMatch(unsupportedPolicyPattern);
  });

  test('matches the server shipping calculation boundary', () => {
    const shippingPolicy = formatShippingPolicy();

    expect(shippingPolicy).toContain('일반 배송');
    expect(shippingPolicy).toContain('쿠폰 할인 적용 후 상품금액');
    expect(shippingPolicy).toContain('50,000원 이상');
    expect(shippingPolicy).toMatch(/특급 배송.*5,000원/);
    expect(buildChatPolicyPrompt()).toContain(shippingPolicy);
  });

  test('publishes the support hours used by the customer-facing UI', () => {
    expect(COMMERCE_POLICY.support.weekdayHours).toBe('평일 10:00~18:00');
    expect(formatSupportHours()).toBe('평일 10:00~18:00');
    expect(SITE_INFO.supportHours).toBe(formatSupportHours());
    expect(buildChatPolicyPrompt()).toContain(formatSupportHours());
  });

  test('states the demo and Firebase persistence boundary', () => {
    expect(COMMERCE_POLICY.demo.realPayment).toBe(false);
    expect(COMMERCE_POLICY.demo.dataStore).toBe('Firebase');
    expect(buildDemoDataNotice()).toMatch(/실제 결제.*진행되지 않/);
    expect(buildDemoDataNotice()).toContain('Firebase');
  });

  test('keeps menu policy responses aligned with the canonical source', () => {
    const order = getMenuResponse('주문 배송');
    const returnPolicy = getMenuResponse('반품');
    const coupon = getMenuResponse('쿠폰 할인');
    const payment = getMenuResponse('결제 방법');
    const member = getMenuResponse('회원 혜택');
    const size = getMenuResponse('4');
    const agent = getMenuResponse('상담원 연결');
    const product = getMenuResponse('상품 문의');
    const defaultResponse = getMenuResponse('분류되지 않는 긴 고객 질문입니다');
    const combined = [
      order,
      returnPolicy,
      coupon,
      payment,
      member,
      size,
      agent,
      product,
      defaultResponse,
    ].join('\n');

    expect(order).toContain('3,000원');
    expect(order).toContain('50,000원');
    expect(order).toContain('쿠폰 할인 적용 후 상품금액');
    expect(order).toMatch(/특급 배송.*5,000원/);
    expect(coupon).toContain(formatShippingPolicy());
    expect(coupon).toContain(formatSignupBenefit());
    expect(member).toContain(formatSignupBenefit());
    expect(payment).toContain(buildDemoDataNotice());
    expect(agent).toContain('사람 상담을 연결하거나 상담 요청을 저장·전송하지 않습니다');
    expect(product).toContain('답변 여부와 시점은 보장하지 않습니다');
    expect(defaultResponse).toContain('문의 기록');
    expect(order).toContain('포트폴리오 문의');
    expect(combined).not.toMatch(/다음 영업일.*답변|영업일 기준.*답변|상담 연결 요청을 확인/);
    expect(combined).not.toMatch(/고객센터|개별 안내|230~280mm|5mm 단위 제공|빠른 답변/);
    expect(combined).not.toMatch(/09:00|10:00~19:00|10시~19시/);
    expect(combined).not.toMatch(unsupportedPolicyPattern);
  });
});
