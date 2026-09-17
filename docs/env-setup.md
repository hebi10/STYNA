# 환경변수 설정

## .env.local

프로젝트 루트에 `.env.local` 파일을 생성합니다.

```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# OpenAI (AI 챗봇 상담용)
OPENAI_API_KEY=your_openai_api_key
CHAT_RATE_LIMIT_SALT=your_random_rate_limit_salt
OPENAI_CHAT_MODEL=gpt-4o-mini

# Next /api/chat -> Firebase chat Function
CHAT_API_URL=https://us-central1-your_project_id.cloudfunctions.net/chat
# 레거시 호환 전용. 신규 설정은 CHAT_API_URL을 사용합니다.
# NEXT_PUBLIC_CHAT_API_URL=https://us-central1-your_project_id.cloudfunctions.net/chat

# 개발 환경
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NODE_ENV=development
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true
# 포트폴리오 데모 배포에서만 로그인 화면의 데모 버튼 노출
NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true
```

`OPENAI_API_KEY` 또는 `CHAT_RATE_LIMIT_SALT`가 없으면 provider를 호출하지 않고 키워드 기반 응답 시스템으로 동작합니다. `OPENAI_CHAT_MODEL`을 생략하면 `gpt-4o-mini`를 사용합니다.

## 데모 로그인 서버 설정

`NEXT_PUBLIC_ENABLE_DEMO_LOGIN`은 UI 노출만 제어합니다. 실제 Custom Token 발급은 Firebase `demoLogin` Function의 서버 전용 `ENABLE_DEMO_LOGIN=true`가 별도로 설정되어야 합니다.

배포 환경에서는 Functions의 비밀이 아닌 환경변수 설정 방식으로 다음 값을 제공합니다. 실제 UID·이메일 값은 저장소 문서에 기록하지 않습니다.

```env
ENABLE_DEMO_LOGIN=true
PORTFOLIO_DEMO_USER_UID=
PORTFOLIO_DEMO_USER_EMAIL=
PORTFOLIO_DEMO_ADMIN_UID=
PORTFOLIO_DEMO_ADMIN_EMAIL=
```

- 일반 회원 데모는 활성 `user` 계정만 허용합니다.
- 관리자 데모는 활성 `demo_admin` 사용자 문서와 `demoAdmin=true`, `role=demo_admin` Custom Claims가 모두 일치해야 합니다.
- 일반 관리자(`admin`) 계정은 관리자 데모로 사용할 수 없습니다.
- UID를 설정하면 UID를 우선 사용하고, UID가 없을 때만 이메일로 계정을 조회합니다.
- 데모 비밀번호는 클라이언트 코드나 Functions 환경변수에 저장하지 않습니다.

로컬에서 Functions Emulator를 사용할 때도 UI 플래그와 서버 플래그를 각각 설정해야 합니다.

## Firebase Functions Secrets

Cloud Functions에서 사용하는 민감한 환경변수는 Firebase Secrets로 관리합니다.

### 설정 방법

```bash
# Firebase CLI 로그인 (최초 1회)
firebase login

# 환경변수 설정 스크립트 실행
node scripts/setup-firebase-secrets.js

# Functions 배포
# Firebase predeploy가 Next 빌드·복사·경계 검증·Functions 빌드를 순서대로 수행합니다.
npm run deploy:functions
```

### Functions에서 사용

```typescript
import { onRequest } from 'firebase-functions/v2/https';
import { secrets } from './config/environment';

export const chat = onRequest(
  {
    secrets: [secrets.OPENAI_API_KEY, secrets.CHAT_RATE_LIMIT_SALT],
  },
  async (request, response) => {
    // 실제 handler 안에서만 secret.value()를 읽고 rate-limit 후 provider를 호출합니다.
  },
);
```

### 클라이언트에서 사용

```typescript
import { getFirebaseConfig } from '@/shared/services/configService';

const firebaseConfig = await getFirebaseConfig();
```

## 환경변수 목록

