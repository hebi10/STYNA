# 이벤트 페이지 리뷰 문서

## 대상 파일
- `src/app/events/page.tsx`
- `src/app/events/page.module.css`
- `src/app/events/_components/EventList.tsx`
- `src/app/events/_components/EventList.module.css`
- `src/context/eventProvider.tsx`
- `src/shared/constants/eventUiMeta.ts`
- `src/shared/utils/eventImages.ts`
- `src/shared/services/eventService.ts`
- `src/shared/types/event.ts`
- `src/app/events/[eventId]/page.tsx`
- `src/app/events/[eventId]/EventDetailClient.tsx`
- `src/app/events/[eventId]/EventDetailClient.module.css`
- `src/app/_components/chat/ChatWidget.module.css`
- `src/app/_components/popup/SiteGuideManager.module.css`

## 리뷰 목적
- 이벤트 목록 페이지와 상세 페이지의 사용자 흐름을 확인한다.
- 정보 구조, 행동 유도, 시각 계층, 모바일 대응 관점에서 문제와 개선 포인트를 정리한다.

## 확인 결과
- 목록 첫 화면은 `대표 배너 > 통계 > 필터 > 카드 목록` 흐름으로 단순화했고, `page.tsx`의 시각적 히어로는 제거해 소개성 UI와 프로모션 UI가 겹치지 않게 정리했다.
- 대표 배너는 현재 필터 결과 안에서 `진행중 우선 > 마감 임박 우선 > 진행중이 없으면 최신 생성 이벤트` 기준으로 노출되도록 맞춰 종료 이벤트가 진행중 이벤트보다 먼저 뜨지 않게 했다.
- 필터 UI는 `filteredEvents`와 컨텍스트 페이지 상태를 기준으로 렌더링되어 버튼 클릭 시 카드 목록, 페이지네이션, 빈 상태가 함께 재계산된다.
- 로딩, 에러, 빈 상태 분기를 `eventProvider`와 `EventList`에서 분리해 최초 진입 시 빈 상태 문구가 잠깐 보이는 흐름을 막고, 필터 결과가 없을 때만 empty UI가 나오도록 정리했다.
- 상세 페이지는 `event.content`를 실제 본문으로 출력하고, 문자열 기반 HTML/일반 텍스트를 모두 처리하도록 바꿨다. 본문 외에도 참여 방법, 혜택 내용, 유의사항, 기간, 당첨/지급 방식을 구조화해 목록과 다른 정보 밀도를 만들었다.
- 상세 상단 CTA는 이벤트 타입과 상태에 따라 `쿠폰 받기`, `할인 상품 보러가기`, `리뷰 쓰고 참여하기`처럼 핵심 행동을 바로 이해할 수 있는 카피로 분기했고, 직접 참여 가능한 이벤트는 실제 참여 로직과 연결했다. 참여 완료 후에도 세일형·리뷰형·신상형은 상단 CTA로 후속 화면을 이어갈 수 있다.
- 상세 하단 CTA는 상단과 같은 역할을 반복하지 않고 쿠폰함 확인, 유의사항 확인, 전체 이벤트 이동 같은 보조 행동만 담당하도록 별도 패널로 재구성했다.
- 목록 페이지는 메인 페이지처럼 얇은 소개 문단과 구분선 위주로 다시 정리했고, 과한 프로모션 히어로 대신 짧은 소개 + 대표 배너 구조로 첫 화면 톤을 차분하게 맞췄다.
- 목록 대표 배너는 어두운 오버레이 중심 구조를 걷어내고 밝은 표면 위 텍스트와 이미지가 나뉘는 카드형 레이아웃으로 바꿨다. 타입별 차이는 강한 색 대비보다 은은한 배경색과 CTA 포인트 색으로만 남겼다.
- `src/shared/constants/eventUiMeta.ts`에 이벤트 UI 메타데이터를 분리해 세일/쿠폰/리뷰형/신상/특별 기획의 배지 문구, 배너 카피, CTA 문구, 상세 섹션 제목을 한 곳에서 관리하도록 정리했다.
- 목록 카드는 타입별 카드 테마 클래스와 메타데이터를 함께 쓰되, 큰 라운드·짙은 그림자 대신 메인 페이지와 비슷한 얇은 보더, 절제된 그림자, 정돈된 타이포 위계로 다시 맞췄다. 타입별 성격은 상단 포인트 라인과 배지 색온도로만 구분되게 줄였다.
- `src/app/events/page.module.css`, `src/app/events/_components/EventList.module.css`의 페이지 제목, 배너 제목, 통계 숫자에서 세리프 폰트를 제거해 메인 페이지와 같은 기본 폰트 위계로 맞췄다.
- 대표 배너 CTA와 카드 하단 CTA는 검정 기반으로 통일하고, 버건디는 세일 카드 배지와 강조 태그 같은 타입 표시 쪽에만 남겼다.
- 2026-05-12: 상세 페이지의 타입별 그라데이션 변수, 큰 radius, blur, 강한 그림자를 하단 override로 중립화했다. 상세 히어로/혜택/본문/유의사항/하단 CTA는 흰 표면, 얇은 보더, 2px radius, 검정 CTA 기준으로 맞췄다.
- 2026-05-12: 목록 대표 배너와 이벤트 카드도 2px radius와 무그림자 hover로 보정해 메인 상품 매대의 낮은 장식 밀도와 맞췄다.
- 2026-06-05: `getEventDisplayImages()`를 추가해 누락 이미지, `/images/events/*`, `/api/placeholder/*`, 과거 준비중 업로드 이미지를 이벤트 타입별 editorial 자산으로 치환한다. 정상 CDN/업로드 이미지는 보존한다.
- 2026-06-05: 목록 대표 배너와 카드 이미지를 `getEventDisplayImages()` 기준으로 렌더링하고, 상세 배너는 단일 대형 이미지 대신 이미지 + 혜택 요약 패널의 에디토리얼 기획전형 블록으로 재구성했다.
- 2026-06-05: mock 이벤트 기간과 이미지 경로를 현재 사용 가능한 `/main/hero_editorial_*` 자산으로 맞춰 Firestore fallback 상황에서도 종료된 2024 이벤트나 깨진 이미지가 보이지 않게 했다.
- 2026-06-05: 모바일에서 쇼핑 안내 버튼은 768px 이하에서 숨기고, 도움말 챗봇 버튼은 640px 이하에서 짧은 `챗봇` 버튼으로 줄여 이벤트/상세 하단 CTA를 덜 압박하도록 조정했다. `/auth/*`에서는 기존처럼 플로팅 UI가 렌더링되지 않는다.
- 2026-06-05: 2026년 1월~8월 월별 2~3개씩 총 20개 이벤트 카탈로그를 임시 로컬 데이터로 추가했다.
- 2026-06-05: 이벤트별 전신 모델컷 source 20개와 한글 이벤트 문구가 들어간 `banner.webp`/`thumb.webp` 40개를 `public/events/2026/`에 생성했다. 생성용 일회성 스크립트는 저장소 정리 과정에서 제거했다.
- 2026-06-05: 모델컷이 잘리는 문제를 줄이기 위해 목록/상세 배너 이미지는 `object-position: right center` 기준으로 보정했고, 최종 이벤트 배너는 UI 컨테이너와 맞는 `1600x820` 비율로 생성한다.
- 2026-06-05: 카드 미리보기 썸네일은 축소 시 흰 텍스트 박스가 어수선하게 보이지 않도록 텍스트 합성을 제거하고, 전신 모델컷 중심의 클린 이미지로 재생성했다. 이벤트명/혜택/기간은 카드 UI에서 별도로 표시한다.
- 2026-06-05: Chrome 확인 중 Firestore에는 기존 2개 이벤트만 있어 신규 20개 이벤트 상세가 404로 뜨는 문제가 확인됐다. 사용자 이벤트 목록은 Firestore 이벤트와 로컬 2026 카탈로그를 병합하고, 상세 라우트는 Firestore에 문서가 없으면 로컬 카탈로그로 조회하도록 보정했다.
- 2026-06-05: Chrome에서 `/events` 페이지네이션 1~4페이지를 확인해 2026 신규 이벤트 링크 20개가 모두 노출되는지 확인했다. 20개 상세 URL도 직접 순회해 404, 깨진 이미지, 가로 오버플로우가 없음을 확인했다.
- 2026-06-05: Firebase `events` 컬렉션을 확인한 결과 문서 2개 모두 `bannerImage`/`thumbnailImage`만 있고 `detailImage`는 없었다. 상세 페이지에서 배너 이미지를 재사용해 문구가 반복되는 문제가 있어 `detailImage`를 선택적 필드로 추가하고, 2026 이벤트는 `*-detail.webp` 클린 컷을 별도로 생성해 상세에서 사용하도록 분리했다.
- 2026-06-05: Chrome에서 2026 이벤트 상세 20개를 다시 순회해 모두 `*-detail.webp`만 사용하고 `*-banner.webp`를 상세에서 사용하지 않는지 확인했다. 깨진 이미지와 가로 오버플로우도 없었다.

