# Main Banner Drag And Loop Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 메인 배너의 순환 깜박임과 빠른 클릭 역방향 이동을 제거하고 포인터를 따라 움직이는 드래그 UX를 구현한다.

**Architecture:** 기존 복제 슬라이드 트랙을 유지하면서 전환을 단일 상태 흐름으로 관리한다. 끝점 보정은 `transitionend`만 사용하고, 드래그 오프셋은 CSS 변수로 트랙 transform에 합성한다.

**Tech Stack:** React 19, TypeScript, CSS Modules, Jest, Testing Library

## Global Constraints

- 기존 사용자 변경인 인접 이미지 렌더링·우선 로딩과 네이티브 드래그 방지는 보존한다.
- 그림자와 라운드를 추가하지 않는다.
- 커밋, 푸시, 배포를 수행하지 않는다.

---

### Task 1: 순환 전환 상태 회귀 테스트

**Files:**
- Test: `src/app/_components/MainBanner.test.tsx`

**Interfaces:**
- Consumes: `MainBanner`의 다음 버튼과 `.bannerTrack` CSS 변수
- Produces: 전환 중 입력 잠금과 끝점 보정에 대한 회귀 테스트

- [x] **Step 1: 실패 테스트 추가**

  마지막 슬라이드에서 다음 버튼을 눌러 복제 인덱스로 이동한 뒤, 전환 중 추가 클릭이 무시되고 `transitionend` 후 실제 첫 슬라이드 인덱스로 보정되는지 검증한다.

- [x] **Step 2: 실패 확인**

  Run: `npm test -- src/app/_components/MainBanner.test.tsx`

  Expected: 빠른 추가 클릭이 현재 구현에서 다른 트랙 인덱스로 이동해 테스트가 실패한다.

- [x] **Step 3: 최소 구현**

  `MainBanner.tsx`에 전환 잠금을 추가하고 620ms 끝점 보정 effect를 제거한다. `transitionend`에서 복제 인덱스를 정상 인덱스로 이동시킨 뒤 잠금을 해제한다.

- [x] **Step 4: 통과 확인**

  Run: `npm test -- src/app/_components/MainBanner.test.tsx`

  Expected: 새 회귀 테스트와 기존 테스트가 모두 통과한다.

### Task 2: 실시간 드래그와 놓기 판정

**Files:**
- Modify: `src/app/_components/MainBanner.tsx`
- Modify: `src/app/_components/MainBanner.module.css`
- Test: `src/app/_components/MainBanner.test.tsx`

**Interfaces:**
- Consumes: 포인터 `clientX`, `DRAG_THRESHOLD_PX = 48`
- Produces: `--drag-offset` CSS 변수와 포인터 이동·종료 동작

- [x] **Step 1: 실패 테스트 추가**

  `pointermove` 시 `--drag-offset`이 이동 픽셀만큼 설정되고, 48px 미만에서 인덱스가 유지되며, 48px 이상에서 한 장 이동하는지 각각 검증한다.

- [x] **Step 2: 실패 확인**

  Run: `npm test -- src/app/_components/MainBanner.test.tsx`

  Expected: 현재 구현에는 `pointermove` 처리와 `--drag-offset`이 없어 실패한다.

- [x] **Step 3: 최소 구현**

  포인터 이동 중 드래그 오프셋 상태를 갱신하고 CSS transform을 아래처럼 합성한다.

  ```css
  transform: translateX(calc(7% - (var(--track-index) * 86%) + var(--drag-offset)));
  ```

  포인터를 놓으면 오프셋을 0으로 되돌리고 48px 기준으로 원위치 또는 한 장 이동을 결정한다.

- [x] **Step 4: 통과 확인**

  Run: `npm test -- src/app/_components/MainBanner.test.tsx`

  Expected: 드래그 테스트와 기존 테스트가 모두 통과한다.

### Task 3: 문서와 화면 검증

**Files:**
- Modify: `docs/main-banner.md`

**Interfaces:**
- Consumes: 확정된 전환·드래그 동작
- Produces: 최신 메인 배너 상호작용 문서

- [x] **Step 1: 문서 갱신**

  전환 중 입력 잠금, `transitionend` 기반 끝점 보정, 실시간 드래그, 48px 놓기 기준을 기록한다.

- [x] **Step 2: 정적 검증**

  Run: `npm run typecheck`

  Run: `npm run lint -- --max-warnings=0`

- [x] **Step 3: 브라우저 검증**

  메인 화면에서 마지막→첫 번째 전환, 빠른 연속 클릭, 짧은 드래그 원위치, 긴 드래그 한 장 이동을 확인한다.
