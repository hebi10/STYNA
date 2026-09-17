# STYNA — 패션 이커머스 포트폴리오

STYNA는 Next.js App Router와 Firebase로 제작한 패션 이커머스 포트폴리오 데모입니다.
상품 탐색, 로그인, 장바구니, 주문 작성, 리뷰, 문의, 쿠폰, 포인트, 관리자 운영 화면을
실제 데이터 흐름으로 연결했습니다. 실제 PG 승인·청구·환불, 택배 접수·배송 추적,
사업자 운영 서비스는 제공하지 않습니다.

화면에서 입력한 회원 정보, 배송지와 주문 기록은 데모 기능을 위해 Firebase에 저장될 수
있습니다. 프로젝트의 제품 방향은 [PRODUCT.md](PRODUCT.md), 상세 문서 허브는
[docs/README.md](docs/README.md)에서 확인할 수 있습니다.

## 프로젝트 범위

| 항목 | 현재 구현 범위 |
|------|----------------|
| 인증 | Firebase 이메일·비밀번호 회원가입/로그인, 비밀번호 재설정, 로그인 유지 설정 |
| 데모 로그인 | `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true`일 때 일반 회원·읽기 전용 관리자 빠른 로그인 노출 |
| 소셜 OAuth | 카카오·네이버·구글 등 실제 소셜 OAuth는 구현하지 않음 |
| 결제 | 결제수단을 포함한 데모 주문 기록만 생성하며 실제 승인·청구 없음 |
| 배송 | 배송지·배송비·주문 상태를 기록하지만 실제 출고·배송 추적 없음 |
| 고객지원 | FAQ, 공지, 상품 QnA, 1:1 문의 기록 조회. 답변 시점이나 SLA는 보장하지 않음 |
| 상담 챗봇 | 규칙 기반 응답 기본 제공, 환경이 구성된 경우 Firebase Function에서 OpenAI 연동 |

## 사용 기술

| 구분 | 기술 | 역할 |
|------|------|------|
| Framework | Next.js 15.5.20 App Router | 사용자·관리자 라우트, API Route, 메타데이터와 SSR 구성 |
| Runtime | React 19.1, TypeScript 5 | 컴포넌트와 Firestore 데이터 타입 관리 |
| Styling | CSS Modules, 전역 CSS | 화면별 스타일 격리와 공통 디자인 토큰 관리 |
| State | React Context + TanStack Query | 인증·전역 상태와 서버 조회 캐시를 분리 |
| Backend | Firebase Auth / Firestore / Storage / Functions / Hosting | 인증, 데이터, 이미지, 서버 권한 처리, 배포 |
| Functions | Firebase Functions v2, Node.js 22 | 주문·쿠폰·포인트·문의·리뷰·채팅 서버 처리 |
| Tooling | Jest, Testing Library, ESLint, Sharp | 테스트, 품질 게이트, 이미지 변환과 검증 |

현재 이미지 슬라이드와 정렬 UI는 프로젝트 내부 React/CSS 구현을 사용하며 `Swiper`와
`@dnd-kit`은 직접 의존하지 않습니다.

## 주요 기능

### 사용자 화면

- 상품 목록, 카테고리·브랜드 탐색, 키워드 검색
- 추천 상품 필터: 전체, 평점, 리뷰, 세일, 신상품
- 홈 편집 영역: 메인 배너, 동적 카테고리, STYNA SELECT, 신상품, STYNA FILM, 베스트 랭킹, 세일 상품, 스타일나우, 포트폴리오 안내
- 이벤트 목록·상세·참여 흐름과 공개 정책 검증
- 상품 상세, 옵션·수량 선택, 장바구니와 바로구매 의도 복원
- 배송지 직접 입력, 쿠폰·포인트 적용, 데모 주문 생성과 주문 내역 조회
- 상품 리뷰 작성·구매 증빙 검증과 리뷰 통계
- 상품 QnA 작성·조회와 비공개 문의 검증
- 로그인 사용자의 1:1 문의 작성·내역·답변 읽음 처리
- 쿠폰 보유·등록·사용, 포인트 잔액·적립·사용·만료 내역
- 최근 본 상품과 찜한 상품
- FAQ, 공지사항, 오프라인 매장·서비스 안내
- 규칙 기반 도움말 챗봇과 선택적 AI 응답

### 관리자 화면 (`/admin`)