## 디자인 평가
- 장점: 정보 구조가 단순하고 카드 메타 정보, 배지, 기간 표시는 빠르게 읽힌다.
- 장점: 메인 페이지와 비슷한 배경색, 보더, 타이포 위계를 써서 이벤트 목록도 운영툴 느낌보다 차분한 브랜드 페이지 흐름으로 읽힌다.
- 장점: 리뷰 키워드가 있는 `special` 이벤트는 별도 리뷰형 variant로 보여 세일·쿠폰과 다른 참여형 흐름을 즉시 읽을 수 있다.
- 장점: 실제 Chrome 확인에서 `/events/`와 `/events/PacCrKVG9TikHo7lambG/` 모두 준비중 이미지가 editorial 이미지로 바뀌고, 수평 오버플로우 없이 로드됐다.
- 장점: 이벤트 배너는 배경 생성과 한글 텍스트 합성을 분리해 한글 깨짐 없이 쇼핑몰 프로모션 배너처럼 사용할 수 있고, 카드 썸네일은 텍스트 없는 에디토리얼 컷으로 더 깔끔하게 읽힌다.
- 장점: Firestore seed 전에도 사용자 이벤트 목록/상세에서는 로컬 2026 카탈로그 이벤트가 보조 데이터로 노출되어 신규 이벤트 QA가 가능하다.
- 장점: 문구가 합성된 `banner`, 카드용 `thumb`, 텍스트 없는 `detail` 역할을 분리했고, 목록 대표 히어로와 상세 페이지는 오버레이 UI와 겹치지 않도록 `detail` 이미지를 사용한다.
- 보완점: `getTotalParticipants()`가 제한 없는 이벤트 포함 시 `제한 없음`을 표시해 통계 카드의 의미가 어색할 수 있다.
- 보완점: Firestore upsert는 로컬 Google Application Default Credentials가 없어 실행하지 못했다. 현재 사용자 화면은 로컬 2026 카탈로그 fallback을 병합해 표시한다.

