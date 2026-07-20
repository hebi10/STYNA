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

# 개발 환경
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NODE_ENV=development
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true
```

`OPENAI_API_KEY` 또는 `CHAT_RATE_LIMIT_SALT`가 없으면 provider를 호출하지 않고 키워드 기반 응답 시스템으로 동작합니다.

## Firebase Functions Secrets

Cloud Functions에서 사용하는 환경변수는 Firebase Secrets로 관리합니다.

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
| `CHAT_API_URL` | 선택 | 로컬 Next `/api/chat`이 호출할 절대 Function/에뮬레이터 URL |
| `NEXT_PUBLIC_API_URL` | 선택 | API 기본 URL (기본값: `/api`) |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATOR` | 선택 | Firebase 에뮬레이터 사용 여부 |

`NEXT_PUBLIC_` 접두사 변수는 클라이언트에 노출되므로 민감한 키에는 사용하지 않습니다.

## 보안

- `.env.local`은 `.gitignore`에 포함되어 있으며 Git에 커밋하지 않습니다.
- `OPENAI_API_KEY`와 `CHAT_RATE_LIMIT_SALT`는 `chat` Function에서만 사용합니다. `NEXT_PUBLIC_` 접두사를 붙이지 않습니다.
- `CHAT_RATE_LIMIT_SALT`는 OpenAI API 키와 다른 임의 값을 사용하며 로그·응답·문서에 실제 값을 남기지 않습니다.
- 프로덕션에서는 Firebase Functions Secrets를 사용합니다.

## 문제 해결

```bash
# Functions 환경변수 확인
firebase functions:secrets:access SECRET_NAME
firebase functions:secrets:list

# 클라이언트 설정 캐시 초기화
import { clearConfigCache } from '@/shared/services/configService';
clearConfigCache();
```

`chat` Function에서 secret이 없거나 읽히지 않으면 OpenAI provider를 호출하지 않고 규칙 기반 답변으로 종료합니다.

## OpenAI API 키 발급

1. [OpenAI Platform](https://platform.openai.com/) 접속
2. API 섹션에서 새 키 생성
3. 생성된 키를 `OPENAI_API_KEY`에 설정

관련 설정: `functions/src/handlers/chat.ts` — provider 호출과 서버 사용량 제한. `src/app/api/chat/route.ts` — 로컬 Function 프록시와 규칙 기반 fallback.
