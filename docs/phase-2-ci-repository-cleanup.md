# STYNA 2단계 CI·저장소·설정 정리

작성일: 2026-09-17

## 목적

2단계에서는 1단계에서 정리한 보안 경계를 자동 검증 가능한 CI로 연결하고, 저장소에 남아 있던 개발 산출물·빈 레거시 파일·실효성 없는 이미지 설정을 정리한다.

## CI 정책

`.github/workflows/ci.yml`을 공통 품질 게이트로 사용한다.

- `push`: 모든 브랜치에서 실행
- `pull_request`: `main` 대상 PR에서 실행
- `workflow_dispatch`: 수동 실행 지원
- Node.js: 22

### quality

1. `npm ci`
2. `npm ci --prefix functions`
3. `npm run typecheck`
4. `npm run lint -- --max-warnings=0`
5. `npm test -- --runInBand`
6. `npm run functions:build`

### rules

Java 21과 Firebase CLI를 준비한 뒤 `npm run test:rules`를 실행한다.

### build

실제 운영 비밀값을 사용하지 않고 형식상 유효한 CI 전용 Firebase 클라이언트 설정을 주입해 `npm run build`를 검증한다. Next 빌드의 타입 검사에서 `functions/src`도 참조하므로 `functions` 의존성도 설치한다.

## 저장소 정리

다음 항목은 소스가 아니므로 Git 추적에서 제거했다.

- `.next-dev.log`
- `.next-dev.err.log`
- `.playwright-cli/` 산출물
- `artifacts/screenshots/` 산출물
- 빈 `constants/api.ts`

`.gitignore`에는 기존 `*.log`, `/artifacts/` 규칙에 더해 `/.playwright-cli/`를 추가한다.

## 이미지 정책

현재 Firebase Hosting/Functions 배포에서는 `images.unoptimized: true`를 유지한다.

따라서 Next 이미지 최적화 경로에서만 의미가 있는 다음 옵션은 제거한다.

- `minimumCacheTTL`
- `formats`
- `deviceSizes`
- `imageSizes`

원격 이미지는 현재 실제 사용 중인 Firebase Storage 다운로드 호스트만 허용한다.

- `https://firebasestorage.googleapis.com/v0/b/hebimall.firebasestorage.app/o/**`

`hostname: '**'` 전체 HTTPS 허용은 제거한다.

## 브랜드와 인프라 식별자

루트 npm package 이름은 제품명과 맞춰 `styna`로 변경한다. `package-lock.json`의 루트 package 메타데이터도 동일하게 맞춘다.

다음 값은 외부 인프라 식별자이므로 변경하지 않는다.

- Firebase project/site의 `hebimall`
- `hebimall.web.app`
- `hebimall.firebaseapp.com`
- `hebimall.firebasestorage.app`

## 삭제 후보 — 이번 단계에서 유지

대량 삭제는 하지 않는다. 아래 문서는 역사적 작업 맥락이 있어 이번 단계에서는 유지하고, 향후 문서 구조 개편 시 링크 여부를 확인한 뒤 선별한다.

- `docs/superpowers/plans/**`: 과거 구현 계획
- `docs/superpowers/specs/**`: 과거 설계 명세
- `docs/project-comprehensive-review.md`: 종합 점검 기준 기록
- 개별 migration 관련 문서: 실제 데이터 복구·롤백 기록에 필요할 수 있음

삭제 조건은 다음 세 가지를 모두 만족할 때로 제한한다.

1. 현재 `docs/README.md` 또는 다른 운영 문서에서 참조되지 않음
2. 배포·마이그레이션·롤백 근거로 사용되지 않음
3. 현재 코드 동작을 설명하는 유일한 기록이 아님

## 완료 조건

- [ ] 공통 GitHub Actions CI가 push/PR에서 실행된다.
- [ ] typecheck, lint, Jest, Functions build, Rules, Next build가 CI에서 통과한다.
- [ ] 개발 로그·Playwright·스크린샷 산출물이 저장소에 남지 않는다.
- [ ] 빈 루트 `constants/api.ts`가 제거된다.
- [ ] 이미지 원격 호스트 전체 와일드카드가 제거된다.
- [ ] `unoptimized: true`와 충돌하는 이미지 최적화 전용 옵션이 제거된다.
- [ ] npm package 이름은 `styna`, Firebase 인프라 ID는 기존 값을 유지한다.