## 우선 개선 포인트
- 1순위: 이벤트 통계 카드의 총 참여자 표기를 숫자 합산 기준으로 바꿀지 정책을 정한다.
- 2순위: 실제 운영 이벤트 이미지가 준비되면 준비중 이미지 fallback 패턴과 `detailImage` 업로드 정책을 함께 재검토한다.

## 2026-06-05 템플릿 느낌/모바일 디자인 보정
- 이벤트 `featuredEyebrow`와 상세 eyebrow의 영문 장식 문구를 한국어 쇼핑 문맥으로 교체했다.
- 640px 이하 이벤트 목록에서 대표 배너와 카드 높이, 어두운 오버레이를 낮춰 검은 프로모션 카드 반복감을 줄였다.
- 모바일 이벤트 목록에서는 도움말 챗봇 플로팅 버튼을 숨겨 첫 이벤트 카드 CTA를 가리지 않게 했다.
- 390px 화면 확인 기준 `/events`에서 챗봇/개발 도구 버튼 미노출, 수평 오버플로우 없음.

## 2026-06-05 대표 이벤트 이미지 분리 보정
- 목록 대표 히어로가 문구 합성 `bannerImage`를 배경으로 쓰면서 UI 제목과 이미지 내 텍스트가 겹치는 문제가 있었다.
- `src/app/events/_components/EventList.tsx`에서 대표 히어로 이미지 소스를 `detailImage > bannerImage > 기존 bannerImage` 순서로 바꿨다.
- Chrome 확인 기준 `/events/` 첫 화면 대표 이미지는 `event-2026-05-best-review-detail.webp`를 사용하고, 첫 화면 대표 영역에서 `*-banner.webp`는 사용하지 않는다.
- 목록/상세의 주요 제목, 기간, 쿠폰/CTA, 혜택 값에는 긴 무공백 문자열이 모바일 폭을 밀어내지 않도록 `overflow-wrap: anywhere` 방어를 추가했다.
- 운영자가 새 이벤트 이미지를 직접 올릴 때도 텍스트가 합성된 배너와 별개로 `detailImage`를 함께 등록해야 목록 대표 히어로와 상세 페이지에서 같은 문제가 재발하지 않는다.

