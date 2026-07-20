# 품질 게이트/CI 스크립트 정리

## 목적
- Next 15 프로젝트의 lint는 `next lint` 대신 ESLint CLI와 `eslint.config.mjs`를 기준으로 실행한다.
- CI는 타입체크, lint, Jest, Functions 빌드를 분리된 스크립트로 검증한다.

## 스크립트
- `npm run typecheck`: 루트 `tsconfig.json` 기준 TypeScript 검증. `.next`/tsbuildinfo 캐시 흔들림을 피하기 위해 `--incremental false`를 사용한다.
- `npm run lint`: `eslint .` 실행.
- `npm run lint:fix`: `eslint . --fix` 실행.
- `npm test`: Jest 전체 테스트를 `--runInBand`로 실행해 Windows spawn 오류 가능성을 낮춘다.
- `npm run test:functions`: `functions/__tests__`만 실행.
- `npm run ci`: `typecheck -> lint -> test -> functions:build` 순서로 실행.
- `npm run verify`: `typecheck -> lint -- --max-warnings=0 -> test -> functions:build -> build` 순서로 배포 전 전체 검증을 실행한다.
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

## 현재 환경 제약
- 2026-05-11 현재 로컬 샌드박스는 npm registry 접근이 캐시 전용으로 제한되어 `eslint`, `eslint-config-next`, `@eslint/eslintrc` 설치와 `package-lock.json` 갱신이 완료되지 않았다.
- 따라서 `npm run lint`는 설정/스크립트는 준비됐지만 로컬 `node_modules/.bin/eslint` 부재로 실패한다.
- 네트워크 가능한 환경에서 `npm install`을 한 번 실행해 lockfile을 갱신한 뒤 `npm run lint`와 `npm run ci`를 다시 확인해야 한다.

## 2026-05-12 확인
- 1순위 UI 정리 후 `npm run typecheck`는 통과했다.
- `npm run lint`는 여전히 로컬 `eslint` 실행 파일 부재로 `'eslint' is not recognized` 오류가 발생한다.
- 2026-05-12: `package-lock.json`의 루트 `devDependencies`에 ESLint 관련 항목을 package.json과 맞춰 반영했다. 다만 이 샌드박스는 `@eslint/eslintrc` 캐시가 없어 `npm install --prefer-offline`이 `ENOTCACHED`로 실패하므로 실제 `node_modules` 복구는 네트워크 가능한 로컬 터미널에서 진행해야 한다.

## 2026-05-12 배포 빌드 lint 분리
- `npm install` 후 ESLint가 설치되면 `next build` 내부 lint가 기존 전체 lint 오류를 배포 차단 오류로 처리한다.
- `next.config.ts`에서 `eslint.ignoreDuringBuilds`를 켜서 배포 빌드는 컴파일/타입 검사를 우선 통과시키고, lint 품질 게이트는 `npm run lint`와 `npm run ci`에서 별도로 확인한다.
- 이 설정 후 `npm run build`는 `Skipping linting`까지 확인됐고, 현재 샌드박스에서는 이후 타입 검사 단계가 기존 Next worker `spawn EPERM` 환경 제약으로 중단된다.

## 2026-05-12 Jest/ESLint 확인
- Jest 설정은 TSX 테스트와 `@/` alias를 처리하도록 `ts-jest` transform과 `moduleNameMapper`를 루트 `src` 기준으로 맞췄다.
- `functions/.next/**` 산출물을 ESLint 제외 대상에 추가해 Functions 빌드 부산물이 lint 입력으로 들어오지 않게 했다.
- `npm run lint`는 실행 가능해졌지만 기존 전체 lint 부채로 실패한다. 구매 흐름 보정 범위에서는 새 unused 경고를 제거했고, 전체 lint 정리는 별도 작업이 필요하다.

## 2026-05-12 lint 게이트 복구
- `scripts/**`, `next-env.d.ts`처럼 운영 보조 스크립트와 생성 파일 성격의 파일은 기본 lint 대상에서 제외했다. 검색 백업 페이지와 Functions 시드 JS는 저장소 정리 과정에서 제거했다.
- `no-explicit-any`, unescaped entity, HTML anchor 페이지 이동, `prefer-const`는 기존 부채를 warning으로 낮췄다. 신규 작업에서는 warning을 늘리지 않는 방식으로 점진 정리한다.
- 실제 Hook 규칙 오류였던 `AddModal` 조건부 Hook 호출은 early return 위치를 조정해 해결했다.
- 서비스 메서드명이 Hook으로 오인되던 `CouponService.useCoupon`, `PointService.usePoint`는 각각 `redeemCoupon`, `spendPoint`로 바꿨다.
- 현재 `npm run lint`는 exit 0으로 통과하지만 warning은 남아 있다.

## 2026-06-05 TypeScript 6 baseUrl 경고 정리
- TypeScript 6에서 `compilerOptions.baseUrl`이 deprecated 처리되어 루트 `tsconfig.json`에서 제거했다.
- `@/*` alias는 `paths`의 `["@/*": ["./src/*"]]`만으로 유지한다.
- 임시 억제용 `ignoreDeprecations: "6.0"`은 TypeScript 7 대비가 되지 않으므로 사용하지 않는다.

## 2026-06-05 구매 흐름 보정 검증
- `npm run typecheck`, 구매 흐름 관련 Jest 테스트, `npm run test:functions`, `npm run functions:build`를 통과했다.
- `npm run lint`는 exit 0으로 통과하나 기존 경고 254개는 남아 있다.
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
- `deploy:firebase`는 `verify` 성공 후에만 `copy-next-to-functions`와 `firebase deploy`를 실행한다.
- `functions/__tests__/httpHandlers.test.ts`, `src/shared/services/adminUserService.test.ts`로 민감 Function no-store, 회원가입 포인트 transaction, 쿠폰 발급 transaction, 관리자 포인트 API 경유를 검증한다.

## 2026-06-29 과설계 정리 검증

- 과설계 레이어 삭제 후 `npm run typecheck`, `npm run lint -- --max-warnings=0`, `npm test`, `npm run functions:build`, `npm run build`를 통과했다.
- 삭제된 route 타입 캐시 때문에 첫 typecheck가 `.next/types`에서 실패해 `.next/types`만 삭제 후 재실행했다.

## 2026-07-20 Functions 배포 산출물 경계

- Firebase Functions predeploy는 루트 `deploy:prep`과 `functions:build`를 순서대로 실행한다. 따라서 직접 `firebase deploy --only functions`를 사용해도 오래된 `functions/.next`를 그대로 배포하지 않는다.
- `deploy:prep`은 런타임에 불필요한 `.next/cache`를 제외해 Functions 소스 크기를 줄이고, 복사 후 `scripts/verify-functions-next-chat-boundary.js`로 생성된 서버 bundle 전체를 검사한다. `api.openai.com` 또는 `OPENAI_API_KEY` 직접 참조가 남으면 배포 전 실패한다.
- `scripts/functions-deploy-contract.test.js`가 package script와 Firebase predeploy 순서, 생성 bundle 검사기의 허용·거부 동작을 고정한다.
