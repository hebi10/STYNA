# 품질 게이트/CI 스크립트 정리

## 목적
- Next 15 프로젝트의 lint는 `next lint` 대신 ESLint CLI와 `eslint.config.mjs`를 기준으로 실행한다.
- CI는 타입체크, lint, Jest, Firestore·Storage Rules Emulator, Functions 빌드를 분리된 스크립트로 검증한다.

## 스크립트
- `npm run typecheck`: 루트 `tsconfig.json` 기준 TypeScript 검증. `.next`/tsbuildinfo 캐시 흔들림을 피하기 위해 `--incremental false`를 사용한다.
- `npm run lint`: `eslint .` 실행.
- `npm run lint:fix`: `eslint . --fix` 실행.
- `npm test`: Jest 전체 테스트를 `--runInBand`로 실행해 Windows spawn 오류 가능성을 낮춘다.
- `npm run test:functions`: `functions/__tests__`만 실행.
- `npm run test:rules`: Firestore·Storage Rules Emulator 권한 테스트를 실행한다. Java 또는 Emulator 실행 환경이 없거나 테스트가 실패하면 품질 게이트도 실패한다.
- `npm run ci`: `typecheck -> lint -> test -> test:rules -> functions:build` 순서로 실행.
- `npm run verify`: `typecheck -> lint -- --max-warnings=0 -> test -> test:rules -> functions:build -> build` 순서로 배포 전 전체 검증을 실행한다.
- `npm run sync:chat-responses`: 공통 채팅 응답 생성물이 원본과 같은지만 확인하며 파일을 수정하지 않는다.
- `npm run sync:chat-responses:write`: 공통 채팅 응답 생성물을 명시적으로 갱신한다.
- `npm run functions:build`: 채팅 응답 compare-only 검사를 통과한 뒤 Functions TypeScript를 빌드한다.
- `npm run deploy:prep`: 최신 Next 빌드를 `functions/.next`에 복사한 뒤 생성된 서버 bundle에 직접 OpenAI 호출 경로가 없는지 검증한다.
- `npm run deploy:firebase`: `verify`를 먼저 통과한 뒤 Firebase 배포를 실행한다. Functions predeploy는 `deploy:prep -> functions:build`를 항상 다시 적용한다.
- `npm run deploy:functions`, `npm run functions:deploy`: Firebase Functions 배포를 시작하며 동일한 predeploy 계약을 사용한다.

## ESLint 구성
- `eslint.config.mjs`는 Next 15 문서의 flat config 예시를 따라 `FlatCompat`와 `next/core-web-vitals`, `next/typescript`를 사용한다.
- 빌드 산출물과 외부 산출물은 lint 대상에서 제외한다.
  - `.next/**`
  - `node_modules/**`
  - `functions/lib/**`
  - `functions/.next/**`
  - `tmp-edge-profile-single/**`
  - `public/**`

## 과거 로컬 제약 해소
- 2026-05월의 registry 캐시 제한, ESLint 실행 파일 부재, Next worker 오류는 현재 제약이 아니다. 2026-07-20 기준 양쪽 `npm ci`, warning 0 lint, 전체 Jest, Functions 빌드, Rules Emulator, Next production build가 모두 실행된다.
- Functions의 `engines.node`는 배포 런타임 Node 22를 고정한다. 로컬 Node 24에서 설치할 때 표시되는 `EBADENGINE`은 이 런타임 차이를 알리는 경고이며 lockfile 설치와 검증은 완료됐다.

## 배포 빌드와 lint 분리
- `next.config.ts`에서 `eslint.ignoreDuringBuilds`를 켜서 배포 빌드는 컴파일/타입 검사를 우선 통과시키고, lint 품질 게이트는 `npm run lint`와 `npm run ci`에서 별도로 확인한다.
- Jest 설정은 TSX 테스트와 `@/` alias를 처리하도록 `ts-jest` transform과 `moduleNameMapper`를 루트 `src` 기준으로 맞췄다.
- `functions/.next/**` 산출물을 ESLint 제외 대상에 추가해 Functions 빌드 부산물이 lint 입력으로 들어오지 않게 했다.
- `scripts/**`, `next-env.d.ts`처럼 운영 보조 스크립트와 생성 파일 성격의 파일은 기본 lint 대상에서 제외했다. 검색 백업 페이지와 Functions 시드 JS는 저장소 정리 과정에서 제거했다.

## 2026-06-05 TypeScript 6 baseUrl 경고 정리
- TypeScript 6에서 `compilerOptions.baseUrl`이 deprecated 처리되어 루트 `tsconfig.json`에서 제거했다.
- `@/*` alias는 `paths`의 `["@/*": ["./src/*"]]`만으로 유지한다.
- 임시 억제용 `ignoreDeprecations: "6.0"`은 TypeScript 7 대비가 되지 않으므로 사용하지 않는다.

## 2026-06-05 구매 흐름 보정 검증
- `npm run typecheck`, 구매 흐름 관련 Jest 테스트, `npm run test:functions`, `npm run functions:build`를 통과했다.
- 당시 남아 있던 lint warning은 2026-06-22 warning 0 정리에서 해소됐다.
- `git diff --check`는 공백 오류 없이 통과했고, LF/CRLF 치환 경고만 출력됐다.

