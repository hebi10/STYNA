# 포트폴리오 데모 최종 배포 체크리스트

## 1. 배포 전

```powershell
git pull --ff-only origin main
Remove-Item -Recurse -Force functions\lib -ErrorAction SilentlyContinue
npm ci
npm ci --prefix functions
npm run verify
firebase login
firebase use hebimall
```

포트폴리오 배포 환경에서는 다음 조건을 별도로 확인한다.

- `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true`
- Functions의 `ENABLE_DEMO_LOGIN=true`
- 일반 사용자 데모 계정이 활성 `user` 상태
- 관리자 데모 계정이 활성 `demo_admin` 상태
- 관리자 데모 custom claims가 `demoAdmin=true`, `role=demo_admin`
- 데모 계정 비밀번호는 코드, 문서, 브라우저 UI에 노출하지 않음

관리자 데모 프로비저닝은 실제 변경 전에 dry-run을 먼저 사용한다.

```powershell
npm run provision:demo-admin:dry-run
```

## 2. 배포

```powershell
npm run deploy:firebase
```

이 명령은 `npm run verify` 성공 후 Firebase 전체 배포를 시작한다. Functions predeploy에서 최신 Next 빌드 복사, chat provider 경계 검사, Functions 빌드를 다시 수행한다.

## 3. 배포 후 자동 스모크

홈/로그인 공개 문구만 확인:

```powershell
npm run smoke:production
```

일반 사용자·관리자 Custom Token 발급까지 확인:

```powershell
$env:STYNA_SMOKE_DEMO_LOGIN="true"
npm run smoke:production
Remove-Item Env:STYNA_SMOKE_DEMO_LOGIN
```

다른 배포 URL을 확인해야 할 때만:

```powershell
$env:STYNA_SMOKE_BASE_URL="https://example.web.app"
npm run smoke:production
Remove-Item Env:STYNA_SMOKE_BASE_URL
```

스모크 스크립트는 발급된 Custom Token의 존재만 확인하고 값을 출력하지 않는다.

## 4. 수동 체험 시나리오

일반 사용자:

1. 홈 → 프로젝트 둘러보기
2. 일반 사용자 체험
3. 상품 탐색
4. 장바구니
5. 체크아웃
6. 주문내역

관리자 체험:

1. 로그인 → 관리자 페이지 체험
2. 상단 `관리자 체험 모드 · 조회 전용` 확인
3. 대시보드 → 상품 → 주문 → 이벤트 → 쿠폰 이동
4. 비식별 샘플 데이터 확인
5. 변경 액션 disabled 상태 확인

## 5. 보안 확인

- 실제 결제가 발생하지 않음
- 관리자 데모에서 실제 운영 데이터가 조회되지 않음
- 관리자 변경 액션이 실행되지 않음
- `demo_admin`은 서버에서 strict admin으로 판정되지 않음
- UID, 이메일, Custom Token, 비밀번호를 로그나 캡처에 남기지 않음