- 주문·매출·사용자·상품·쿠폰·이벤트·문의 지표 대시보드
- 카테고리 등록·수정과 메인 카테고리 순서 관리
- 상품 등록·수정·삭제, 이미지 WebP 업로드, 메인 이미지 지정·삭제
- STYNA SELECT 추천 상품과 무드 이미지·표시 순서 관리
- 주문 목록·상태 변경·CSV 다운로드
- 사용자 목록·상태·역할·포인트 관리와 CSV 다운로드
- 쿠폰 생성·수정·보관, 사용자 쿠폰 발급·사용 현황
- 이벤트 생성·수정·기간·참여 조건·공개 정책 관리
- 상품 QnA 답변, 1:1 문의 답변·상태·읽음 관리
- 리뷰 검토·관리

### Cloud Functions

- `order`: 재고·금액·쿠폰·포인트를 검증한 주문 생성과 주문 후처리
- `coupon`: 쿠폰 생성·수정·발급·사용·만료 처리
- `points`: 포인트 지급·사용·관리자 조정
- `event`: 이벤트 참여 자격·중복 참여·보상 쿠폰 처리
- `qna`: 비공개 문의 검증과 QnA 서버 처리
- `review`: 구매 상품 리뷰 작성과 삭제 검증
- `adminUsers`: 관리자 역할·상태 변경과 Firebase Auth custom claims 동기화
- `chat`: 규칙 기반 응답, 선택적 OpenAI 호출, 사용량 제한
- `config`: 클라이언트용 Firebase·환경 설정 제공
- `syncReviewProductStats`: 리뷰 변경 후 상품 리뷰 통계 동기화 trigger
- `expirePoints`, `cleanupExpiredCoupons`: 포인트·쿠폰 만료 스케줄러
- `nextjsServer`: Firebase Hosting에서 Next.js 서버 요청 처리

## 폴더 구조

```
src/
├── app/
│   ├── admin/             # 관리자 영역과 대시보드
│   ├── api/               # Firebase Functions 프록시·서버 경계
│   ├── auth/              # 로그인·회원가입·비밀번호 재설정
│   ├── brand/             # 브랜드 목록
│   ├── cart/              # /orders/cart 호환 리다이렉트
│   ├── categories/        # 카테고리·상품 목록
│   ├── cs/                # FAQ·공지·1:1 문의
│   ├── events/            # 이벤트 목록·상세
│   ├── legal/             # 데모 이용 안내·개인정보 안내
│   ├── main/sale/         # 세일 상품 전체 목록
│   ├── mypage/            # 주문·쿠폰·포인트·찜·최근 본 상품
│   ├── orders/            # 장바구니·체크아웃·완료·배송 안내
│   ├── products/[productId]/
│   ├── qna/               # 상품 QnA
│   ├── recommend/         # 기준형 추천 상품
│   ├── reviews/           # 공개 리뷰 목록
│   ├── search/            # 키워드 검색
│   ├── style-now/[season]/ # 시즌 콘텐츠
│   ├── support/offline/   # 오프라인 안내
│   └── _components/       # 전역 공통 컴포넌트
├── context/               # auth, category, coupon, event, product, review, activity
└── shared/
    ├── constants/         # 정책·SEO·라우트·사이트 정보
    ├── hooks/             # React Query와 공통 커스텀 훅
    ├── libs/firebase/     # Auth·Firestore·Storage·Functions 초기화
    ├── services/          # 도메인/매핑/Repository/Service 데이터 계층
    ├── types/             # TypeScript 도메인 타입
    └── utils/             # 검증·포맷·정책·세션 유틸리티

functions/
└── src/
    ├── config/            # 환경·Next runtime 설정
    ├── domain/            # 주문·쿠폰·이벤트·채팅·리뷰 도메인 규칙
    ├── handlers/          # HTTP Functions
    ├── triggers/          # Firestore trigger
    ├── cron/              # 만료 처리 스케줄러
    └── utils/             # Firebase 초기화·인증·HTTP 유틸리티
```

## 아키텍처와 기술 선택

### 상품 데이터 계층

상품 영역은 Firestore 구현 세부사항과 화면용 도메인 규칙을 한 서비스에 섞지 않도록 책임을 분리합니다.

- `productRepository.ts`: Firestore query/read/write와 cursor document 처리
- `productMapper.ts`: Firestore document를 `Product`로 정규화하고 write payload를 정리
- `productDomain.ts`: 검색, 필터, 정렬, keyset cursor 비교, 추천·랭킹 순수 함수
- `productService.ts`: 공개/관리자 조회 경계, fallback과 오류 정책을 조합하는 use-case 계층
- `useProducts.ts`: `productKeys`를 기준으로 TanStack Query 캐시를 화면에 제공