| 환경변수 | 필수 | 설명 |
|---------|------|------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | 필수 | Firebase API 키 |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | 필수 | Firebase Auth 도메인 |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | 필수 | Firebase 프로젝트 ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | 필수 | Firebase Storage 버킷 |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | 필수 | Firebase 메시징 센더 ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | 필수 | Firebase 앱 ID |
| `OPENAI_API_KEY` | 선택 | OpenAI API 키 (없으면 키워드 응답 모드) |
| `CHAT_RATE_LIMIT_SALT` | AI 사용 시 필수 | UID·익명 세션·네트워크 식별자를 HMAC-SHA256으로 해시하는 별도 고엔트로피 secret |
| `OPENAI_CHAT_MODEL` | 선택 | Firebase `chat` Function이 사용할 모델명 (기본값: `gpt-4o-mini`) |
| `CHAT_API_URL` | Next 프록시 사용 시 필수 | Next `/api/chat`이 호출할 배포된 Firebase `chat` Function 또는 로컬 Functions Emulator의 절대 URL |
| `NEXT_PUBLIC_CHAT_API_URL` | 레거시 호환 | 과거 Next 서버 upstream 변수. 브라우저 직접 호출에는 사용하지 않으며 신규 설정은 `CHAT_API_URL`을 사용 |
| `NEXT_PUBLIC_API_URL` | 선택 | API 기본 URL (기본값: `/api`) |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATOR` | 선택 | Firebase 에뮬레이터 사용 여부 |
| `NEXT_PUBLIC_ENABLE_DEMO_LOGIN` | 포트폴리오 데모 배포에서만 | 정확히 `true`일 때 로그인 화면의 일반 회원·읽기 전용 관리자 데모 버튼을 노출. 서버 발급 권한은 부여하지 않음 |
| `ENABLE_DEMO_LOGIN` | 포트폴리오 데모 Functions에서만 | 정확히 `true`일 때 `demoLogin` Function의 Custom Token 발급을 허용 |
| `PORTFOLIO_DEMO_USER_UID` | 데모 회원 사용 시 선택 | 일반 회원 데모 계정 UID. 설정하면 이메일보다 우선 |
| `PORTFOLIO_DEMO_USER_EMAIL` | 데모 회원 사용 시 선택 | UID가 없을 때 일반 회원 데모 계정 조회에 사용 |
| `PORTFOLIO_DEMO_ADMIN_UID` | 데모 관리자 사용 시 선택 | 읽기 전용 데모 관리자 UID. 설정하면 이메일보다 우선 |
| `PORTFOLIO_DEMO_ADMIN_EMAIL` | 데모 관리자 사용 시 선택 | UID가 없을 때 읽기 전용 데모 관리자 계정 조회에 사용 |

`NEXT_PUBLIC_` 접두사 변수는 클라이언트에 노출되므로 민감한 키에는 사용하지 않습니다.

## 보안

- `.env.local`은 `.gitignore`에 포함되어 있으며 Git에 커밋하지 않습니다.
- `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true`는 로그인 UI만 노출합니다. 서버 Custom Token 발급은 이 값만으로 활성화되지 않습니다.
- `ENABLE_DEMO_LOGIN=true`는 포트폴리오 데모 Functions 배포에서만 사용합니다. 일반 운영 배포에서는 생략하거나 `false`로 둡니다.
- 데모 UID·이메일은 서버가 계정을 식별하기 위한 값이며, 비밀번호는 저장하거나 클라이언트로 전달하지 않습니다.
- 관리자 데모는 실제 관리자 claim을 가지지 않는 `demo_admin` 전용 주체를 사용합니다.
- `OPENAI_API_KEY`와 `CHAT_RATE_LIMIT_SALT`는 `chat` Function에서만 사용합니다. `NEXT_PUBLIC_` 접두사를 붙이지 않습니다.
- `CHAT_RATE_LIMIT_SALT`는 OpenAI API 키와 다른 임의 값을 사용하며 로그·응답·문서에 실제 값을 남기지 않습니다.
- 원본 UID, 익명 session ID, IP는 rate-limit 문서나 로그에 남기지 않고 HMAC 결과만 저장합니다.
- 운영 `CHAT_API_URL`은 자체 `/api/chat`이 아니라 배포된 Firebase `chat` Function을 가리켜야 합니다. Hosting rewrite가 Function으로 직접 연결되는 배포에서는 이 변수 없이도 same-origin `/api/chat`이 Function에 도달합니다.
- `NEXT_PUBLIC_CHAT_API_URL`은 URL 자체가 클라이언트에 노출되는 레거시 호환 변수입니다. 비밀값을 넣지 않고 가능하면 서버 전용 `CHAT_API_URL`을 사용합니다.
- 민감한 값은 Firebase Functions Secrets를 사용합니다.

## 문제 해결

```bash
# Functions 환경변수/Secret 설정 확인은 실제 값을 출력하지 않는 방식으로 수행합니다.
firebase functions:secrets:list

# 클라이언트 설정 캐시 초기화
import { clearConfigCache } from '@/shared/services/configService';
clearConfigCache();
```

`chat` Function에서 secret이 없거나 읽히지 않으면 OpenAI provider를 호출하지 않고 규칙 기반 답변으로 종료합니다.

## OpenAI API 키 발급

1. OpenAI Platform 접속
2. API 섹션에서 새 키 생성
3. 생성된 키를 `OPENAI_API_KEY` Secret으로 설정

관련 설정: `functions/src/handlers/chat.ts` — provider 호출과 서버 사용량 제한. `src/app/api/chat/route.ts` — 로컬 Function 프록시와 규칙 기반 fallback.
