# Docs Hub

이 문서 허브는 현재 프로젝트를 이해하기 위한 진입점입니다.

현재 동작의 기준은 코드와 아래 세 문서입니다.

- [README.md](../README.md): 기술 스택, 현재 기능, 데이터 구조, 실행·배포 방법
- [PRODUCT.md](../PRODUCT.md): 제품 목적, 사용자, 포트폴리오 범위와 원칙
- [commerce-policy.md](commerce-policy.md): 결제·배송·문의·챗봇 데모 경계와 정책 원본

## 권장 읽기 순서

1. [README.md](../README.md)에서 프로젝트 전체 구조와 현재 기능을 확인합니다.
2. [PRODUCT.md](../PRODUCT.md)에서 제품 목적과 화면 방향을 확인합니다.
3. [commerce-policy.md](commerce-policy.md)에서 데모 범위와 금지된 운영 약속을 확인합니다.
4. [env-setup.md](env-setup.md)와 [quality-gates.md](quality-gates.md)에서 실행·검증 환경을 확인합니다.
5. 관심 있는 도메인의 상세 문서와 해당 코드·테스트를 함께 확인합니다.

## 현재 구현과 문서의 기준

- Firestore 경로, Firebase Rules, Functions handler와 화면 동작은 저장소의 현재 코드를 기준으로 합니다.
- `docs/superpowers/specs/`와 `docs/superpowers/plans/`의 설계·실행 계획은 작성 당시의 요구사항과 작업 기록입니다. 현재 구현과 다를 경우 현재 코드와 최신 개요 문서를 우선합니다.
- `ai-harness-handoff.md`와 날짜가 붙은 작업 문서는 특정 시점의 인수인계·검증 기록입니다. 전체 프로젝트 개요를 대신하지 않습니다.
- 정책·환경·품질 문서의 명령과 경로를 변경하면 이 허브와 루트 README의 관련 링크도 함께 확인합니다.

## 핵심 운영·정책 문서

- 상거래 정책과 데모 범위 : [commerce-policy.md](commerce-policy.md)
- 환경 변수/배포 설정 : [env-setup.md](env-setup.md)
- 품질 게이트/CI 스크립트 : [quality-gates.md](quality-gates.md)
- API 캐시 정책 및 debug 경로 : [api-cache-debug-route.md](api-cache-debug-route.md)
- SEO 경로·색인 정책 : [seo-routing.md](seo-routing.md)
- 스토리지 구조 : [storage-structure.md](storage-structure.md)
- 정적 콘텐츠 Firestore 관리 : [static-content.md](static-content.md)

## 핵심 기능 문서

- 인증 화면 UI : [auth-ui.md](auth-ui.md)
- 상품 조회 구조 : [product-listing-structure.md](product-listing-structure.md)
- 주문 생성 서버화 : [order-serverization.md](order-serverization.md)
- 쿠폰/포인트 정책 : [coupon-system.md](coupon-system.md)
- 리뷰 통계 동기화·백필 : [review-statistics.md](review-statistics.md)
- QnA 비밀글 검증 구조 : [qna-secret-password.md](qna-secret-password.md)
- 관리자 대시보드 : [dashboard.md](dashboard.md)
- 마이페이지 UI : [mypage-ui.md](mypage-ui.md)
- 이벤트 페이지 점검 : [event-page-review.md](event-page-review.md)
- 전체 프로젝트 종합 검토 : [project-comprehensive-review.md](project-comprehensive-review.md)

## 인수인계·작업 기록

- 현재 확인된 특정 작업 인수인계 : [ai-harness-handoff.md](ai-harness-handoff.md)

