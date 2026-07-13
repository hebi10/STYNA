# Checkout Delivery Address Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 저장 배송지가 없는 회원도 체크아웃에서 배송지를 직접 입력하고, 기본 체크된 선택 항목을 통해 주문 성공 후 해당 주소를 프로필에 저장할 수 있게 한다.

**Architecture:** 배송지 정규화 파일에 직접 입력값 검증과 주문용 주소 생성 로직을 순수 함수로 추가한다. 체크아웃 페이지는 저장 주소 선택과 직접 입력 모드를 함께 제공하고, 주문 성공 후에만 Firestore `arrayUnion`으로 새 주소를 저장한다.

**Tech Stack:** Next.js 15, React 19, TypeScript, Firebase Firestore, Jest

## Global Constraints

- `입력한 배송지 저장하기` 체크박스는 기본적으로 켠다.
- 주소 저장 실패가 성공한 주문을 취소하지 않게 한다.
- 외부 우편번호 API, 마이페이지 개편, 주문 API 구조 변경은 포함하지 않는다.
- 그림자와 둥근 모서리를 새로 추가하지 않는다.
- 사용자 요청 없이 커밋, 푸시, 배포하지 않는다.

---

### Task 1: 직접 입력 배송지 검증과 생성

**Files:**
- Modify: `src/app/orders/checkout/deliveryAddress.ts`
- Test: `src/app/orders/checkout/deliveryAddress.test.ts`

**Interfaces:**
- Produces: `ManualDeliveryAddressInput`
- Produces: `validateManualDeliveryAddress(input): ManualDeliveryAddressErrors`
- Produces: `createManualDeliveryAddress(input, id, isDefault): DeliveryAddress`

- [ ] **Step 1: 필수값과 휴대전화 형식을 검증하는 실패 테스트 작성**

```ts
test('validates required manual delivery address fields and phone format', () => {
  expect(validateManualDeliveryAddress({
    name: '', recipient: '', phone: '02-123-4567', address: '', detailAddress: '', zipCode: '',
  })).toEqual({
    name: '배송지명을 입력해주세요.',
    recipient: '받는 분을 입력해주세요.',
    phone: '올바른 휴대전화 번호를 입력해주세요.',
    address: '주소를 입력해주세요.',
    zipCode: '우편번호를 입력해주세요.',
  });
});
```

- [ ] **Step 2: 테스트가 기능 부재로 실패하는지 확인**

Run: `npm test -- --runTestsByPath src/app/orders/checkout/deliveryAddress.test.ts`

Expected: `validateManualDeliveryAddress` export가 없어 FAIL.

- [ ] **Step 3: 최소 검증 함수 구현**

```ts
export interface ManualDeliveryAddressInput {
  name: string;
  recipient: string;
  phone: string;
  address: string;
  detailAddress: string;
  zipCode: string;
}

export type ManualDeliveryAddressErrors = Partial<Record<keyof ManualDeliveryAddressInput, string>>;

export function validateManualDeliveryAddress(input: ManualDeliveryAddressInput): ManualDeliveryAddressErrors {
  const errors: ManualDeliveryAddressErrors = {};
  if (!input.name.trim()) errors.name = '배송지명을 입력해주세요.';
  if (!input.recipient.trim()) errors.recipient = '받는 분을 입력해주세요.';
  if (!input.phone.trim()) errors.phone = '연락처를 입력해주세요.';
  else if (!/^01[0-9]-?[0-9]{4}-?[0-9]{4}$/.test(input.phone.trim())) {
    errors.phone = '올바른 휴대전화 번호를 입력해주세요.';
  }
  if (!input.zipCode.trim()) errors.zipCode = '우편번호를 입력해주세요.';
  if (!input.address.trim()) errors.address = '주소를 입력해주세요.';
  return errors;
}
```

- [ ] **Step 4: 검증 테스트 통과 확인**

Run: `npm test -- --runTestsByPath src/app/orders/checkout/deliveryAddress.test.ts`

Expected: PASS.

- [ ] **Step 5: 공백을 정리하고 기본 배송지 여부를 반영하는 실패 테스트 작성**

```ts
test('creates a normalized manual delivery address', () => {
  expect(createManualDeliveryAddress({
    name: ' 집 ', recipient: ' 홍길동 ', phone: ' 010-1234-5678 ',
    address: ' 서울시 강남구 ', detailAddress: ' 101호 ', zipCode: ' 06234 ',
  }, 'checkout-address-1', true)).toEqual({
    id: 'checkout-address-1', name: '집', recipient: '홍길동', phone: '010-1234-5678',
    address: '서울시 강남구', detailAddress: '101호', zipCode: '06234', isDefault: true,
  });
});
```

- [ ] **Step 6: 테스트가 생성 함수 부재로 실패하는지 확인**

Run: `npm test -- --runTestsByPath src/app/orders/checkout/deliveryAddress.test.ts`

Expected: `createManualDeliveryAddress` export가 없어 FAIL.

- [ ] **Step 7: 최소 주소 생성 함수 구현**

```ts
export function createManualDeliveryAddress(
  input: ManualDeliveryAddressInput,
  id: string,
  isDefault: boolean
): DeliveryAddress {
  return {
    id,
    name: input.name.trim(),
    recipient: input.recipient.trim(),
    phone: input.phone.trim(),
    address: input.address.trim(),
    detailAddress: input.detailAddress.trim(),
    zipCode: input.zipCode.trim(),
    isDefault,
  };
}
```

