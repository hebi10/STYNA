# STYNA 1단계 보안·배포 경계

작성일: 2026-09-17

## 목적

1단계에서는 공개 클라이언트 자격 증명 제거, HTTP Function Origin 제한, 서버 내부 오류 비노출을 우선 적용한다. Function 리전은 즉시 변경하지 않고 별도 배포 작업으로 분리한다.

## 데모 로그인

브라우저 코드에 데모 계정 비밀번호를 포함하지 않는다. `/api/demo-login`은 서버에서 데모 계정을 확인한 뒤 Firebase Custom Token만 발급한다.

### 클라이언트 설정

```env
NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true
```

이 값은 데모 로그인 UI 노출 여부만 제어하며 비밀정보가 아니다.

### Functions 설정

```env
ENABLE_DEMO_LOGIN=true
PORTFOLIO_DEMO_USER_UID=
PORTFOLIO_DEMO_USER_EMAIL=
PORTFOLIO_DEMO_ADMIN_UID=
PORTFOLIO_DEMO_ADMIN_EMAIL=
```

UID가 있으면 UID를 우선 사용한다. 이메일은 계정 식별용이며 비밀번호는 Functions 환경변수에도 저장하지 않는다.

일반 회원 데모는 활성 `user` 계정만 허용한다. 관리자 데모는 활성 `demo_admin` 문서와 `demoAdmin=true`, `role=demo_admin` Custom Claims가 모두 일치해야 하며 일반 관리자 claim은 허용하지 않는다.

## HTTP Origin 정책

브라우저에서 직접 접근할 수 있는 HTTP Function은 `functions/src/config/httpPolicy.ts`의 Origin allowlist를 사용한다.

현재 허용 Origin:

- `http://localhost:3000`
- `http://localhost:3001`
- `https://hebimall.firebaseapp.com`
- `https://hebimall.web.app`

새 운영 도메인을 추가할 때는 개별 Function에 `cors: true`를 다시 넣지 않고 공통 allowlist만 수정한다.

Firebase Hosting의 `/api/*` rewrite를 기본 공개 경로로 유지한다. 직접 Cloud Functions URL 호출은 로컬 프록시 또는 운영상 필요한 경우로 제한한다.

## 서버 오류 응답

서버 내부 예외는 `console.error`에 기록하되 5xx 응답에는 stack, 내부 경로, SDK 원문 오류를 포함하지 않는다.

- `nextjsServer`: 고정 `Internal Server Error`
- `demoLogin`: 고정 `Demo login is temporarily unavailable.`
- `points`, `coupon`: 예상하지 못한 500 오류는 고정 메시지 사용

인증 실패나 검증 실패처럼 사용자가 조치할 수 있는 명시적 도메인 오류는 기존 상태 코드와 제한된 메시지를 유지한다.

## Functions 리전 현황

### 데이터

- Firestore: `asia-northeast1`

### 이미 데이터 리전에 배치된 Function

- `syncReviewProductStats`: `asia-northeast1`

### 현재 `us-central1` 유지

- `nextjsServer`
- `order`
- `coupon`
- `points`
- `event`
- `review`
- `qna`
- `adminUsers`
- `config`
- `chat`
- `demoLogin`
- `expirePoints`
- `cleanupExpiredCoupons`

## 리전 전환 결정

HTTP Functions와 Firestore 간 왕복이 많은 `order`, `coupon`, `points`, `event`, `review`, `qna`, `adminUsers`는 `asia-northeast1` 이전 우선 검토 대상으로 지정한다. `nextjsServer`도 한국 사용자 응답시간과 Firestore 접근 비용을 측정한 뒤 동일 리전 이전을 검토한다.

`chat`은 OpenAI 외부 호출 비중이 높으므로 Firestore rate-limit 접근과 외부 API 지연을 함께 측정한 뒤 결정한다. cron 작업은 사용자 응답 경로가 아니므로 우선순위가 낮다.

### 이번 1단계에서 리전을 변경하지 않는 이유

Function 리전을 바꾸면 기존 URL과 Firebase Hosting rewrite, 로컬 프록시 기본 URL, 배포 순서가 함께 영향을 받는다. 따라서 코드의 `region` 문자열만 변경하지 않는다.

향후 리전 이전은 다음 순서로 별도 작업한다.

1. 대상 Function의 신규 리전 배포
2. Hosting rewrite와 로컬 API proxy URL 전환
3. 주요 API 응답시간 및 Firestore 오류 확인
4. 이전 리전 Function 제거
5. rollback URL과 절차 기록

## 1단계 완료 확인

- [ ] 로그인 페이지 번들에 데모 비밀번호 리터럴이 없다.
- [ ] 데모 로그인은 서버 발급 Custom Token을 사용한다.
- [ ] 관리자 데모는 `demo_admin` 경계를 통과해야 한다.
- [ ] 공개 HTTP Function에 `cors: true`가 남아 있지 않다.
- [ ] 5xx 응답이 내부 예외 원문을 노출하지 않는다.
- [ ] 리전 이전 대상과 제외/보류 대상이 문서화되어 있다.
- [ ] 타입체크, lint, 관련 Jest, Functions build를 통과한다.
