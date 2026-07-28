# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- 실제 쇼핑몰 흐름을 체험하려는 방문자
- 프론트엔드 구현, 데이터 연동, 운영 화면까지 확인하려는 채용 담당자와 포트폴리오 평가자

## Product Purpose

STYNA는 일반 사용자가 상품을 탐색하고 로그인, 장바구니, 주문 같은 쇼핑 흐름을 체험할 수 있는 패션 커머스 포트폴리오다. 화면은 실제 쇼핑몰처럼 간결하게 구성하되, 프로젝트 설명은 별도 안내 영역에서 확인할 수 있어야 한다.

## Positioning

정적 쇼핑몰 시안이 아니라 Firebase 상품 데이터, 일반·관리자 로그인, 상품 상세와 구매 흐름, 관리자 기능이 연결된 동작 가능한 포트폴리오다.

## Capabilities and Constraints

- 일반 로그인과 관리자 로그인은 유지한다.
- 배포 환경에서도 포트폴리오 확인을 위한 개발용 로그인을 사용할 수 있어야 한다.
- 홈은 쇼핑 우선 구조를 유지하고 포트폴리오 설명은 하단 안내 영역에 집중한다.
- 기존 상품 카드, 상품 상세 경로, Firebase 상품 데이터를 우선 재사용한다.
- 신규 UI에는 `box-shadow`와 `border-radius`를 추가하지 않는다.

## Evidence on Hand

- 실제 동작하는 Next.js App Router 애플리케이션과 Firebase 연동 코드
- `public/style-now/`의 계절별 화보 및 상품 이미지
- 계절별 20개 상품을 정의한 `scripts/style-now-image-manifest.json`
- 프로젝트 구조와 운영 정책을 정리한 `docs/README.md`

## Product Principles

- 첫 화면에서는 쇼핑 경험을 우선한다.
- 포트폴리오 설명보다 실제 동작으로 구현 역량을 증명한다.
- 기존 인증, 상품, 주문 동작을 시각 개편보다 우선 보존한다.
- 생성 이미지와 데모 데이터는 실제 기능의 범위 안에서 사용한다.

