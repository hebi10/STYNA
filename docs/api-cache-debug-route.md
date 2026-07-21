# API 캐시 정책 및 디버그 라우트 정리

## 변경 범위
- `middleware.ts`
- `src/app/api/chat/route.ts`
- `src/app/api/debug/firebase/route.ts` 제거

## 작업 요약
- `/api/*`는 기본적으로 사용자별 응답/민감 응답 캐시가 섞이지 않도록 `no-store` 정책을 기본 적용하도록 변경.
- 공개 캐시가 필요한 API는 `middleware.ts`의 `API_PUBLIC_CACHE_RULES`에 명시적으로 추가할 수 있도록 템플릿 정리.
- `/api/debug/firebase` 라우트를 제거해 운영 노출 가능한 데이터 덤프 경로를 삭제.
- `/api/chat` 응답에 대해 라우트 레벨에서도 `no-store` 헤더를 명시해서 캐시 안전성 보강.
- 2026-05-12: 실시간 상담 목적 선택에 `상품 문의`를 추가하고 Next/API Functions 공통 응답 파일을 함께 갱신했다.
- 2026-05-12: 실시간 상담의 상담 연결 intent를 버튼/자연어 중심으로 정리하고, 과거 붙임 명령어는 내부 호환만 처리하도록 Next/API Functions 공통 응답 파일을 함께 갱신했다.
- 2026-05-12: `/api/order`는 주문 생성 외 관리자 주문 상태 변경 액션을 처리하며, `/api/coupon`은 관리자 쿠폰 마스터 생성/수정/보관 액션을 처리한다. 두 API 모두 인증 토큰 기반 민감 응답이라 `no-store` 대상이다.
- 2026-05-14: `/api/chat`은 `CHAT_API_URL` 또는 레거시 호환용 `NEXT_PUBLIC_CHAT_API_URL`이 절대 URL이면 upstream 상담 API로 no-store 프록시한 뒤 실패 시 기존 메뉴/fallback 응답으로 돌아간다. 운영 `CHAT_API_URL`은 배포된 Firebase `chat` Function을 가리켜야 한다.
- 2026-05-14: 실시간 상담 위젯은 브라우저 CORS 차단을 피하도록 항상 same-origin `/api/chat`만 호출한다. 당시에는 upstream이 없을 때 Next route가 OpenAI를 직접 호출했으나, 아래 2026-07-20 보안 경계로 대체되었다.
- 2026-05-14: `NEXT_PUBLIC_CHAT_API_URL`은 클라이언트 직접 호출용이 아니라 Next `/api/chat`의 서버 측 upstream 프록시 후보로만 사용한다.
- 2026-05-14: Firebase Hosting의 `/api/chat` rewrite가 사용하는 Functions `chat`도 기본 모델을 `gpt-4o-mini`로 맞추고, OpenAI 호출 실패 시 문의 내용 기반 fallback 응답을 반환하도록 보정했다.

## 검증
- `rg --files src/app/api` 결과 경로 확인:
  - 현재 App Router API에는 chat 외에도 admin users, coupon, event participate, order, points, QnA public/verify-secret, review 프록시가 있다.
  - `/api/debug/firebase` 라우트 파일 삭제 확인
- Next App Router API 캐시 정책은 `middleware.ts`의 `matcher: ['/api/(.*)']`를 통해 응답 헤더에 적용한다. Firebase Hosting의 개별 Function rewrite는 middleware를 우회하므로 민감 Function handler도 직접 `no-store` 헤더를 설정한다.
- 민감 API 기본 헤더:
  - `Cache-Control: no-store, max-age=0`
  - `Pragma: no-cache`
  - `Expires: 0`
- 2026-05-14 검증:
  - `npm test -- --runTestsByPath src/app/_components/chat/ChatWidget.test.tsx --runInBand`: 통과.
  - `npm test -- --runTestsByPath src/app/api/chat/route.test.ts --runInBand`: 통과.
  - `npm run typecheck`: 통과.
  - `npm run functions:build`: 통과.
- 2026-05-14 추가 검증:
  - `npm test -- --runTestsByPath src/app/_components/chat/ChatWidget.test.tsx --runInBand`: 통과.
  - `npm test -- --runTestsByPath src/app/api/chat/route.test.ts --runInBand`: 통과.
  - `npm run typecheck`: 통과.
  - `npm run lint`: 통과, 기존 warning 254개 잔존.
