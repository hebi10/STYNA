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
- 로그인 화면은 기존에 이미 절제된 톤이라 레이아웃 카드 기준만 공용 auth layout에서 받도록 둔다.
- 2026-06-05: `/auth/*` 경로에서는 우측 하단 쇼핑 안내/실시간 상담 플로팅 UI를 렌더링하지 않는다. 모바일 로그인 카드와 하단 회원가입 CTA가 플로팅 버튼에 눌리지 않게 하기 위한 정책이다.
- 2026-06-11: 로그인 제출 또는 이미 로그인된 사용자의 `/auth/login` 진입 시 카드 위에 “마이페이지 준비 중” 전환 오버레이를 표시한다. 인증 확인과 라우팅 대기 시간을 멈춤처럼 보이지 않게 하기 위한 처리다.
- 2026-06-22: `/auth/login?redirect=/orders/checkout`처럼 내부 redirect 쿼리가 있으면 로그인 성공 후 해당 경로를 우선 사용한다. 공개 화면의 하드코딩 회원/관리자 빠른 로그인은 개발 환경에서만 렌더링한다.
