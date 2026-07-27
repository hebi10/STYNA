# Rules Emulator 잔여 프로세스 정리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Windows에서 Rules 테스트 종료 후 남는 Firestore Emulator가 다음 실행의 포트를 막지 않도록 안전한 실행·정리 경계를 추가한다.

**Architecture:** `scripts/run-rules-tests.js`가 기존 `firebase emulators:exec` 명령을 실행하되, 실행 전후에 이 저장소의 Rules 전용 Firestore Emulator만 식별해 정리한다. 프로세스 탐색·종료와 명령 실행은 주입 가능한 경계로 분리해 실제 Java나 Firebase를 띄우지 않는 단위 테스트로 성공·실패·안전 조건을 검증한다.

**Tech Stack:** Node.js CommonJS, Jest, Firebase CLI, PowerShell/Windows CIM

## Global Constraints

- 다른 프로젝트 또는 일반 Java 프로세스는 종료하지 않는다.
- Jest/Firebase의 원래 종료 코드를 그대로 반환한다.
- 테스트 성공, 실패, 예외, 중단 경로에서 후처리를 수행한다.
- 새 npm 의존성을 추가하지 않는다.
- 사용자 요청에 따라 커밋, 푸시, 배포하지 않는다.

---

### Task 1: 안전한 Emulator 식별과 실행 수명주기

**Files:**
- Create: `scripts/run-rules-tests.test.js`
- Create: `scripts/run-rules-tests.js`

**Interfaces:**
- Produces: `isProjectRulesFirestoreEmulator(commandLine, options): boolean`
- Produces: `runRulesTests(dependencies): number`

- [x] **Step 1: 실패 테스트 작성**

  같은 프로젝트 ID와 Firestore 포트가 있는 명령만 식별하고, 실행 전후 정리 및 테스트 종료 코드 전달을 검증한다. 관련 없는 Java 명령은 정리 대상에서 제외한다.

- [x] **Step 2: RED 확인**

  Run: `npx jest --runInBand scripts/run-rules-tests.test.js`

  Expected: `scripts/run-rules-tests.js`가 없어 FAIL.

- [x] **Step 3: 최소 구현**

  Windows에서는 PowerShell CIM으로 Java 명령줄을 조회하고, `cloud-firestore-emulator`, `demo-hebimall-rules-test`, `--port 8081`을 모두 만족하는 PID만 종료한다. `runRulesTests`는 사전 정리, Firebase 명령 실행, `finally` 후처리, 종료 코드 전달을 담당한다.

- [x] **Step 4: GREEN 확인**

  Run: `npx jest --runInBand scripts/run-rules-tests.test.js`

  Expected: 모든 신규 테스트 PASS.

### Task 2: 품질 게이트 연결과 실제 재발 검증

**Files:**
- Modify: `package.json`
- Modify: `scripts/sync-chat-responses.test.js`
- Modify: `docs/quality-gates.md`

**Interfaces:**
- Consumes: `node scripts/run-rules-tests.js`

- [x] **Step 1: 계약 테스트를 실패하도록 갱신**

  `package.json`의 `test:rules`가 전용 실행기를 사용해야 한다는 계약을 추가한다.

- [x] **Step 2: RED 확인**

  Run: `npx jest --runInBand scripts/sync-chat-responses.test.js`

  Expected: 기존 직접 Firebase 명령 때문에 FAIL.

- [x] **Step 3: 최소 연결 및 문서 갱신**

  `test:rules`를 `node scripts/run-rules-tests.js`로 변경하고, 자동 정리 범위와 관련 없는 포트 점유 시 실패 정책을 `docs/quality-gates.md`에 기록한다.

- [x] **Step 4: 범위 검증**

  Run: `npx jest --runInBand scripts/run-rules-tests.test.js scripts/sync-chat-responses.test.js`

  Expected: 모든 대상 테스트 PASS.

- [x] **Step 5: 실제 Rules 테스트를 연속 2회 실행**

  Run: `npm run test:rules`

  Run: `npm run test:rules`

  Expected: 두 번 모두 157개 테스트 PASS, 각 실행 후 8081 포트에 리스너 없음.

- [x] **Step 6: 정적 검증**

  Run: `npm run typecheck`

  Run: `npm run lint -- --max-warnings=0`

  Expected: 두 명령 모두 종료 코드 0.