- 2026-05-14 상담 경로 복구 검증:
  - `npm test -- --runTestsByPath src/app/_components/chat/ChatWidget.test.tsx src/app/api/chat/route.test.ts --runInBand`: 통과.
  - `npm run typecheck`: 통과.
  - `npm run functions:build`: 통과.
- 2026-06-22 상담 API 입력 방어 검증:
  - Next `/api/chat`과 Functions `chat`에서 메시지 길이 상한, 대화 기록 개수 상한, `user`/`assistant` 외 role 제거를 공통 적용했다.
  - 포트폴리오/개인 연락처 안내 문구는 면접관 확인 목적이 있어 유지하되, 사용자 입력이 시스템 role로 주입되지 않도록 방어했다.
  - `npm test -- --runTestsByPath src/app/api/chat/route.test.ts --runInBand`: 통과.

## 2026-07-20 상담 provider·사용량 제한 경계

- OpenAI provider 호출은 Firebase `chat` Function 한 곳에서만 수행한다. Next `/api/chat`은 명시된 절대 upstream으로만 프록시하며, upstream 미설정·자기 참조·장애 시 규칙 기반 답변으로 대체한다.
- Widget은 안정적인 `X-Chat-Session-Id`를 항상 보내고 로그인 상태에서는 Firebase ID token을 `Authorization: Bearer`로 함께 보낸다. 토큰 취득 실패 시 익명 provider 요청으로 낮추지 않는다.
- Function은 인증 UID 또는 익명 세션과 `req.ip`를 `CHAT_RATE_LIMIT_SALT` HMAC-SHA256으로 해시한다. 원본 UID·세션·IP를 저장하거나 로그에 남기지 않고 principal/network 두 축에 분당 10회·일 100회 제한을 한 Firestore transaction으로 적용한다.
- 저장된 counter 스키마가 손상됐거나 transaction이 실패하면 제한을 초기화해 provider를 허용하지 않는다. 요청은 규칙 기반 답변으로 종료해 limiter 장애가 우회 경로가 되지 않게 한다.
- `useAI: false` 메뉴 응답은 provider 사용량을 소비하지 않아 세션·counter가 필요 없지만, 명시적으로 전달된 Authorization은 같은 활성 계정 계약으로 검증한다.
- 초과 응답은 `429`, `Retry-After`, `retryAfterSeconds`를 반환한다. Next 프록시는 이 상태·본문·헤더를 보존하며 다른 upstream 실패에서 provider를 재호출하지 않는다.
- Next 프록시는 `Authorization`과 `X-Chat-Session-Id`만 식별 헤더로 전달하며 cookie, `X-Forwarded-For`, 기타 요청 헤더는 전달하지 않는다. 모든 응답은 `no-store`다.
- `OPENAI_API_KEY` 또는 `CHAT_RATE_LIMIT_SALT`가 없거나 제한 저장소가 실패하면 provider를 호출하지 않고 규칙 기반 답변을 반환한다.
- 명시된 bearer token이 유효하지 않으면 Firebase Function은 익명 세션으로 낮추지 않고 401/403을 반환한다. Next 프록시는 429가 아닌 upstream 실패를 규칙 기반 200 응답으로 대체할 수 있지만, 이 경우에도 익명 provider 호출이나 재시도는 하지 않는다. 운영에서 Next 프록시를 사용할 때 `CHAT_API_URL`은 자체 `/api/chat`이 아닌 Firebase `chat` Function의 절대 URL이어야 한다.

## 남은 작업
- 사용자 대상 공개 API 목록 확정 시 `API_PUBLIC_CACHE_RULES`에 개별 엔드포인트 등록 및 revalidate 값 조정.

## 2026-06-12 로컬 API 프록시 보강
- Firebase Hosting rewrite에만 있던 `/api/points`, `/api/coupon`, `/api/admin/users`, `/api/qna/verify-secret`를 로컬 Next dev에서도 동작하도록 App Router API route로 추가했다.
- 네 라우트는 `src/app/api/_lib/functionProxy.ts`의 공통 no-store 프록시를 사용해 인증 헤더와 JSON body를 대응 Cloud Function으로 전달한다.
- 인증 없는 확인 요청은 더 이상 404 HTML이 아니라 Functions의 JSON 응답(예: 401 또는 도메인 404)을 반환한다.