## 2026-06-22 ESLint warning 0개 정리
- `functions/src/**`, `src/shared/**`, `src/context/**`, `src/app/**` 전반의 기존 ESLint warning을 정리했다.
- 주요 정리 항목은 `any` 타입 구체화, unused 제거, Hook 의존성 보정, anonymous default export 이름 지정, unescaped entity 처리, `next/image`/`Link` 전환이다.
- 최종 검증에서 `npm run lint -- --max-warnings=0`, `npm run typecheck`, `npm test`, `npm run functions:build`가 모두 통과했다.

## 2026-06-24 중복 정리 검증
- 참조되지 않는 유틸/상수/API 래퍼/컴포넌트와 미사용 직접 의존성 5개를 제거했다.
- 검증은 `npm run typecheck`, `npm run lint -- --max-warnings=0`, `npm test`, `npm run functions:build` 기준으로 확인한다.

## 2026-06-29 배포 전 검증 강화
- `verify` 스크립트를 추가해 lint warning 0개, Jest, Functions 빌드, Next 빌드를 한 번에 확인한다.
- `deploy:firebase`는 `verify` 성공 후 Firebase 배포를 시작한다. Functions 산출물 복사와 경계 검사는 Firebase predeploy의 `deploy:prep`에서 수행한다.
- `functions/__tests__/httpHandlers.test.ts`, `src/shared/services/adminUserService.test.ts`로 민감 Function no-store, 회원가입 포인트 transaction, 쿠폰 발급 transaction, 관리자 포인트 API 경유를 검증한다.

## 2026-06-29 과설계 정리 검증

- 과설계 레이어 삭제 후 `npm run typecheck`, `npm run lint -- --max-warnings=0`, `npm test`, `npm run functions:build`, `npm run build`를 통과했다.
- 삭제된 route 타입 캐시 때문에 첫 typecheck가 `.next/types`에서 실패해 `.next/types`만 삭제 후 재실행했다.

## 2026-07-20 Functions 배포 산출물 경계

- Firebase Functions predeploy는 루트 `deploy:prep`과 `functions:build`를 순서대로 실행한다. 따라서 직접 `firebase deploy --only functions`를 사용해도 오래된 `functions/.next`를 그대로 배포하지 않는다.
- `deploy:prep`은 런타임에 불필요한 `.next/cache`를 제외해 Functions 소스 크기를 줄이고, 복사 후 `scripts/verify-functions-next-chat-boundary.js`로 생성된 서버 bundle 전체를 검사한다. `api.openai.com` 또는 `OPENAI_API_KEY` 직접 참조가 남으면 배포 전 실패한다.
- `scripts/functions-deploy-contract.test.js`가 package script와 Firebase predeploy 순서, 생성 bundle 검사기의 허용·거부 동작을 고정한다.

## 2026-07-20 생성물·Rules 품질 게이트

- Functions 빌드는 채팅 응답 생성물을 자동으로 덮어쓰지 않는다. 불일치나 파일 부재를 실패로 보고하며, 갱신은 `npm run sync:chat-responses:write`에서만 수행한다.
- `ci`와 `verify`는 `test:rules` 실패를 그대로 전파한다. Rules Emulator를 실행할 수 없는 환경도 보안 검증을 건너뛰지 않고 게이트 실패로 처리한다.
- `scripts/firestore-products-v2-migration.js` import는 dotenv, Firebase Admin, credential, Firestore를 초기화하지 않는다. 실제 CLI 진입점만 `loadFirestoreMigrationRuntime()`을 지연 호출하며 `analyzeStructure`, `migrateProducts`, `validateMigration`은 명시적으로 주입된 runtime만 사용한다.
- 일반 build/test는 tracked source를 수정하지 않는다. 채팅 생성물 쓰기는 명시적 `sync:chat-responses:write`만 수행하고, Next·Functions 산출물은 무시된 `.next`, `functions/.next`, `functions/lib`에 생성된다.

## 2026-07-20 의존성 보안 업데이트

- root는 `next`/`eslint-config-next` `15.5.20`, `firebase` `12.16.0`, 운영 스크립트용 dev `firebase-admin` `13.10.0`으로 고정했다.
- Functions는 `next` `15.5.20`, `firebase-admin` `13.10.0`, `firebase-functions` `6.6.0`으로 고정했다. 양쪽 `postcss` override는 `8.5.20`이다.
- production audit는 root 0건이다. Functions는 high/critical 0건이며, 동일 lockfile에서도 npm audit 서비스가 `firebase-functions`를 downstream synthetic effect로 포함하는지에 따라 moderate 8~9개로 집계됐다.
- 기반 리스크는 `uuid@9.0.1` advisory가 `gaxios`/`google-gax`/`teeny-request`/`retry-request`를 거쳐 Firestore·Storage·Admin으로 전파되는 한 경로다. 현재 major 안에서는 모두 최신이며 audit가 제안하는 Admin 14 major upgrade 또는 Admin 10 계열 downgrade는 승인 범위를 벗어나 적용하지 않았다.
- root의 production audit는 dev dependency인 Admin을 제외한다. 신뢰된 운영 스크립트가 사용하는 root Admin 경로도 향후 Admin 14 호환성 마이그레이션 검토 대상이다.

## 2026-07-20 전체 검증 결과

- 양쪽 `npm ci`와 `npm ls`, root typecheck, lint warning 0, Jest 99 suites/583 tests, Functions build, Firestore·Storage Rules 108 tests를 통과했다.
- Next 15.5.20 production build는 63개 페이지를 생성했고, `deploy:prep`의 Functions Next 산출물 복사와 직접 OpenAI 참조 경계 검사도 통과했다. 실제 배포는 수행하지 않았다.
