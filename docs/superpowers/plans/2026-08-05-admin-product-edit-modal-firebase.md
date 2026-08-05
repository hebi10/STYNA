# 관리자 상품 수정 Firebase 안전 모달 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Firebase Hosting의 특수문자 정적 청크 경로를 요청하지 않으면서 관리자 상품 수정 폼을 목록 위 모달로 연다.

**Architecture:** 상품 목록의 수정 상태를 `/admin/dashboard/products?edit=<productId>`로 표현한다. 목록 페이지의 Suspense 경계 안에서 새 클라이언트 모달을 렌더링하고, 모달은 기존 `ProductProvider`와 `EditProductForm`을 사용한다. 기존 병렬·인터셉트 라우트와 직접 편집 페이지는 변경하지 않는다.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Firebase Functions v2, CSS Modules

## Global Constraints

- 목록 진입 URL은 정확히 `/admin/dashboard/products?edit=<productId>`를 사용한다.
- 기존 `/admin/dashboard/products/<productId>/edit` 직접 편집 페이지와 병렬·인터셉트 라우트 파일은 유지한다.
- 상품 데이터 모델, 권한 정책, 저장 서비스, 의존성은 변경하지 않는다.
- 모달의 기존 시각적 규칙과 저장·취소 문구를 유지한다.
- 해비님의 명시적 요청에 따라 자동 테스트 작성·실행과 브라우저 검증은 수행하지 않는다.

---

### Task 1: 쿼리 기반 상품 편집 모달

**Files:**
- Create: `src/app/admin/dashboard/products/_components/EditProductModal.tsx`
- Create: `src/app/admin/dashboard/products/_components/EditProductModal.module.css`

**Interfaces:**
- Consumes: `useSearchParams`, `usePathname`, `useRouter`, `useAuth`, `useProduct`, `Product`, `EditProductForm`
- Produces: 기본 내보내기 `EditProductModal(): JSX.Element | null`

- [x] **Step 1: URL의 상품 ID와 닫기 URL을 계산한다**

```tsx
const searchParams = useSearchParams();
const pathname = usePathname();
const productId = searchParams.get('edit');

const closeModal = useCallback(() => {
  const nextParams = new URLSearchParams(searchParams.toString());
  nextParams.delete('edit');
  const query = nextParams.toString();
  router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
}, [pathname, router, searchParams]);
```

- [x] **Step 2: 기존 Provider와 폼으로 상품을 조회·저장한다**

```tsx
const { getProductById, updateProduct } = useProduct();

useEffect(() => {
  if (!productId || !user || !isAdmin) return;
  void getProductById(productId).then(setProduct);
}, [getProductById, isAdmin, productId, user]);

const handleSave = async (updatedProduct: Product) => {
  await updateProduct(productId, updatedProduct);
  alert('상품이 성공적으로 수정되었습니다.');
  closeModal();
};
```

- [x] **Step 3: 기존 팝업 UX를 유지한다**

```tsx
const requestClose = () => {
  if (confirm('변경사항이 저장되지 않습니다. 정말 닫으시겠습니까?')) {
    closeModal();
  }
};

return (
  <div className={styles.overlay} onClick={handleOverlayClick}>
    <div className={styles.container} role="dialog" aria-modal="true" aria-labelledby="product-edit-modal-title">
      <EditProductForm product={product} onSave={handleSave} onCancel={requestClose} />
    </div>
  </div>
);
```

`Escape`, 배경 클릭, 닫기 버튼에서 `requestClose`를 호출하고, 모달이 열린 동안의 본문 스크롤 값을 보존·복원한다. 로딩·조회 오류·권한 확인 상태도 동일한 오버레이 안에 표시한다. CSS Module에는 현재 인터셉트 모달의 레이아웃·반응형·중립 관리 화면 스타일을 옮긴다.

### Task 2: 상품 목록의 모달 진입 연결

**Files:**
- Modify: `src/app/admin/dashboard/products/page.tsx:3-10, 179-189, 332-337`

**Interfaces:**
- Consumes: `EditProductModal` 기본 내보내기
- Produces: 수정 링크의 Firebase 안전 URL과 목록 위 모달 렌더링

- [x] **Step 1: Suspense 경계에서 모달을 렌더링한다**

```tsx
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import EditProductModal from './_components/EditProductModal';

const editModal = (
  <Suspense fallback={null}>
    <EditProductModal />
  </Suspense>
);
```

모든 목록 로딩·오류·정상 반환에 `editModal`을 함께 렌더링해 직접 `?edit=` 접속도 상품 조회 상태를 표시할 수 있게 한다.

- [x] **Step 2: 수정 링크를 쿼리 URL로 교체한다**

```tsx
<Link
  href={`/admin/dashboard/products?edit=${encodeURIComponent(product.id)}`}
  className={styles.editButton}
>
  수정
</Link>
```

### Task 3: 문서 색인과 작업 상태 정리

**Files:**
- Modify: `docs/README.md`
- Modify: `docs/superpowers/plans/2026-08-05-admin-product-edit-modal-firebase.md`

**Interfaces:**
- Consumes: 확정 설계 문서 `docs/superpowers/specs/2026-08-05-admin-product-edit-modal-firebase-design.md`
- Produces: 완료된 계획 항목과 문서 허브 연결

- [x] **Step 1: 각 구현 단계 체크박스를 완료로 표시한다**

```markdown
- [x] **Step 1: URL의 상품 ID와 닫기 URL을 계산한다**
```

- [x] **Step 2: diff 정합성만 확인하고 변경을 커밋한다**

```bash
git diff --check
git add -- docs/README.md docs/superpowers/plans/2026-08-05-admin-product-edit-modal-firebase.md src/app/admin/dashboard/products/page.tsx src/app/admin/dashboard/products/_components/EditProductModal.tsx src/app/admin/dashboard/products/_components/EditProductModal.module.css
git commit -m "관리자 상품 수정 모달 전환"
```

자동 테스트·브라우저 검증은 해비님의 요청에 따라 실행하지 않는다.

## Self-Review

- 설계의 URL 계약, 모달 유지, 직접 편집 페이지 호환, Firebase 우회 조건은 Task 1~2에 모두 포함했다.
- 파일 삭제, Firebase 설정 변경, 데이터·권한·의존성 변경은 계획에 포함하지 않았다.
- 모든 컴포넌트 이름과 경로는 Task 간에 `EditProductModal`로 일치한다.
- 테스트 관련 작업은 해비님의 명시적 요청으로 제외했으며, 최종 보고에 미실행 사실을 남긴다.