`productDomain.ts`와 `productMapper.ts`는 Firebase SDK에 의존하지 않도록 유지합니다. Firestore 구현이 바뀌어도 검색·정렬·추천 규칙을 독립적으로 테스트하기 위한 경계입니다. 상품 상세은 ID별 캐시를 공유하고, 목록·상세·홈 조회의 기본 staleTime은 5분으로 유지합니다. 다중 ID 조회는 현재 상세 캐시 재사용을 우선하며, 실제 read 수 측정에서 고유 ID가 지속적으로 10~20개 이상 필요한 경우 batch 조회를 검토합니다.

자세한 기준은 [docs/data-access-and-cache.md](docs/data-access-and-cache.md)를 참고하세요.

### 이미지 전송

상품·카테고리·이벤트 업로드 이미지는 WebP q75와 긴 변 최대 1600px를 기본 정책으로 사용합니다. 카드/썸네일은 250KB 이하, 일반 상세 이미지는 500KB 이하, 대형 배너·에디토리얼 이미지는 750KB 이하를 목표 기준으로 삼고 실제 Network 전송량과 LCP를 함께 확인합니다.

현재 Firebase Functions 배포 구조에서는 Next.js 이미지 최적화 프록시보다 원본 WebP와 브라우저 캐시 정책을 우선하며, 트래픽·원격 이미지 비중이 증가해 실측 이점이 확인될 때 CDN 또는 Next Image 최적화 재도입을 검토합니다. 자세한 기준은 [docs/image-delivery-performance.md](docs/image-delivery-performance.md)를 참고하세요.

## 실행 방법

### 사전 요구 사항

- Node.js: 루트 Next.js 개발은 프로젝트에서 사용하는 Node 환경, Functions 빌드·배포는 Node.js 22
- Firebase CLI: 에뮬레이터·Rules 테스트·배포에 필요
- Rules 테스트 실행 시 Firestore·Storage Emulator와 Java 실행 환경 필요

### 설치와 개발 서버

```bash
# 루트 의존성
npm install

# Cloud Functions 의존성
cd functions
npm install
cd ..

# .env.local 설정 후 Next 개발 서버
npm run dev
```

### 환경 변수

필수 Firebase 클라이언트 설정:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

선택 설정은 목적에 따라 사용합니다.

```env
# 로컬 API·Firebase Emulator
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true

# 포트폴리오 데모 배포에서만 일반 회원·읽기 전용 관리자 빠른 로그인 노출
NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true

# 채팅 Function 연결과 AI provider
CHAT_API_URL=
OPENAI_API_KEY=
CHAT_RATE_LIMIT_SALT=
OPENAI_CHAT_MODEL=gpt-4o-mini
```

`OPENAI_API_KEY`와 `CHAT_RATE_LIMIT_SALT`는 Firebase Functions Secret으로 관리하며,
실제 값은 저장소나 문서에 기록하지 않습니다. 자세한 환경변수·Secret·채팅 경계는
[docs/env-setup.md](docs/env-setup.md)를 참고하세요.

### 초기 데이터

필요한 데이터만 선택해 실행합니다.

```bash
npm run seed:categories
npm run seed:products
npm run seed:users
npm run seed:coupons
npm run seed:content
```

`npm run seed:all`은 카테고리와 상품 기본 시드만 실행합니다.

## 데이터·보안 구조

### Firestore 주요 경로

| 경로 | 용도 |
|------|------|
| `users/{uid}` | 사용자 프로필, 상태, 역할, 포인트 잔액 |
| `users/{uid}/pointHistory` | 포인트 적립·사용·환불·만료 내역 |
| `products` | 상품 정보, 옵션, 재고, 리뷰 통계 |
| `categories` | 카테고리와 중첩 상품 경로 |
| `categoryOrder` | 메인 카테고리 표시 순서 |
| `brandSummaries` | 공개 브랜드 요약 |
| `orders` | 데모 주문 내역과 상태 |
| `reviews` | 상품 리뷰와 평점 |
| `qna` | 상품 QnA |
| `inquiries` | 로그인 사용자의 1:1 문의와 답변 |
| `coupons` | 쿠폰 마스터 데이터 |
| `user_coupons` | 사용자별 쿠폰 발급·사용 상태 |
| `carts/{uid}` | 사용자별 장바구니 문서 |
| `events` | 이벤트 기간·대상 상품·참여 정책 |
| `eventParticipants` | 이벤트 참여 기록 |
| `faqs`, `notices` | 고객지원 정적 콘텐츠 |
| `mainBanners` | 메인 배너 콘텐츠 |
| `featuredProducts` | STYNA SELECT 추천 상품 설정 |
| `offlineStores`, `offlineServices`, `offlineInfo` | 오프라인 안내 콘텐츠 |
| `userRecentProducts`, `userWishlist` | 최근 본 상품·찜한 상품 |
| `migrationRuns` | 마이그레이션 실행 기록 |

