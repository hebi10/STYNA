# 공개 관리자 데모 차단 Implementation Plan

> **대체 기록:** 아래 초안은 관리자 빠른 로그인을 제거하는 초기 제안입니다. 해비님 승인으로 대체되었습니다. 현재 구현은 관리자 로그인을 유지하며, `demo_admin` 읽기 전용 역할·관리자 셸 격리·5분 재인증 기반 서버 쓰기 경계를 사용합니다. 기준은 `docs/security-admin-permission.md`와 현재 코드입니다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공개 로그인 화면에서 관리자 데모 계정으로 진입할 수 없게 하고 개인 전화번호를 제거한다.

**Architecture:** 데모 로그인 환경 변수는 일반 회원 체험 제어에만 사용한다. 실제 관리자 권한 검증은 변경하지 않으며, 공개 진입점과 클라이언트 번들에 포함되는 관리자 인증정보만 제거한다. 개인 전화번호는 사이트 상수에서 전화 상담 미제공 안내로 교체해 모든 소비 화면에 같은 정책을 적용한다.

**Tech Stack:** Next.js App Router, React, TypeScript, Jest, Testing Library

## Global Constraints

- 실제 Firebase Auth, Firestore, Storage 운영 데이터는 수정하지 않는다.
- 기존 사용자 변경사항은 덮어쓰지 않는다.
- 새 UI 그림자·큰 radius를 추가하지 않는다.
- 배포와 Git 커밋은 사용자 요청이 있을 때만 실행한다.

---

### Task 1: 관리자 빠른 로그인 회귀 테스트

**Files:**
- Modify: `src/app/auth/login/page.test.tsx`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_ENABLE_DEMO_LOGIN`, `LoginPage`, mocked `useAuth()`
- Produces: 공개 데모 로그인 영역이 일반 회원 버튼만 렌더링한다는 회귀 계약

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
test('renders only the member demo login when the public flag is true', () => {
  process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN = 'true';
  render(<LoginPage />);

  expect(screen.getByRole('button', { name: '일반 회원 로그인' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '관리자 로그인' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- --runTestsByPath src/app/auth/login/page.test.tsx`

Expected: 현재 관리자 버튼이 렌더링되므로 assertion 실패

- [ ] **Step 3: 최소 구현**

`src/app/auth/login/page.tsx`에서 관리자 전용 빠른 로그인 함수와 버튼을 제거한다. 일반 회원 빠른 로그인은 기존 `login()` 호출과 redirect 처리를 유지한다.

- [ ] **Step 4: 통과 확인**

Run: `npm test -- --runTestsByPath src/app/auth/login/page.test.tsx`

Expected: PASS

### Task 2: 개인 전화번호 공개 중단

**Files:**
- Modify: `src/shared/constants/siteInfo.ts`
- Test: `src/shared/constants/siteInfo.test.ts`

**Interfaces:**
- Consumes: `SITE_INFO.supportPhone`
- Produces: 연락처 화면이 공유하는 비개인 전화 안내 문구

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
test('does not expose a mobile-number shaped support phone value', () => {
  expect(SITE_INFO.supportPhone).toBe('전화 상담 미제공');
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- --runTestsByPath src/shared/constants/siteInfo.test.ts`

Expected: 기존 개인 전화번호 값 때문에 assertion 실패

- [ ] **Step 3: 최소 구현**

`SITE_INFO.supportPhone`을 `전화 상담 미제공`으로 변경한다. 전화번호가 입력 데이터인 회원·주문·배송 모델은 변경하지 않는다.

- [ ] **Step 4: 통과 확인**

Run: `npm test -- --runTestsByPath src/shared/constants/siteInfo.test.ts`

Expected: PASS

### Task 3: 문서와 품질 확인

**Files:**
- Modify: `README.md`, `PRODUCT.md`, `docs/auth-ui.md`, `docs/env-setup.md`

- [ ] **Step 1: 문서 갱신**

`NEXT_PUBLIC_ENABLE_DEMO_LOGIN`을 일반 회원 빠른 로그인 전용으로 설명하고, 관리자 빠른 로그인은 공개 배포에서 제공하지 않는다고 명시한다.

- [ ] **Step 2: 변경 범위 검증**

Run: `npm test -- --runTestsByPath src/app/auth/login/page.test.tsx src/shared/constants/siteInfo.test.ts && npm run typecheck && npm run lint -- --max-warnings=0`

Expected: 각 명령이 exit code 0으로 종료
