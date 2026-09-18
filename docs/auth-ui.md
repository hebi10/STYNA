# 인증 화면 UI 문서

## 대상 파일
- `src/app/auth/layout.module.css`
- `src/app/auth/login/page.module.css`
- `src/app/auth/signup/page.module.css`
- `src/app/auth/find-password/page.module.css`
- `src/app/auth/reset-password/page.module.css`

## 2026-05-12 정리 사항
- 인증 레이아웃 배경을 메인과 같은 `var(--off-white)` 기준으로 맞추고, 카드형 폼은 흰 배경 + 얇은 보더 + 2px radius로 정리했다.
- 회원가입, 비밀번호 찾기, 비밀번호 재설정 화면의 보라색 그라데이션, 큰 radius, 강한 그림자, 배경 장식 요소를 하단 override로 눌렀다.
- 버튼과 입력 focus는 검정 액션과 `var(--action-soft)` 링 기준으로 맞췄다.

## 작업 시 주의
- 2026-07-20: 실제 이메일 찾기 백엔드 동작이 없어 `/auth/find-email` 경로와 전용 파일을 제거하고, 로그인 화면에는 비밀번호 재설정 링크만 유지한다.
- 인증 화면은 기능 구현보다 신뢰감과 가독성이 우선이므로, 배경 장식과 컬러 테마를 새로 늘리지 않는다.
- 회원가입·비밀번호 찾기·비밀번호 재설정은 공용 auth 카드 폭을 유지한다. 로그인 화면만 포트폴리오 진입형 2열 레이아웃을 위해 별도 폭을 사용한다.
- 2026-06-05: `/auth/*` 경로에서는 우측 하단 쇼핑 안내/도움말 챗봇 플로팅 UI를 렌더링하지 않는다. 모바일 로그인 카드와 하단 회원가입 CTA가 플로팅 버튼에 눌리지 않게 하기 위한 정책이다.
- 2026-06-11: 로그인 제출 또는 이미 로그인된 사용자의 `/auth/login` 진입 시 카드 위에 “마이페이지 준비 중” 전환 오버레이를 표시한다. 인증 확인과 라우팅 대기 시간을 멈춤처럼 보이지 않게 하기 위한 처리다.
- 2026-06-22: `/auth/login?redirect=/orders/checkout`처럼 내부 redirect 쿼리가 있으면 로그인 성공 후 해당 경로를 우선 사용한다.
- 2026-08-12: 일반 회원·읽기 전용 관리자 빠른 로그인은 `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true`인 포트폴리오 데모 빌드에서만 “포트폴리오 데모 로그인” 영역으로 렌더링한다. 일반 운영 배포에서는 환경변수를 생략하거나 `false`로 둔다.

## 2026-07-21 same-origin redirect와 상품 의도 복원

- `src/shared/utils/safeRedirect.ts`의 `getSafeRedirectTarget(candidate, origin, fallback = '/mypage')`은 `new URL()`로 후보를 파싱하고 `parsed.origin === expectedOrigin`인 exact same-origin 경로만 `pathname + search + hash` 형태로 반환한다.
- 외부 origin, protocol-relative URL, backslash가 있는 값, `javascript:` 또는 malformed URL은 모두 `/mypage` fallback으로 보낸다. 로그인 화면은 검증된 값만 `router.replace()`에 전달한다.
- `src/shared/utils/productIntent.ts`의 `PRODUCT_INTENT_TTL_MS`는 10분이다. `saveProductIntent()`는 `cart | buy | wishlist`, 상품·경로·옵션·수량과 version/생성 시각을 `sessionStorage`에 저장한다.
- `consumeProductIntent()`는 저장값을 읽은 직후 storage key를 먼저 삭제하고 그 뒤 JSON schema와 TTL을 검증한다. 실제 장바구니·바로구매·찜 action보다 먼저 consume하므로 성공·실패와 무관하게 새로고침으로 자동 재실행되지 않는 one-shot이다.
- `ProductDetailClient`의 `redirectToLoginWithIntent()`는 원 상품 URL에 `resumeIntent=1`을 붙여 로그인으로 보낸다. 복귀 effect는 현재 상품 ID/경로, 선언된 size/color, 양수 수량과 재고를 확인한 뒤 한 번만 실행한다.
- intent가 없거나 malformed/expired/mismatch이거나 옵션·재고가 유효하지 않으면 상품 상세에 머물며 `옵션을 다시 선택해 주세요.`를 표시한다.
- `EventDetailClient`의 `handlePrimaryCta()`는 비로그인 참여 시 현재 `/events/{eventId}`를 encoded `redirect`로 전달한다. 로그인 후 원 이벤트로 복귀하지만 참여 action을 자동 재실행하지는 않는다.