`points`나 `cart`라는 별도 최상위 컬렉션을 사용하지 않습니다. 포인트는 사용자 문서와
`pointHistory` 하위 컬렉션에, 장바구니는 `carts/{uid}`에 저장합니다.

### Firebase Security Rules

`firestore.rules`와 `storage.rules`는 다음 경계를 적용합니다.

- 활성 계정과 본인 문서만 사용자별 데이터에 접근
- 관리자 custom claim, 사용자 문서의 `role == admin`, `status == active`를 함께 검증
- 주문 직접 생성·수정·삭제는 차단하고 주문 Function에서 금액·재고·쿠폰·포인트 검증
- 리뷰 직접 생성은 차단하고 리뷰 Function에서 구매 상품·작성자·중복 여부 검증
- QnA·1:1 문의는 작성자·관리자·답변 상태에 따른 읽기·수정 범위 검증
- Storage 업로드는 관리자 이미지 파일과 크기 조건을 검증

## 품질 게이트와 배포

```bash
npm run typecheck
npm run lint -- --max-warnings=0
npm test
npm run test:rules
npm run functions:build
npm run build
```

GitHub Actions의 상시 `CI` workflow는 push와 `main` 대상 PR에서 `quality`, `rules`, `build` 세 job을 분리 실행합니다. `quality`는 typecheck·lint·Jest·Functions build, `rules`는 Firebase Rules emulator 테스트, `build`는 CI용 Firebase 공개 설정으로 Next.js production build를 검증합니다.

배포 전 전체 검증은 `npm run verify`, Firebase 전체 배포는
`npm run deploy:firebase`를 사용합니다. Functions만 배포할 때도 predeploy 단계에서
최신 Next 산출물 복사와 채팅 provider 경계 검사를 수행합니다.

## 상세 문서

| 문서 | 내용 |
|------|------|
| [PRODUCT.md](PRODUCT.md) | 제품 목적, 사용자, 포트폴리오 범위와 원칙 |
| [docs/README.md](docs/README.md) | 전체 문서 허브와 권장 읽기 순서 |
| [docs/commerce-policy.md](docs/commerce-policy.md) | 데모 결제·배송·문의·챗봇 정책 |
| [docs/env-setup.md](docs/env-setup.md) | 환경변수, Firebase Secret, 채팅 연결 |
| [docs/quality-gates.md](docs/quality-gates.md) | 타입·lint·Jest·Rules·Functions·배포 검증 |
| [docs/data-access-and-cache.md](docs/data-access-and-cache.md) | 상품 데이터 계층, React Query 캐시, Firestore read 정책 |
| [docs/image-delivery-performance.md](docs/image-delivery-performance.md) | 이미지 WebP·용량·캐시·전송 성능 기준 |
| [docs/dashboard.md](docs/dashboard.md) | 관리자 대시보드 구조와 데이터 레이어 |
| [docs/coupon-system.md](docs/coupon-system.md) | 쿠폰 구조와 발급·사용 Functions |
| [docs/storage-structure.md](docs/storage-structure.md) | Firebase Storage 경로와 업로드 정책 |
| [docs/seo-routing.md](docs/seo-routing.md) | 공개 URL, canonical, robots, sitemap 정책 |

## 현재 알려진 범위와 향후 개선

- 추천 화면은 평점·리뷰·세일·신상품 기준의 기준형 큐레이션이며 개인 행동 기반 추천은 아직 제공하지 않습니다.
- 검색 자동완성, 리뷰 이미지 업로드 UI, 실결제·실배송 연동, 운영 환경에 맞춘 관리자 비용·지표 고도화는 향후 범위입니다.
- 과거 설계·실행 계획 문서에는 이전 구현 단계의 표현이 남아 있을 수 있습니다. 현재 동작의 기준은 코드와 이 README, `PRODUCT.md`, `docs/README.md`입니다.