## 2026-06-22 이벤트 HTML 렌더링 방어
- 상세 본문의 HTML 렌더링은 `src/shared/utils/eventHtml.ts` allowlist sanitizer를 거쳐 출력한다.
- `script`, `style`, `iframe`, `object`, `embed`, `form` 계열 태그와 이벤트 핸들러 속성은 제거하고, 링크는 안전한 `href`만 유지한다.
- `src/shared/utils/eventHtml.test.ts`로 스크립트 제거, 허용 태그 보존, 위험 링크 제거를 검증했다.

## 2026-06-30 메인 배너 이벤트 연결
- 메인 상단 배너는 `미드이어 세일`, `바캉스 스타일 안내`, `쿨터치 데일리 세일` 상세로 연결한다.
- 메인 배너 이미지는 텍스트 없는 모델/배경 이미지로 생성하고, 이벤트 카피는 `MainBanner` UI에서 별도로 렌더링한다.

## 2026-06-30 이벤트 페이지 폰트 보정
- 목록 히어로 제목과 이벤트 카드 제목에 `--font-heading`을 적용해 더 고급스러운 쇼핑몰 이벤트 톤으로 조정했다.
- 상세 페이지의 이벤트 제목, 섹션 제목, 배너 보조 제목에도 같은 heading 폰트를 적용했다.

## 2026-06-30 이벤트 데이터 Firebase 이관
- 기존 로컬 2026 이벤트 20개를 Firebase `events` 컬렉션에 문서 ID 기준으로 upsert했다.
- 사용자 이벤트 목록과 상세 페이지는 Firebase `events` 컬렉션만 조회하고 로컬 mock fallback은 사용하지 않는다.
- 관리자 이벤트 수정 페이지는 Firestore 문서를 불러와 `EventForm`으로 수정할 수 있게 연결했다.
- 관리자 목록은 진행중, 예정, 종료, 비활성 상태와 세일, 쿠폰, 특별, 신상 유형으로 구분해 필터링한다.
- 과한 굵기와 음수 자간은 줄이고, UI 텍스트는 기존 기본 폰트를 유지했다.

## 2026-07-10 이벤트 참여 서버화
- 직접 참여 이벤트는 `/api/event/participate` Function을 통해서만 처리한다. UID·참여자 수·보상 쿠폰은 클라이언트 입력이 아니라 서버가 결정한다.
- 참여 문서는 `{eventId}_{uid}` 결정적 ID를 사용하며, 중복 클릭·재시도는 참여자 수나 보상 쿠폰을 중복 생성하지 않는다.
- 자동 지급 쿠폰 이벤트는 관리자 화면에서 `rewardCouponId`를 설정해야 한다. 참여 transaction은 이벤트 상태·기간·정원·쿠폰 발급 가능 여부를 함께 검증한 뒤 참여와 쿠폰을 원자적으로 기록한다.

## 2026-07-21 이벤트 자격·보상 계약

- `src/shared/types/event.ts`는 `EventEligibilityType = 'none' | 'purchase' | 'delivered' | 'review'`, `EventRewardType = 'none' | 'coupon'`을 정의한다. `eligibilityType`과 `rewardType`은 기존 Firestore 문서 읽기 호환을 위해 타입상 optional이지만, 새 관리자 입력과 서버 참여 판정에서는 유효 값이 없으면 fail-closed한다.
- `purchase | delivered | review` 자격은 trim·중복 제거된 `targetProducts`가 필요하다. `coupon` 보상은 `rewardCouponId`가 필요하며, `none` 보상은 stale coupon ID를 남기지 않는다.
- `functions/src/domain/purchaseEvidence.ts`의 `isDeliveredOrderStatus()`, `getOrderProducts()`, `orderHasTargetProduct()`, `buildReviewDocumentId()`가 구매·배송·리뷰 증거 계약을 공유한다.
- `assertEventEligibility()`는 본인 주문과 대상 상품을 확인한다. `purchase`는 취소·반품·교환 상태를 제외하고, `delivered`는 배송 완료·구매 확정만 허용하며, `review`는 같은 주문·상품·size/color의 `verifiedPurchase: true` 결정적 review 문서까지 요구한다.
- `functions/src/handlers/event.ts`의 참여 transaction은 이벤트/참여 문서를 읽고 기간·활성·중복·정원·자격·쿠폰 발급 가능성을 확인한 다음 보상 쿠폰, participant 문서와 `participantCount`를 한 transaction에서 기록한다. 자격 또는 쿠폰 발급이 실패하면 참여와 count도 남지 않는다.
- 자격 오류는 `event_misconfigured`, `ineligible_purchase`, `ineligible_delivered`, `ineligible_review`의 stable code를 반환한다. 클라이언트 `getEventParticipationErrorMessage()`는 code를 재선택·구매·배송·리뷰 안내로 매핑한다.