## 전체 상세·작업 문서 목록
- 관리 권한/보안 판정 정리 : security-admin-permission.md
- 관리자 토큰 통합 정리 : store-admin-token-unification.md
- 관리자 페이지 권한 검토 : admin-page-review.md
- 헤더 UI 정리 : header-ui.md
- 데스크톱 헤더 메뉴 구성 복원 설계 : superpowers/specs/2026-07-28-header-desktop-menu-restore-design.md
- 데스크톱 헤더 메뉴 구성 복원 실행 계획 : superpowers/plans/2026-07-28-header-desktop-menu-restore.md
- 이벤트 페이지 점검 : event-page-review.md
- 이벤트 안전 재공개 및 신규 이벤트 확장 설계 : superpowers/specs/2026-07-31-event-safe-republication-design.md
- 이벤트 안전 재공개 및 신규 이벤트 확장 실행 계획 : superpowers/plans/2026-07-31-event-safe-republication.md
- 이벤트 이미지 전면 교체 설계 : superpowers/specs/2026-07-14-event-image-refresh-design.md
- 이벤트 이미지 전면 교체 실행 계획 : superpowers/plans/2026-07-14-event-image-refresh.md
- 이벤트 상세 커머스 템플릿 리뉴얼 설계 : superpowers/specs/2026-07-15-event-detail-commerce-template-design.md
- 이벤트 상세 커머스 템플릿 리뉴얼 실행 계획 : superpowers/plans/2026-07-15-event-detail-commerce-template.md
- 이벤트 상세 에디토리얼 스토리 설계 : superpowers/specs/2026-07-15-event-detail-editorial-story-design.md
- 이벤트 상세 에디토리얼 스토리 실행 계획 : superpowers/plans/2026-07-15-event-detail-editorial-story.md
- 이벤트 목록 클린 갤러리 설계 : superpowers/specs/2026-07-15-event-list-clean-gallery-design.md
- 이벤트 목록 클린 갤러리 실행 계획 : superpowers/plans/2026-07-15-event-list-clean-gallery.md
- 메인 랭킹 UI 점검 : main-ranking-ui.md
- 포트폴리오 데모 쇼케이스 안내 설계 : superpowers/specs/2026-08-07-portfolio-demo-showcase-design.md
- 포트폴리오 데모 쇼케이스 안내 구현 계획 : superpowers/plans/2026-08-07-portfolio-demo-showcase.md
- STYNA SELECT 편집형 추천 상품 설계 : superpowers/specs/2026-08-06-styna-select-editorial-design.md
- STYNA SELECT 편집형 추천 상품 실행 계획 : superpowers/plans/2026-08-06-styna-select-editorial.md
- STYNA FILM 무음 자동 재생 섹션 설계 : superpowers/specs/2026-08-06-styna-film-autoplay-design.md
- STYNA FILM 무음 자동 재생 섹션 실행 계획 : superpowers/plans/2026-08-06-styna-film-autoplay.md
- 메인 상단 배너 작업 영역 : main-banner.md
- STYNA 공유 미리보기 OG 이미지 제작 기획 : superpowers/specs/2026-08-06-styna-og-image-design.md
- STYNA 공유 미리보기 OG 이미지 구현 계획 : superpowers/plans/2026-08-06-styna-og-image.md
- 메인 배너 가변 프리뷰·바 네비게이션 설계 : superpowers/specs/2026-08-06-main-banner-responsive-preview-design.md
- 메인 배너 데스크톱 정사각형·모바일 세로형 구현 계획 : superpowers/plans/2026-08-06-main-banner-responsive-mobile-event.md
- 메인 배너 드래그·무한 순환 안정화 설계 : superpowers/specs/2026-07-13-main-banner-drag-loop-design.md
- 메인 배너 드래그·무한 순환 안정화 실행 계획 : superpowers/plans/2026-07-13-main-banner-drag-loop.md
- 마이페이지 UI 점검 : mypage-ui.md
- 1:1 문의 실시간 알림 설계 : superpowers/specs/2026-08-03-inquiry-notification-design.md
- 1:1 문의 실시간 알림 실행 계획 : superpowers/plans/2026-08-03-inquiry-notification.md
- 1:1 문의 비로그인 안내 설계 : superpowers/specs/2026-08-06-inquiry-login-gate-design.md
- 1:1 문의 비로그인 안내 실행 계획 : superpowers/plans/2026-08-06-inquiry-login-gate.md
- 마이페이지 컴팩트 레이아웃 설계 : superpowers/specs/2026-07-13-mypage-compact-layout-design.md
- 마이페이지 컴팩트 레이아웃 실행 계획 : superpowers/plans/2026-07-13-mypage-compact-layout.md
- 인증 화면 UI 정리 : auth-ui.md
- 상거래 정책과 데모 범위 : [commerce-policy.md](commerce-policy.md)
- 상품 조회 구조 개선 : product-listing-structure.md
- 리뷰 통계 동기화·백필 : review-statistics.md
- 디자인 시스템 정리/리팩터 : design-system-refactor.md
- 디자인 시스템 QA : design-system-qa.md
- 대시보드 정리 : dashboard.md
- 관리자 첫 화면 데이터 변경 안내 : admin-data-change-warning.md
- 관리자 상품 수정 Firebase 안전 모달 설계 : superpowers/specs/2026-08-05-admin-product-edit-modal-firebase-design.md
- 관리자 상품 수정 Firebase 안전 모달 실행 계획 : superpowers/plans/2026-08-05-admin-product-edit-modal-firebase.md
- 쿠폰/포인트 정책 정리 : coupon-system.md
- 스토리지 구조 정리 : storage-structure.md
- 이미지 전송 성능 : image-delivery-performance.md
- API 캐시 정책 및 debug 경로 정리 : api-cache-debug-route.md
- 환경 변수/배포 설정 : env-setup.md
- QnA 비밀글 검증 구조 정리 : qna-secret-password.md
- 주문 생성 서버화 : order-serverization.md
- 체크아웃 배송지 직접 입력 설계 : superpowers/specs/2026-07-13-checkout-delivery-address-input-design.md
- 체크아웃 배송지 직접 입력 실행 계획 : superpowers/plans/2026-07-13-checkout-delivery-address-input.md
- Firestore 상품 마이그레이션 계획 : firestore-migration-plan.md
- Firestore AI 요약 Export : firestore-ai-summary.md
- Firestore 최적화 실행 계획 : superpowers/plans/2026-06-30-firestore-optimization.md
- 메인 편집형 쇼핑몰 개편 실행 계획 : superpowers/plans/2026-07-08-main-editorial-shopping-mall.md
- 스타일나우 시즌 콘텐츠 설계 : superpowers/specs/2026-07-27-style-now-season-content-design.md
- 스타일나우 시즌 콘텐츠 실행 계획 : superpowers/plans/2026-07-27-style-now-season-content.md
- 스타일나우 계절 카테고리·상세 화면 설계 : superpowers/specs/2026-07-28-style-now-category-pages-design.md
- 스타일나우 계절 카테고리·상세 화면 실행 계획 : superpowers/plans/2026-07-28-style-now-category-pages.md
- 운영 재검수 잔여 문제 해결 실행 계획 : superpowers/plans/2026-08-12-production-readiness-remediation.md
- 스타일나우 이미지 생성 명령어 84개 : style-now-image-generation-commands.md
- 주문·권한 정합성 설계 : superpowers/specs/2026-07-10-security-integrity-design.md
- 주문·권한 정합성 실행 계획 : superpowers/plans/2026-07-10-security-integrity.md
- 품질 게이트/CI 스크립트 정리 : quality-gates.md
- Rules Emulator 잔여 프로세스 정리 실행 계획 : superpowers/plans/2026-07-27-rules-emulator-cleanup.md
- 정적 콘텐츠 Firestore 관리 : static-content.md
- 프로젝트 정리·안정화 설계 : superpowers/specs/2026-07-20-project-hardening-design.md
- 프로젝트 데드·중복 코드 정리 실행 계획 : superpowers/plans/2026-07-20-project-cleanup.md
- 프로젝트 보안·품질 게이트 실행 계획 : superpowers/plans/2026-07-20-project-security-quality.md
- 프로젝트 정책·구매 흐름 실행 계획 : superpowers/plans/2026-07-20-project-policy-purchase.md
- 프로젝트 접근성·사용자 경험 개선 실행 계획 : superpowers/plans/2026-07-21-project-accessibility-ux.md
- 프로젝트 성능·SEO 개선 실행 계획 : superpowers/plans/2026-07-21-project-performance-seo.md
- 쇼핑 우선 하이브리드 UI 개선 설계 : superpowers/specs/2026-07-27-shopping-first-hybrid-ui-design.md
- 쇼핑 우선 하이브리드 UI 개선 실행 계획 : superpowers/plans/2026-07-27-shopping-first-hybrid-ui.md
- 쇼핑 우선 하이브리드 UI P2 폴리시 설계 : superpowers/specs/2026-07-27-shopping-first-hybrid-ui-p2-polish-design.md
- 쇼핑 우선 하이브리드 UI P2 폴리시 실행 계획 : superpowers/plans/2026-07-27-shopping-first-hybrid-ui-p2-polish.md
- SEO 경로·색인 정책 : seo-routing.md
