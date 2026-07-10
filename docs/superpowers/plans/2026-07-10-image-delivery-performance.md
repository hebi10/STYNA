# Image Delivery Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Firebase Storage 이미지의 전송량·캐시·초기 로드 범위를 줄인다.

**Architecture:** 카테고리 원본은 먼저 로컬 WebP 자산으로 교체하고, Admin 자격 증명이 있는 환경에서만 Firebase Storage 객체로 마이그레이션한다. Next는 responsive image 변환을 제공하며, 배너는 활성 슬라이드 주변의 이미지 요소만 유지한다.

**Tech Stack:** Next.js Image, Firebase Storage, Firestore Admin SDK, Sharp, Jest

## Global Constraints

- 기존 Storage 객체는 삭제하지 않는다.
- Firebase URL과 Firestore 참조는 모든 업로드가 성공한 뒤에만 변경한다.
- 코드 변경은 테스트를 먼저 추가하고 실패를 확인한 뒤 최소 구현으로 통과시킨다.
- 커밋·푸시·배포는 사용자 요청 없이는 하지 않는다.

---

### Task 1: 카테고리 이미지 WebP 전환

**Files:**
- Modify: `scripts/category-image-webp-migration.js`
- Modify: `scripts/category-image-webp-migration.test.js`
- Modify: `src/app/_components/DynamicCategorySection.tsx`

- [ ] 실패하는 테스트로 PNG 입력이 q75 WebP 객체 경로와 장기 캐시 메타데이터를 만드는지 정의한다.
- [ ] 테스트가 기존 구현 부재로 실패하는지 확인한다.
- [ ] 원본 삭제 없이 업로드·검증·Firestore 업데이트를 분리한 마이그레이션을 구현한다.
- [ ] 단위 테스트와 Firebase dry-run/validate를 실행한다.

### Task 2: 전송·캐시 정책

**Files:**
- Modify: `next.config.ts`
- Modify: `src/shared/libs/firebase/imageOptimization.ts`
- Modify: `src/shared/libs/firebase/imageOptimization.test.ts`

- [ ] 실패하는 테스트로 업로드 메타데이터와 긴 변 제한을 정의한다.
- [ ] 테스트가 실패하는지 확인한다.
- [ ] 배포 환경 Next 이미지 최적화와 WebP 업로드의 크기 제한·캐시 메타데이터를 구현한다.
- [ ] 관련 테스트를 통과시킨다.

### Task 3: 메인 배너 초기 로드 범위

**Files:**
- Modify: `src/app/_components/MainBanner.tsx`
- Modify: `src/app/_components/MainBanner.test.tsx`

- [ ] 실패하는 테스트로 첫 슬라이드 양쪽 우선 로드 및 비인접 슬라이드 미렌더링을 정의한다.
- [ ] 테스트가 실패하는지 확인한다.
- [ ] 활성·인접 슬라이드만 이미지를 렌더링하도록 최소 구현한다.
- [ ] 배너 테스트와 실제 브라우저 확인을 통과시킨다.

### Task 4: 전체 확인과 문서화

**Files:**
- Modify: `docs/storage-structure.md`

- [ ] Firebase 대상 URL·캐시 헤더·화면 전송량을 재측정한다.
- [ ] `npm run verify`와 Firestore Rules 테스트를 실행한다.
- [ ] 실제 적용한 Storage 경로·캐시·되돌림 절차를 문서에 기록한다.