## 2026-07-21 legacy dry-run과 수동 gate

- `scripts/event-eligibility-migration.js`의 `planEventEligibilityPatch(event)`는 입력을 수정하지 않고 `patch`, `reasons`, `requiresManualTargetProducts`, `deleteFields`를 반환한다. `deleteFields`는 자격/보상과 맞지 않는 legacy `targetProducts` 또는 `rewardCouponId`를 proposed cleanup으로 표시한다.
- CLI는 import-safe `analyze` dry-run만 제공하고 write API나 실행 옵션을 구현하지 않았다. 실제 DB migration은 이 문서 작업에서 수행하지 않았다.
- dry-run 결과가 `requiresManualConfiguration: false`여도 `patch`와 `deleteFields`가 있으면 제안된 정규화 변경을 반영해야 한다. `requiresManualTargetProducts: true`인 이벤트는 대상 상품 ID까지 명시적으로 보정해야 한다.
- 최신 read-only 분석 결과는 `manualTargetProductCount=4`, `manualPublicPolicyVerificationCount=22`, `manualConfigurationCount=22`다. 이 gate와 제안 patch를 모두 해소하기 전에는 향후 migration execute나 배포를 진행하면 안 된다.

## 2026-07-21 이벤트 공개 정책 gate

- `firestore.rules`는 이벤트 문서 읽기를 `publicPolicyVerified: true`인 공개 문서 또는 활성 계정·Auth claim·사용자 문서 role을 모두 만족하는 strict admin으로 제한한다. 검증 값이 없거나 `false`이면 직접 문서 읽기와 목록 쿼리 모두 실패한다.
- 공개 화면은 `EventService.getPublicEvents()`와 `getPublicEventById()`만 사용한다. 관리자 목록·상세·대시보드는 인증된 브라우저 컨텍스트에서 `getAdminEvents()`, `getAdminEventById()`, `getAdminActiveEvents()`를 사용하므로 검증 전 문서도 운영자가 수정할 수 있다.
- 목록·상세 컴포넌트, 상세 메타데이터와 `/api/event/participate` Function도 `publicPolicyVerified === true`를 별도로 확인해 원본 제목·설명·이미지 또는 참여 경로가 우회 노출되지 않게 한다.
- 관리자 폼은 공개 검증 체크 자체를 제외한 내용·자격·보상·이미지 변경 시 검증 값을 `false`로 되돌린다. 이미지 Firebase sync의 `apply`도 이미지 URL과 `publicPolicyVerified: false`를 같은 batch에 기록한다.
- 현재 Firestore 22개 이벤트는 검증 값이 없거나 `false`라 공개 목록과 상세에서 모두 숨겨진다. 이번 작업에서는 DB migration, 공개 값 변경, seed 또는 deploy를 실행하지 않았다.

## 2026-07-21 정책 정합 이미지 준비 상태

