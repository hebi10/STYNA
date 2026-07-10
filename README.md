# STYNA — 패션 이커머스 포트폴리오

Next.js App Router와 Firebase를 기반으로 제작한 패션 이커머스 포트폴리오 데모입니다.
상품 탐색부터 주문 작성, 리뷰, QnA, 쿠폰, 포인트, 관리자 대시보드까지 주요 흐름을
구현했습니다. 실제 결제·배송·사업자 운영 서비스는 제공하지 않으며, 화면의 주문과
회원 데이터는 기능 시연을 위한 데이터입니다.

## 사용 기술

| 구분 | 기술 | 선택 이유 |
|------|------|-----------|
| Framework | Next.js 15 (App Router) | 중첩 레이아웃으로 관리자 영역과 사용자 영역을 분리 |
| Language | TypeScript | Firestore 문서 타입과 서비스 레이어를 명시적으로 관리 |
| Styling | CSS Modules | 전역 스타일 충돌 방지 |
| State | React Context + TanStack Query | 인증·전역 상태는 Context, 서버 데이터 캐싱은 Query로 분리 |
| Backend | Firebase (Firestore / Auth / Storage / Functions) | 인증, DB, 파일 저장, 서버 로직을 단일 플랫폼으로 관리 |
| UI | Swiper, @dnd-kit | 이미지 슬라이더와 관리자 상품 순서 편집에 각각 사용 |

## 주요 기능

### 사용자

- 이메일/비밀번호, 소셜 로그인 (Firebase Auth)
- 상품 목록, 카테고리 필터, 키워드 검색
- 장바구니 담기, 수량·옵션 변경
- 서버 검증을 거친 데모 주문 생성 및 주문 내역 조회 (실제 결제 미연동)
- 상품 리뷰 작성 (이미지 포함)
- 1:1 QnA 작성 및 답변 조회
- 쿠폰 보유 및 주문 시 적용
- 포인트 적립·사용 내역 조회
- 규칙 기반 상담 안내와 설정된 환경에서의 AI 상담 연동

### 관리자 (`/admin`)

- 주문·매출 현황 대시보드
- 상품 등록·수정·삭제, 이미지 업로드, 드래그 정렬
- 주문 상태 변경
- 사용자 목록 조회 및 권한 관리
- 쿠폰 생성 및 발급 현황
- 이벤트 등록 및 기간 설정
- QnA 답변 처리
- 리뷰 검토 및 관리

### Cloud Functions

- 주문·쿠폰·이벤트 참여·QnA·리뷰의 서버 측 권한 및 상태 처리
- 채팅 응답과 관리자 사용자 관리
- 만료 쿠폰·포인트 정리 스케줄러

## 폴더 구조

```
src/
├── app/
│   ├── admin/           # 관리자 영역 (별도 레이아웃)
│   ├── auth/            # 로그인·회원가입·비밀번호 찾기
│   ├── cart/
│   ├── categories/
│   ├── events/
│   ├── mypage/
│   ├── orders/
│   ├── products/[id]/
│   ├── qna/
│   ├── recommend/
│   ├── reviews/
│   ├── search/
│   └── _components/     # 전역 공통 컴포넌트
├── context/             # React Context Providers (auth, product, coupon 등)
└── shared/
    ├── libs/firebase/   # Firebase 초기화 (auth, storage)
    ├── services/        # Firestore CRUD 서비스 함수
    ├── hooks/           # 커스텀 훅
    ├── types/           # TypeScript 타입 정의
    └── utils/

functions/               # Firebase Cloud Functions
└── src/
    ├── handlers/        # order, coupon, points, chat, adminUsers, qna
    └── cron/            # 만료 처리 스케줄러
```

## 실행 방법

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 설정 (.env.local)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# 3. 개발 서버 실행
npm run dev
```

초기 데이터 세팅이 필요한 경우:

```bash
npm run seed:categories
npm run seed:products
npm run seed:coupons
```

## 데이터/백엔드 구성

**Firestore 컬렉션**

| 컬렉션 | 용도 |
|--------|------|
| users | 사용자 프로필, 표시용 상태와 기본 정보 |
| products | 상품 정보, 옵션, 재고 |
| categories | 카테고리 트리 |
| orders | 주문 내역 및 상태 |
| reviews | 상품 리뷰, 평점 |
| qna | 1:1 문의 및 답변 |
| coupons | 쿠폰 마스터 데이터 |
| user_coupons | 사용자별 쿠폰 발급·사용 현황 |
| events | 이벤트 기간, 대상 상품 |
| cart | 장바구니 (사용자별 문서) |
| points | 포인트 적립·사용 내역 |

**Firebase Security Rules**

`firestore.rules`, `storage.rules`로 미인증 접근과 일반 사용자의
쓰기 범위를 제한합니다. 관리자 권한은 인증 토큰 및 사용자 문서의
관리자 상태를 함께 검증하며, 금액·재고·쿠폰 상태 변경은 서버 경로로 처리합니다.

## 상세 문서

| 문서 | 내용 |
|------|------|
| [docs/env-setup.md](docs/env-setup.md) | 환경변수 설정, Firebase Secrets 관리 |
| [docs/coupon-system.md](docs/coupon-system.md) | 쿠폰 Firestore 구조, 서비스 로직, Cloud Functions |
| [docs/dashboard.md](docs/dashboard.md) | 관리자 대시보드 구조, 데이터 레이어 |
| [docs/storage-structure.md](docs/storage-structure.md) | Firebase Storage 경로 구조, 업로드 함수 |

## 작업 메모

- Context Provider가 늘어나면서 Provider 중첩이 깊어졌다. 서버 데이터 성격의
  항목은 TanStack Query로 대체하는 방향을 검토 중이다.
- Firestore 무료 티어 제한으로 인해 실시간 리스너 대신 요청 시 패치 방식을
  일부 구간에서 사용했다.
- 관리자 상품 이미지 정렬에 @dnd-kit을 적용했으나 모바일 드래그 지원이
  불안정해 개선이 필요하다.

## 향후 개선 사항

- 실결제 및 실제 배송 연동
- 운영 환경 데이터에 맞춘 관리자 지표·비용 추정 고도화
- 검색 자동완성과 사용자 데이터 기반 추천
