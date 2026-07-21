// Generated from src/shared/utils/chatResponses.ts. Run npm run sync:chat-responses:write after editing.
// ─── 채팅 공통 응답 로직 (Next.js 환경) ────────────────
// functions/src/chatResponses.ts 와 내용이 동일합니다.

import {
  buildDemoDataNotice,
  formatShippingPolicy,
  formatSignupBenefit,
  formatSupportHours,
} from './commercePolicy';

export type MenuKey =
  | 'agent'
  | 'order'
  | 'return'
  | 'product'
  | 'coupon'
  | 'size'
  | 'payment'
  | 'member'
  | 'greeting'
  | 'default';

function matchMenu(lower: string): MenuKey {
  const compact = lower.replace(/\s+/g, '');

  if (
    compact === '상담원' + '연결' ||
    lower === '상담원 연결' ||
    lower === '상담 연결' ||
    lower === '상담원' ||
    lower === '실시간 상담' ||
    lower === '담당자 연결'
  ) return 'agent';
  if (lower === '1' || lower.includes('1. 주문') || lower.includes('주문') || lower.includes('배송')) return 'order';
  if (lower === '2' || lower.includes('2. 반품') || lower.includes('반품') || lower.includes('교환')) return 'return';
  if (lower.includes('상품 문의') || lower.includes('상품문의') || lower.includes('상품 질문')) return 'product';
  if (lower === '3' || lower.includes('3. 쿠폰') || lower.includes('쿠폰') || lower.includes('할인')) return 'coupon';
  if (lower === '4' || lower.includes('4. 사이즈') || lower.includes('사이즈') || lower.includes('크기')) return 'size';
  if (lower === '5' || lower.includes('5. 결제') || lower.includes('결제') || lower.includes('카드')) return 'payment';
  if (lower === '6' || lower.includes('6. 회원') || lower.includes('회원') || lower.includes('가입')) return 'member';
  if (lower.includes('안녕') || lower.includes('도움') || lower.includes('문의') || lower.length < 5) return 'greeting';
  return 'default';
}

const RESPONSES: Record<MenuKey, string> = {
  agent: `상담 연결 요청을 확인했습니다.

${formatSupportHours()}에는 순차적으로 확인합니다.
운영시간 외에는 1:1 문의를 남겨주시면 다음 영업일에 답변드리겠습니다.`,

  order: `주문 · 배송 안내

주문 확인: 마이페이지 > 주문내역에서 확인할 수 있습니다.
배송비: ${formatShippingPolicy()}
출고 안내: 확정 일정을 약속하지 않으며 주문별 배송 상태를 확인해 주세요.

추가 문의: 고객센터 sevim0104@naver.com

다른 도움이 필요하시면 번호를 선택하거나 직접 말씀해 주세요.`,

  return: `반품 · 교환 안내

마이페이지 > 주문내역에서 주문 상태를 확인한 뒤 1:1 문의를 남겨주세요.
가능 여부, 접수 기간, 배송비는 상품과 주문 상태를 확인해 개별 안내합니다.

고객센터: sevim0104@naver.com`,

  product: `상품 문의 안내

상품 상세 페이지의 상품문의 또는 QnA에서 문의를 남길 수 있습니다.
색상, 사이즈, 재입고, 소재 정보처럼 상품별 확인이 필요한 내용은 상품명을 함께 남겨주세요.

빠른 확인 경로
- 상품문의: 하단 상품문의 바로가기
- 1:1 문의: 고객센터 > 1:1 문의
- 운영시간: ${formatSupportHours()}`,

  coupon: `쿠폰 · 할인 혜택 안내

현재 구현된 공통 혜택
- ${formatSignupBenefit()}
- ${formatShippingPolicy()}

쿠폰 확인: 마이페이지 > 쿠폰함
화면에 실제 발급된 쿠폰과 사용 조건을 기준으로 확인해 주세요.`,

  size: `사이즈 가이드

의류: 상품 상세 페이지 내 사이즈표 및 모델 착용 정보 참고
신발: 230~280mm (5mm 단위 제공, 브랜드별 핏 정보 제공)

사이즈 교환
- 가능 여부와 비용은 상품 및 주문 상태 확인 후 안내

정확한 사이즈 상담은 상담 연결 버튼을 이용해 문의해 주세요.`,

  payment: `결제 방법 안내

선택한 결제 방식은 데모 주문 기록에만 사용되며 실제 승인·청구가 발생하지 않습니다.
${buildDemoDataNotice()}

결제 오류 발생 시 고객센터(sevim0104@naver.com) 또는
상담 연결 버튼으로 문의해 주세요.`,

  member: `회원 혜택 안내

신규 회원 혜택
- ${formatSignupBenefit()}

그 외 혜택은 마이페이지에 실제 발급된 쿠폰과 포인트를 기준으로 확인해 주세요.`,

  greeting: `안녕하세요, STYNA 고객 지원팀입니다.

아래 번호를 선택하시거나 직접 문의 내용을 입력해 주세요.

1. 주문 · 배송 문의
2. 반품 · 교환 안내
3. 쿠폰 · 할인 혜택
4. 사이즈 가이드
5. 결제 방법 안내
6. 회원 혜택 정보

상담이 필요하면 상담 연결 버튼을 선택해 주세요.`,

  default: `문의 내용을 확인했습니다.

빠른 답변을 원하시면 아래 번호를 선택해 주세요.

1. 주문 · 배송  2. 반품 · 교환  3. 쿠폰 · 할인
4. 사이즈 가이드  5. 결제 방법  6. 회원 혜택

1:1 맞춤 상담: 상담 연결 버튼 선택
고객센터: sevim0104@naver.com (${formatSupportHours()})`,
};

/** useAI = false 일 때 메뉴 기반 응답 */
export function getMenuResponse(message: string): string {
  const lower = message.toLowerCase().trim();
  return RESPONSES[matchMenu(lower)];
}

/** API 키 없는 환경에서의 AI 대체 응답 */
export function getAIFallbackResponse(message: string): string {
  const lower = message.toLowerCase().trim();
  const key = matchMenu(lower);

  if (key !== 'default' && key !== 'greeting' && key !== 'agent') {
    return RESPONSES[key];
  }

  return `안녕하세요, STYNA 고객 지원팀입니다.

말씀하신 내용을 확인했습니다. 더 정확한 답변을 드리려면 아래
항목 중 해당하시는 번호를 선택해 주시거나, 구체적인 내용을
알려주시면 빠르게 안내드리겠습니다.

1. 주문 · 배송  2. 반품 · 교환  3. 쿠폰 · 할인
4. 사이즈 가이드  5. 결제 방법  6. 회원 혜택

고객센터: sevim0104@naver.com`;
}