- 새 매니페스트 버전은 `20260721`이다. 와이드·카드 44개는 `public/events/2026-v3/*-20260721-*.webp`, 상세 에디토리얼 66개는 `public/events/2026-editorial/*-20260721-*.webp`의 새 immutable 경로를 사용한다.
- 정책에 없는 쿠폰·포인트·리뷰 보상·사람 상담·MD 추천·실적 주장을 제거한 프롬프트와 업로드/검증/복구 도구만 준비했다. 기대 파일은 총 110개지만 현재 로컬 생성 파일은 **0개**이며 업로드와 Firestore `apply`도 실행하지 않았다.
- `npm run event-images:firebase:analyze`는 안전하게 실패하며 `events=22 localAssets=0`을 보고한다. 2026-07-15의 기존 44개 이미지는 파일·Storage 배포 이력일 뿐 현재 정책 검증 근거가 아니며, 새 이미지 검수와 이벤트별 수동 정책 확인 전에는 다시 공개하면 안 된다.
- sync 도구의 backup/rollback은 각 이벤트의 기존 이미지 필드와 `publicPolicyVerified`의 미존재·`false`·`true` 상태를 구분해 복원한다. Storage 객체는 immutable 신규 경로만 사용하며 기존 객체를 삭제하거나 덮어쓰지 않는다.
- `public/events/2026` 80개, `public/events/2026-v2` 44개와 `public/events/2026-editorial`의 `20260715` 파일 24개는 Firestore Rules와 무관한 Firebase Hosting 정적 경로다. 기존 배포에서는 직접 URL이 계속 응답하므로 `firebase.json`에 이 세 레거시 패턴을 `/events/`로 보내는 임시 `302` redirect를 추가했다.
- 생성 예정인 `2026-v3`와 `20260721` editorial 경로도 정책 검증 전 노출을 막기 위해 같은 임시 redirect를 둔다. 새 110개 이미지 검수와 이벤트 22건의 수동 검증이 끝난 뒤 승인된 패턴만 redirect에서 제거하고 Hosting을 배포해야 한다. 이번 작업에서는 배포하지 않았으므로 현재 원격 정적 URL 차단은 아직 반영되지 않았다.
- Firebase Storage의 기존 `events/**` 객체는 Hosting redirect 대상이 아니다. 당시 로컬 `storage.rules`는 legacy와 `20260721`을 포함한 모든 이벤트 객체의 원시 공개 읽기를 막고 strict admin만 읽도록 fail-closed했다. 승인된 버전만 별도 Rules 변경으로 공개해야 한다.
- bulk sync가 만드는 URL은 download token이 없으므로 위 Rules 공개 전에는 읽을 수 없다. 반면 관리자 폼의 `getDownloadURL()` 업로드는 token URL을 생성하므로 그 URL이 유출되면 Rules의 원시 공개 읽기와 별개로 접근할 수 있다. 검증 취소·이미지 교체 시 Firestore 공개 값 reset뿐 아니라 기존 token 폐기 또는 객체 정리 절차가 필요하다.
- 이번 작업에서는 Storage Rules 배포, 기존 객체 삭제·token 폐기 또는 Hosting 배포를 실행하지 않았다. 따라서 현재 원격 legacy Hosting/Storage URL은 새 로컬 gate를 배포하기 전까지 계속 노출되는 미해결 운영 위험이다.

## 미구현 확장성 위험

- `assertEventEligibility()`는 자격 판정을 위해 해당 사용자의 주문 전체를 transaction 안에서 읽는다. 임의 limit으로 오래된 유효 주문을 누락시키지 않기 위한 현재 계약이지만, 주문량이 많은 사용자의 read 비용과 transaction 한도가 커질 수 있다.
- 사용자별 eligibility projection 또는 상품·상태별 증거 index로 전환하는 최적화는 이번 범위에서 구현하지 않았다.

## 2026-07-21 로컬 공개 화면 QA

- production build를 로컬로 실행해 1440×900과 390×844에서 `/events`를 확인했다. 공개 검증된 이벤트가 없으므로 `진행 중인 이벤트가 없습니다`라는 안전한 빈 상태만 표시됐고, 기존 이벤트 제목·혜택·이미지는 노출되지 않았다.
- 두 viewport 모두 가로 오버플로가 0이었고 브라우저 console error는 없었다. 모바일 필터와 메뉴도 정상 노출됐다.
- 회원가입, 법적 안내, FAQ·공지, 가상 매장, 비로그인 체크아웃까지 함께 확인했으며 정책에 없는 첫 구매 할인·포인트 적립·당일 출고·MD 추천·사람 상담 보장 문구는 발견되지 않았다.
- QA 중 주문 제출, Firebase write, seed, migration, 배포는 수행하지 않았다.

## 2026-07-21 목록 접근성 구조

- 이벤트 목록에는 페이지를 설명하는 유일한 `h1`을 제공하고, 각 카드의 행사명은 이미지와 별개인 `h2`, 혜택 설명은 본문 텍스트로 렌더링한다.
- 이벤트 유형 필터는 현재 선택을 `aria-pressed`로, 페이지 번호는 현재 페이지를 `aria-current="page"`로 전달한다.
- 공개 정책 gate와 기존 4열·2열·1열 레이아웃은 유지한다.

