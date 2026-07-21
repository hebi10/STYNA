// Generated from src/shared/constants/commercePolicy.ts. Run npm run sync:chat-responses:write after editing.
export interface CommercePolicy {
  signupBonusPoints: 5000;
  shipping: {
    standardFee: 3000;
    expressFee: 5000;
    freeThreshold: 50000;
    promisedDispatch: false;
  };
  support: {
    weekdayHours: '평일 10:00~18:00';
  };
  demo: {
    realPayment: false;
    dataStore: 'Firebase';
  };
}

export const COMMERCE_POLICY = {
  signupBonusPoints: 5000,
  shipping: {
    standardFee: 3000,
    expressFee: 5000,
    freeThreshold: 50000,
    promisedDispatch: false,
  },
  support: {
    weekdayHours: '평일 10:00~18:00',
  },
  demo: {
    realPayment: false,
    dataStore: 'Firebase',
  },
} as const satisfies CommercePolicy;

function formatNumber(value: number): string {
  return value.toLocaleString('ko-KR');
}

export function formatSignupBenefit(): string {
  return `회원가입 완료 시 ${formatNumber(COMMERCE_POLICY.signupBonusPoints)}P`;
}

export function formatShippingPolicy(): string {
  return (
    `일반 배송비는 ${formatNumber(COMMERCE_POLICY.shipping.standardFee)}원이며, ` +
    `쿠폰 할인 적용 후 상품금액이 ${formatNumber(COMMERCE_POLICY.shipping.freeThreshold)}원 이상이거나 ` +
    '무료배송 쿠폰을 적용하면 무료입니다. ' +
    `특급 배송은 주문금액 및 무료배송 쿠폰과 관계없이 ${formatNumber(COMMERCE_POLICY.shipping.expressFee)}원입니다.`
  );
}

export function formatSupportHours(): string {
  return COMMERCE_POLICY.support.weekdayHours;
}

export function buildDemoDataNotice(): string {
  return `포트폴리오 데모로 실제 결제는 진행되지 않으며 입력한 정보와 주문 기록은 ${COMMERCE_POLICY.demo.dataStore}에 저장될 수 있습니다.`;
}

export function buildChatPolicyPrompt(): string {
  return [
    formatShippingPolicy(),
    `고객센터 운영시간은 ${formatSupportHours()}입니다.`,
    formatSignupBenefit(),
    '선택한 결제 방식은 데모 주문 기록에만 사용되며 실제 승인·청구가 발생하지 않습니다.',
    `입력한 정보와 주문 기록은 ${COMMERCE_POLICY.demo.dataStore}에 저장될 수 있습니다.`,
    '여기에 없는 혜택, 출고 일정, 결제수단은 추정하거나 약속하지 마세요.',
  ].join('\n');
}
