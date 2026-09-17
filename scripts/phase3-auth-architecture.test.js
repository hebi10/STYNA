const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const resolve = (relativePath) => path.join(ROOT, relativePath);
const read = (relativePath) => fs.readFileSync(resolve(relativePath), 'utf8');

describe('phase 3 auth architecture contracts', () => {
  test('AuthProvider delegates route guarding and access claim resolution to hooks', () => {
    const source = read('src/context/authProvider.tsx');

    expect(source).toContain('useAuthGuard');
    expect(source).toContain('useAuthAccess');
    expect(source).not.toContain('from "next/navigation"');
    expect(source).not.toContain('hasStrictAdminAccess');
    expect(source).not.toContain('hasDemoAdminAccess');
  });

  test('user query keys are centralized', () => {
    const queryKeys = read('src/shared/hooks/queryKeys.ts');
    const userData = read('src/shared/hooks/useUserData.ts');
    const authProvider = read('src/context/authProvider.tsx');
    const infoEdit = read('src/app/mypage/info-edit/page.tsx');

    expect(queryKeys).toContain('export const userKeys');
    expect(userData).toContain('userKeys.detail(uid)');
    expect(authProvider).not.toMatch(/queryKey:\s*\[\s*["']user["']/);
    expect(infoEdit).not.toMatch(/queryKey:\s*\[\s*["']user["']/);
  });

  test('logout has an explicit authenticated-user cache cleanup boundary', () => {
    const cachePath = 'src/shared/utils/authQueryCache.ts';
    expect(fs.existsSync(resolve(cachePath))).toBe(true);

    const cacheBoundary = read(cachePath);
    const authProvider = read('src/context/authProvider.tsx');

    expect(cacheBoundary).toContain('clearAuthenticatedUserCache');
    expect(cacheBoundary).toContain('userKeys.detail(userId)');
    expect(cacheBoundary).toContain('cartKeys');
    expect(cacheBoundary).toContain('pointKeys');
    expect(cacheBoundary).toContain('orderKeys');
    expect(cacheBoundary).toContain('activityKeys');
    expect(cacheBoundary).toContain('couponKeys');
    expect(authProvider).toContain('clearAuthenticatedUserCache');
  });

  test('admin write reauthentication uses explicit intent instead of button-label inference', () => {
    const shell = read('src/app/admin/AdminShell.tsx');

    expect(shell).toContain('requiresAdminReauthentication');
    expect(shell).toContain('data-requires-reauth');
    expect(shell).not.toContain('저장|수정|삭제|등록|추가|발급|승인|취소|상태 변경|답변|활성|비활성|권한|포인트|순서');
  });

  test.each([
    'src/app/admin/categories/page.tsx',
    'src/app/admin/category-order/page.tsx',
    'src/app/admin/qna/page.tsx',
    'src/app/admin/dashboard/products/page.tsx',
    'src/app/admin/dashboard/products/_components/EditProductForm.tsx',
    'src/app/admin/dashboard/orders/page.tsx',
    'src/app/admin/dashboard/users/page.tsx',
    'src/app/admin/coupons/page.tsx',
    'src/app/admin/inquiries/page.tsx',
    'src/app/admin/featured-products/page.tsx',
    'src/app/admin/events/_components/AdminEventList.tsx',
    'src/app/admin/events/_components/EventForm.tsx',
    'src/app/admin/reviews/_components/AdminReviewList.tsx',
  ])('%s marks persisted mutations with explicit reauthentication intent', (relativePath) => {
    expect(read(relativePath)).toContain('data-requires-reauth="true"');
  });

  test('category writes are guarded without blocking local cancel actions', () => {
    const source = read('src/app/admin/categories/page.tsx');

    expect(source).toMatch(/data-requires-reauth="true"[\s\S]{0,180}handleAddCategory/);
    expect(source).toMatch(/data-requires-reauth="true"[\s\S]{0,180}toggleCategoryStatus/);
    expect(source).not.toMatch(/data-requires-reauth="true"[\s\S]{0,180}setShowAddForm\(false\)/);
    expect(source).not.toMatch(/data-requires-reauth="true"[\s\S]{0,180}setEditingCategory\(null\)/);
  });

  test('category-order and QnA persisted writes are explicitly guarded', () => {
    const categoryOrder = read('src/app/admin/category-order/page.tsx');
    const qna = read('src/app/admin/qna/page.tsx');

    expect(categoryOrder).toMatch(/data-requires-reauth="true"[\s\S]{0,180}resetToDefault/);
    expect(categoryOrder).toMatch(/data-requires-reauth="true"[\s\S]{0,180}saveOrder/);
    expect(qna).toMatch(/data-requires-reauth="true"[\s\S]{0,180}handleAnswerSubmit/);
  });

  test('product form guards storage and save writes but not local-only subforms or cancel', () => {
    const source = read('src/app/admin/dashboard/products/_components/EditProductForm.tsx');

    expect(source).toMatch(/data-requires-reauth="true"[\s\S]{0,180}handleSubmit/);
    expect(source).toMatch(/data-requires-reauth="true"[\s\S]{0,180}handleImageUpload/);
    expect(source).toMatch(/data-requires-reauth="true"[\s\S]{0,180}handleImageDelete/);
    expect(source).not.toMatch(/data-requires-reauth="true" onSubmit=\{handleSubmit\} className=\{styles\.addInput\}/);
    expect(source).not.toMatch(/data-requires-reauth="true"[\s\S]{0,180}onClick=\{onCancel\}/);
  });

  test('user management guards real writes but not read/open/close controls', () => {
    const source = read('src/app/admin/dashboard/users/page.tsx');

    expect(source).toMatch(/data-requires-reauth="true"[\s\S]{0,180}handleBulkPointGift/);
    expect(source).toMatch(/data-requires-reauth="true"[\s\S]{0,180}handlePointUpdate/);
    expect(source).not.toMatch(/data-requires-reauth="true"[\s\S]{0,180}handlePointManagement/);
    expect(source).not.toMatch(/data-requires-reauth="true"[\s\S]{0,180}setShowPointModal\(false\)/);
    expect(source).not.toMatch(/data-requires-reauth="true"[\s\S]{0,180}setShowUserDetail\(false\)/);
  });

  test('modal entry and cancel controls do not require write reauthentication', () => {
    const coupons = read('src/app/admin/coupons/page.tsx');
    const inquiries = read('src/app/admin/inquiries/page.tsx');

    expect(coupons).not.toMatch(/data-requires-reauth="true"[\s\S]{0,180}setShowCreateForm\(true\)/);
    expect(inquiries).not.toMatch(/data-requires-reauth="true"[\s\S]{0,180}setShowAnswerModal\(false\)/);
  });
});