- [ ] **Step 8: 배송지 단위 테스트 전체 통과 확인**

Run: `npm test -- --runTestsByPath src/app/orders/checkout/deliveryAddress.test.ts`

Expected: 기존 테스트를 포함해 모두 PASS.

### Task 2: 체크아웃 직접 입력 UI와 선택 저장 연결

**Files:**
- Modify: `src/app/orders/checkout/page.tsx`
- Modify: `src/app/orders/checkout/page.module.css`
- Modify: `docs/order-serverization.md`

**Interfaces:**
- Consumes: `validateManualDeliveryAddress`, `createManualDeliveryAddress`, `ManualDeliveryAddressInput`
- Consumes: Firestore `arrayUnion`, `doc`, `serverTimestamp`, `updateDoc`

- [ ] **Step 1: 체크아웃 상태와 저장 주소 선택 로직 추가**

`page.tsx`에 다음 상태를 추가한다.

```ts
const [useManualAddress, setUseManualAddress] = useState(false);
const [manualAddress, setManualAddress] = useState<ManualDeliveryAddressInput>({
  name: '집', recipient: '', phone: '', address: '', detailAddress: '', zipCode: '',
});
const [manualAddressErrors, setManualAddressErrors] = useState<ManualDeliveryAddressErrors>({});
const [saveManualAddress, setSaveManualAddress] = useState(true);
```

주소 목록이 비어 있으면 `useManualAddress`를 `true`로 설정한다. 주소가 있으면 기본 배송지를 기존 방식으로 선택하되 사용자가 직접 입력 모드를 선택한 상태를 덮어쓰지 않는다.

- [ ] **Step 2: 기존 차단 화면 제거 및 배송지 선택·입력 폼 렌더링**

`addresses.length === 0 || !selectedAddress` 조기 반환을 제거한다. 배송 주소 섹션에서 저장 주소 라디오와 `새 배송지 입력` 라디오를 렌더링하고, 직접 입력 선택 시 다음 필드를 표시한다.

```tsx
<input name="name" aria-label="배송지명" />
<input name="recipient" aria-label="받는 분" />
<input name="phone" aria-label="연락처" />
<input name="zipCode" aria-label="우편번호" />
<input name="address" aria-label="주소" />
<input name="detailAddress" aria-label="상세 주소" />
<label>
  <input type="checkbox" checked={saveManualAddress} />
  입력한 배송지 저장하기
</label>
```

각 필수 입력 아래에는 `manualAddressErrors`의 해당 메시지를 `role="alert"`로 표시한다.

- [ ] **Step 3: 주문 생성 시 선택 주소 확정 및 검증 연결**

`handleCompleteOrder`에서 직접 입력 모드라면 검증 오류가 있을 때 주문 API를 호출하지 않는다. 오류가 없으면 고유 ID와 `addresses.length === 0` 값을 이용해 주소를 만든다. 저장 주소 모드에서는 기존 `selectedAddress`를 그대로 사용한다.

```ts
const addressId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : `checkout-${Date.now()}`;
const deliveryAddress = createManualDeliveryAddress(
  manualAddress,
  addressId,
  addresses.length === 0
);
```

- [ ] **Step 4: 주문 성공 뒤 선택적 프로필 저장 연결**

주문 API 성공 뒤, 직접 입력 모드이고 체크박스가 켜져 있을 때만 실행한다.

```ts
try {
  await updateDoc(doc(db, 'users', user.uid), {
    addresses: arrayUnion(deliveryAddress),
    updatedAt: serverTimestamp(),
  });
} catch (saveError) {
  console.error('delivery address save failed:', saveError);
  alert('주문은 완료됐지만 입력한 배송지는 저장하지 못했습니다.');
}
```

주문 API 실패 시에는 이 저장 코드가 실행되지 않도록 주문 성공 분기 안에 둔다.

- [ ] **Step 5: 체크아웃 스타일 추가**

기존 `var(--line)`, `var(--black)`, `var(--surface-raised)`, `var(--radius-sm)` 토큰을 사용해 2열 입력 행, 단일 입력, 오류 문구, 저장 체크 영역을 스타일링한다. 새 `box-shadow`는 사용하지 않고 모바일에서는 입력 행을 1열로 전환한다.

- [ ] **Step 6: 관련 문서 갱신**

`docs/order-serverization.md`에 체크아웃 직접 입력, 기본 체크된 선택 저장, 주문 성공 후 저장 및 저장 실패 비차단 정책을 짧게 기록한다.

- [ ] **Step 7: 정적 검증 실행**

Run: `npm run typecheck`

Expected: exit code 0.

Run: `npm run lint -- --max-warnings=0`

Expected: exit code 0.

Run: `npm test -- --runTestsByPath src/app/orders/checkout/deliveryAddress.test.ts`

Expected: PASS.

- [ ] **Step 8: 브라우저 QA**

로컬 앱에서 다음을 확인한다.

- 저장 주소가 없는 계정에서 체크아웃이 차단되지 않는다.
- 새 배송지 입력과 기본 체크된 저장 선택이 표시된다.
- 필수값 또는 잘못된 휴대전화 번호로 주문이 실행되지 않는다.
- 저장 체크를 끄면 주문 주소만 사용하고 프로필에는 추가하지 않는다.
- 저장 체크를 켜면 주문 성공 후 프로필 `addresses`에 추가된다.
- 저장 주소가 있는 계정은 기존 주소 선택과 새 주소 입력을 모두 사용할 수 있다.