## 2026-07-15 레거시 이벤트 이미지 배포 기록 (현재 공개 검증 만료)
- 아래 내용은 당시 배포 기록이다. 이미지 안에 현재 정책과 맞지 않는 혜택·지원 문구가 확인되어 2026-07-21부터 공개 검증 근거로 사용할 수 없다.
- Firestore 이벤트 22개에 맞춰 와이드 22개와 카드 22개, 총 44개 WebP 이미지를 새로 제작했다. 모든 이미지에 행사명과 혜택 한글 문구를 직접 포함했다.
- 여성·남성·혼성 그룹과 제품 단독 컷을 섞고 계절, 장소, 포즈, 팔레트를 분산해 이벤트별 시각 반복을 줄였다.
- 와이드는 `1600x820`, 카드는 `1000x1250`으로 정규화했다. Storage에는 `events/banner/{id}-20260714-wide.webp`, `events/thumbnail/{id}-20260714-card.webp` 경로로 신규 객체만 추가했으며 기존 객체는 삭제하지 않았다.
- Firestore의 `bannerImage`와 `detailImage`는 같은 와이드 URL, `thumbnailImage`는 카드 URL로 22개 문서를 한 batch에서 전환했다. 전환 전 이미지 필드는 `%TEMP%/hebimall-event-image-backup-20260714.json`에 보존했다.
- 업로드 도구는 Firestore 프로젝트와 Storage 버킷의 일치를 로컬 파일 접근 전에 확인하고, 생성 전용 조건으로 같은 immutable 경로의 기존 객체 덮어쓰기를 차단한다.
- 목록 대표와 상세 상단은 데스크톱에서 와이드, 모바일에서 카드 이미지를 선택한다. 목록 카드도 카드 이미지를 사용하며, 이미지에 이미 포함된 행사명·혜택과 겹치던 제목·설명·할인 오버레이는 제거하고 접근 가능한 링크 이름은 유지했다.
- 목록 카드의 기간과 CTA는 이미지 아래 별도 영역에 배치해 이미지에 포함된 하단 한글 혜택 문구를 가리지 않는다.
- 당시 정규화 검증은 44/44, Storage 검증은 44/44, Firestore 문서 검증은 22/22, 이미지 HTTP 응답은 44/44 통과했다. 이는 현재 문구 정책 검증 완료를 의미하지 않는다.

## 2026-07-15 이벤트 상세 커머스 템플릿 리뉴얼
- 상세 흐름을 `캠페인 이미지 → 제목·기간 → 핵심 혜택/CTA → 관련 상품 → 3개 안내 영역 → 후속 링크` 순서로 교체했다. 이미지에 이미 포함된 행사명·할인 문구를 UI로 다시 덮지 않는다.
- 무제한 이벤트의 `0명 (제한 없음)` 표시는 제거하고, 실제 정원이 설정된 이벤트만 현재 참여 인원과 정원을 표시한다.
- 명시 상품 ID, 대상 카테고리, 이벤트 변형 fallback 순서로 최대 8개를 불러오며 기존 `ProductCard`를 재사용한다. 세일·쿠폰·리뷰·신상 변형은 각각 할인, 추천, 리뷰 인기, 신상품 소스를 사용한다.
- 상품 조회 실패는 이벤트 본문과 분리된 오류/재시도 상태로 처리하고, 상품이 없을 때도 변형별 상품 목록 링크를 제공한다.
- 기존 상품 화면은 조회 실패 시 빈 목록을 반환하는 동작을 유지하고, 이벤트 전용 상품 로더만 오류를 전달해 실제 서비스 실패도 재시도 화면으로 연결한다.
- 혜택/본문, 참여·사용 방법, 유의사항으로 안내 영역을 정확히 3개로 줄였다. 데스크톱은 세 영역을 모두 펼치고, 640px 이하는 첫 영역만 기본으로 열리는 아코디언과 하단 고정 CTA를 사용한다.
- 실제 브라우저 1280×720에서 상세 22개를 순회해 캠페인 이미지, 핵심 CTA, 상품 섹션, 안내 컨트롤 3개, 가로 오버플로우 없음, 콘솔 오류 없음을 확인했다. `last-summer` 상품 영역은 첫 진입 기준 1.47 viewport 지점에서 시작하고 상품 8개·4열로 표시됐다.
- 브라우저의 고정 viewport 제한 때문에 390px 시각 캡처는 수행하지 못했다. 모바일 카드 이미지 source, 2열 상품, 닫힌 패널, 고정 CTA와 하단 여백은 컴포넌트 테스트와 640px 미디어쿼리 정적 검증으로 확인했다.
- 종료 이벤트 CTA는 신규 참여를 호출하지 않고 세일·신상은 추천 상품, 리뷰는 리뷰 목록, 쿠폰·특별 이벤트는 전체 이벤트로 이동한다.

## 2026-07-15 이벤트 목록 클린 갤러리 보정

