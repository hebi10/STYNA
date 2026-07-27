# 상거래 정책과 데모 범위

## 기준 소스와 Functions 생성물

- `src/shared/constants/commercePolicy.ts`가 가입 혜택, 배송비, 고객 지원 시간, 데모 고지의 canonical source다.
- `functions/src/commercePolicy.ts`는 canonical source에서 생성되는 Functions 전용 파일이다. 직접 수정하지 않고 `scripts/sync-chat-responses.js`의 `writeGeneratedCommerceSources()`로만 갱신한다.
- 기본 `npm run sync:chat-responses`는 `checkGeneratedCommerceSources()`를 호출하는 compare-only 검증이다. 명시적 `npm run sync:chat-responses:write`만 `functions/src/commercePolicy.ts`와 `functions/src/chatResponses.ts`를 갱신한다.
- 채팅 응답도 `src/shared/utils/chatResponses.ts`를 원본으로 하고 `functions/src/chatResponses.ts`를 생성물로 유지한다. Functions의 AI 정책 프롬프트는 생성된 `buildChatPolicyPrompt()`를 사용한다.

## 구현된 정책

- 가입 완료 혜택은 `COMMERCE_POLICY.signupBonusPoints`와 `formatSignupBenefit()` 기준 **5,000P**다.
- 가입 직후 보너스 API 확인이 실패하면 계정 생성 성공과 포인트 동기화 실패를 구분해 다시 확인할 수 있다. 이후 활성 로그인 세션에서도 서버 marker가 없는 UID를 자동 조정한다.
- 최종 지급 여부는 서버의 `users/{uid}.signupBonusGrantedAt` marker, 잔액, 포인트 내역을 함께 갱신하는 transaction이 판정한다. 같은 UID의 재시도는 기존 잔액을 반환하며 중복 지급하지 않는다. marker 도입 전의 canonical source 또는 `신규 회원가입 적립` 5,000P 내역은 잔액을 다시 올리지 않고 marker만 보강한다.
- 일반 배송비는 **3,000원**이다. `formatShippingPolicy()` 기준 쿠폰 할인 후 상품금액이 **50,000원 이상**이거나 무료배송 쿠폰을 적용하면 일반 배송비가 무료다.
- 특급 배송 옵션은 주문금액과 무료배송 쿠폰에 관계없이 **5,000원**으로 계산한다. 이는 실제 배송 속도나 출고 시점을 보장하는 서비스가 아니다.

## 포트폴리오 데모 경계

- 실제 PG 승인·청구·환불과 실제 택배 접수·배송 서비스는 연동되어 있지 않다. 선택한 결제·배송 방식은 데모 주문 기록에 사용된다.
- 비로그인 사용자가 장바구니에 접근하면 자동으로 이동시키지 않고 로그인 또는 쇼핑 계속하기를 고르는 권한 안내를 제공한다. 로그인 CTA는 same-origin redirect 경로 `/auth/login?redirect=/orders/cart`를 사용한다.
- 화면에서 입력한 회원 정보, 배송지와 주문 기록은 **Firebase에 저장될 수 있다**.
- 주문 상태와 운송장 표시는 저장된 데모 데이터 조회이며, 실제 배송 추적이나 배송 시점 보장이 아니다.
- 화면의 `평일 10:00~18:00`은 포트폴리오 UI 구성용 참고 시간이다. 도움말 챗봇은 사람 상담을 연결하거나 요청을 전송하지 않으며 응답 SLA를 제공하지 않는다.
- 상품 QnA와 1:1 문의는 로그인 사용자의 문의 기록을 Firebase에 저장하고 상태를 조회하는 데모다. 답변·교환·반품·취소 처리 여부와 시점은 보장하지 않는다.
- 이용 안내와 개인정보 안내 페이지는 포트폴리오 데모 범위를 설명하기 위한 화면이며 실제 이용약관 또는 개인정보처리방침 체결을 대신하지 않는다.

## 공개 콘텐츠 검증 경계

- FAQ와 공지의 기존 검토 완료 ID는 코드의 안전한 문구로 치환한다. 그 밖의 Firestore 문서는 `publicPolicyVerified: true`일 때만 사이트 서비스 계층에서 노출한다.
- 이벤트는 Firestore Rules와 공개 전용 조회가 모두 `publicPolicyVerified: true`인 문서만 허용한다. 목록·상세·메타데이터·참여 Function도 같은 fail-closed 계약을 사용한다.
- 관리자 편집이나 이미지 일괄 전환으로 이벤트 내용이 바뀌면 공개 검증 값을 다시 `false`로 돌린다. 운영자가 최종 문구·자격·보상·이미지를 확인하고 명시적으로 재검증하기 전에는 공개하면 안 된다.

## 구현 사실로 안내하면 안 되는 항목

- 생일 쿠폰, 등급별 혜택·적립, 구매 금액의 1% 자동 적립
- 카카오페이, 네이버페이, 페이코, 토스페이 등 간편결제 연동
- 당일 발송·당일 출고·당일 배송 또는 보장된 배송 SLA
- 실제 결제 승인·청구·환불과 실제 택배 접수·실시간 배송 추적
- 사람 상담 연결, 보장된 문의 답변·취소·교환·반품 처리 또는 고객지원 SLA
- 법적 효력이 있는 실제 이용약관·개인정보처리방침이라는 주장
- 코드와 정책 문서에 없는 추가 혜택, 결제수단 또는 출고 일정