## 2026-07-21 회원가입 고지와 보너스 복구

- 회원가입 동의 항목은 실제 법률 약관 체결로 오해되지 않도록 포트폴리오 데모 이용 안내와 개인정보 저장 안내로 표시한다.
- 가입 계정 생성과 5,000P 지급 확인은 별도 상태로 다룬다. 보너스 확인이 실패하면 가입 완료로 바로 이동하지 않고 같은 화면에서 재시도할 수 있게 한다.
- 로그인 세션의 자동 보너스 조정은 서버의 idempotent marker와 legacy 이력 확인을 최종 권위로 사용한다. marker만 없다는 이유로 기존 가입 보너스를 다시 지급하면 안 된다.

## 2026-09-18 포트폴리오 체험 로그인

- `/auth/login`은 이메일·비밀번호 로그인과 별도의 `PORTFOLIO DEMO` 체험 영역을 제공한다.
- 데모 빌드에서는 버튼명을 `일반 사용자 체험`, `관리자 페이지 체험`으로 표시해 실제 소셜 로그인이나 운영 관리자 로그인과 구분한다.
- 두 체험 경로는 `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true`일 때만 노출하고, 클라이언트 자격 증명 대신 서버 `demoLogin` Function이 발급한 Custom Token으로 로그인한다.
- 관리자 체험은 로그인 전부터 `조회 전용 · 운영 데이터 변경 없음`을 명시하며, 실제 `admin`과 분리된 `demo_admin` 역할 및 `demoAdmin` token claim을 사용한다.
- 데모 로그인 중에는 선택한 역할에 맞는 상태 문구를 표시하고 두 체험 버튼을 함께 비활성화해 중복 요청을 막는다.
- 관리자 데모 성공 후 인증 상태 effect가 다시 실행되더라도 이동 목적지는 `/admin`으로 유지한다.
- 실제 관리자 데이터 변경은 Firebase 재인증 뒤 갱신된 ID token의 `auth_time`이 5분 이내일 때만 Rules·Functions에서 허용한다.

## 2026-09-18 로그인 포트폴리오 진입형 레이아웃

- 로그인 화면을 가운데 단일 카드에서 데스크톱 2열 구조로 변경했다.
- 좌측은 STYNA 프로젝트 소개와 쇼핑·주문·관리자 영역을 보여주고, 우측은 기존 계정 로그인과 데모 체험 진입을 배치한다.
- 기존 로그인, same-origin redirect, 로그인 상태 유지, Custom Token 기반 데모 로그인, 역할별 전환 오버레이 동작은 유지한다.
- 공용 auth 레이아웃은 `data-auth-page="login"` 하위가 있을 때만 최대 폭을 1160px로 확장하고 상단 공용 로고를 숨긴다. 다른 인증 화면의 420px 카드 구조는 변경하지 않는다.
- 데스크톱은 2열, 1024px 이하에서는 1열로 전환한다. 추가 장식, 그라데이션, 큰 radius, 그림자는 사용하지 않는다.

## 2026-07-27 인증 화면 시각 문법 통일

- 비밀번호 찾기·재설정과 회원가입의 제목은 단색 `var(--black)`으로 통일하고, 그라데이션 텍스트를 제거했다.
- 비밀번호 찾기·재설정 성공 표시는 bounce 애니메이션 없이 즉시 표시한다. 기존 성공·오류 문구와 폼·focus 동작은 유지한다.