- 상단 대표 캠페인 이미지 위 상태, 기간, CTA, 현황 오버레이를 제거하고 이미지 자체를 상세 링크로 사용한다.
- 카드 이미지 위 유형·상태 배지를 제거하고, 기간과 CTA만 이미지 아래의 흰 정보 영역에 유지한다.
- 데스크톱은 4열, 태블릿은 2열, 모바일은 1열로 표시한다.
- 카드 자산은 1000×1250의 4:5 비율을 사용하며 `object-fit: contain`으로 전체 이미지가 잘리지 않게 표시한다.
- 상단은 개별 이벤트 링크 대신 `STYNA EVENTS`, `새로운 스타일과 혜택을 만나보세요` 문구가 포함된 상시 이벤트 허브 이미지로 교체했다.
- 허브 이미지는 2700×900 WebP이며 링크와 UI 오버레이 없이 27:9 비율 전체를 표시한다.
- 카드 목록은 페이지당 8개로 변경해 데스크톱에서 4열 × 2줄을 구성한다.
- 1280×720 브라우저 확인에서 허브 실제 비율 3.0, 링크 없음, 카드 8개·4개씩 2줄, 페이지 번호 1~3, 가로 오버플로우 0, 콘솔 오류 0을 확인했다.

## 2026-07-31 이벤트 안전 재공개 준비

- 기존 22개 이벤트의 날짜와 식별자는 유지하고, 현재 제공 가능한 상품·참여 조건만 남도록 제목·설명·본문·자격·보상을 검증했다. 근거 없는 쿠폰·적립금 보상은 제거하고 모든 이벤트의 `rewardType`을 `none`으로 통일했다.
- 2026년 8~9월 세일 3개, 신상품 3개, 특별 기획 2개, 구매 인증 리뷰 2개를 추가해 총 32개 매니페스트를 `publicationVersion: 20260731`로 관리한다.
- 목록에 `진행·예정 이벤트`와 `종료된 이벤트` 상태 탭을 추가했다. 기준 시각 2026-07-31에는 각각 16개이며, 유형 필터와 페이지네이션이 상태 탭과 함께 재계산된다.
- 세일 상품 fallback에는 실제 `isSale`, 신상품 fallback에는 실제 `isNew` 상품만 남도록 필터를 강화했다. 리뷰 이벤트의 명시 대상 상품 6개도 운영 상품 존재·활성 상태를 검증했다.
- 이미지 64개 중 기존 안전 자산 6개를 그대로 사용하고, 텍스트 없는 기존 원본에서 34개를 파생했으며, 12개의 새 원본으로 24개를 제작했다. 새 immutable Storage 객체 58개는 업로드와 원격 존재 확인을 모두 통과했다.
- 운영 Firestore에는 32개 문서를 `publicPolicyVerified: false`로 스테이징했다. 검증 결과 32개 모두 유효하고 공개 값은 `false` 32개, `true` 0개다. 복구용 백업은 `migration-logs/event-publication/20260731/backups/2026-07-31T07-37-13-667Z.json`에 보관한다.
- Firestore Emulator에는 공개 이벤트 32개와 대상 운영 상품 6개를 로컬 복제해 브라우저 QA를 진행했다. 목록은 상태별 16개, 페이지당 8개, 종료 탭·세일 필터 조합, 390px 모바일 가로 넘침 없음, 이미지 오류 없음으로 확인했다.
- 신규 `여름 소재 구매 인증 리뷰` 상세에서 명시 대상 상품 3개가 우선 노출되고 리뷰 인기 fallback이 이어지는지, 안전 문구와 무보상 안내, 이미지, 콘솔 오류를 확인했다.
- Storage Rules는 `events/publication/*-20260731-wide.webp`와 `*-20260731-card.webp`, 재사용 승인을 받은 기존 3개 이벤트의 정확한 와이드·카드 파일 6개만 공개 읽기를 허용한다. 그 밖의 버전, 역할, 무버전 파일과 기존 이벤트 경로는 계속 관리자 전용이다.
- 사용자 승인 후 Firebase Functions·Hosting·Firestore·Storage Rules를 배포하고 32개 이벤트를 `publicPolicyVerified: true`로 전환했다. 운영과 로컬 목록에서 진행·예정 16개, 종료 16개와 페이지당 8개를 확인했다.
- 상세 날짜 포맷은 `Asia/Seoul`을 명시해 UTC인 운영 서버와 한국 시간 브라우저의 hydration 텍스트가 일치하도록 보정했다. 운영 신규 리뷰 상세에서 대상 상품, 이미지, 가로 넘침, 콘솔 오류가 없음을 확인했다.
