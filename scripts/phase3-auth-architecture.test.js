const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const resolve = (relativePath) => path.join(ROOT, relativePath);
const read = (relativePath) => fs.readFileSync(resolve(relativePath), 'utf8');

function lastOpeningTagContaining(source, token, tagName = 'button') {
  const tokenIndex = source.lastIndexOf(token);
  if (tokenIndex < 0) {
    throw new Error(`Token not found: ${token}`);
  }

  const start = source.lastIndexOf(`<${tagName}`, tokenIndex);
  const end = source.indexOf('>', tokenIndex);
  if (start < 0 || end < 0) {
    throw new Error(`Opening <${tagName}> tag not found for token: ${token}`);
  }

  return source.slice(start, end + 1);
}

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
    expect(lastOpeningTagContaining(source, 'setShowAddForm(false)')).not.toContain('data-requires-reauth');
    expect(lastOpeningTagContaining(source, 'setEditingCategory(null)')).not.toContain('data-requires-reauth');
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

    expect(source).toMatch(/data-requires-reauth="true"[\s\S]{0,180}onSubmit=\{handleSubmit\}[\s\S]{0,180}className=\{styles\.form\}/);
    expect(source).toMatch(/type="file"[\s\S]{0,220}data-requires-reauth="true"|data-requires-reauth="true"[\s\S]{0,220}type="file"/);
    expect(source).toContain('handleImageUpload(e.target.files)');
    expect(source).toMatch(/data-requires-reauth="true"[\s\S]{0,180}handleImageDelete/);
    expect(source).not.toMatch(/data-requires-reauth="true" onSubmit=\{handleSubmit\} className=\{styles\.addInput\}/);
    expect(source).not.toMatch(/data-requires-reauth="true"[\s\S]{0,180}onClick=\{onCancel\}/);
  });

  test('all event image uploads and persisted submit require reauthentication', () => {
    const source = read('src/app/admin/events/_components/EventForm.tsx');
    const guardedFileInputs = source.match(/<input[\s\S]{0,320}?data-requires-reauth="true"[\s\S]{0,320}?type="file"|<input[\s\S]{0,320}?type="file"[\s\S]{0,320}?data-requires-reauth="true"/g) || [];

    expect(source).toMatch(/<form\s+data-requires-reauth="true"\s+onSubmit=\{handleSubmit\}/);
    expect(source).toContain("handleImageUpload(file, 'detail')");
    expect(source).toContain('handleEditorialImageUpload');
    expect(guardedFileInputs.length).toBeGreaterThanOrEqual(4);
  });

  test('user management guards real writes but not read/open/close controls', () => {
    const source = read('src/app/admin/dashboard/users/page.tsx');

    expect(source).toMatch(/data-requires-reauth="true"[\s\S]{0,180}handleBulkPointGift/);
    expect(source).toMatch(/data-requires-reauth="true"[\s\S]{0,180}handlePointUpdate/);
    expect(source).not.toMatch(/data-requires-reauth="true"[\s\S]{0,180}handlePointManagement/);
    expect(source).not.toMatch(/data-requires-reauth="true"[\s\S]{0,180}setShowPointModal\(false\)/);
    expect(source).not.toMatch(/data-requires-reauth="true"[\s\S]{0,180}setShowUserDetail\(false\)/);
  });


  test('demo administrator can navigate a synthetic read-only workspace without gaining real admin access', () => {
    const shell = read('src/app/admin/AdminShell.tsx');
    const demoWorkspace = read('src/app/admin/_components/DemoAdminDashboard.tsx');
    const serverAuth = read('functions/src/utils/auth.ts');

    expect(shell).toContain('<AdminNav onNavigate={closeMenu} />');
    expect(shell).not.toContain('!isDemoAdmin && <AdminNav');
    expect(shell).toContain('관리자 체험 모드 · 조회 전용');
    expect(shell).toMatch(/if \(isDemoAdmin\) \{[\s\S]{0,180}event\.preventDefault\(\);[\s\S]{0,180}event\.stopPropagation\(\);/);

    expect(demoWorkspace).toContain('usePathname');
    expect(demoWorkspace).toContain('/admin/dashboard/products');
    expect(demoWorkspace).toContain('/admin/dashboard/orders');
    expect(demoWorkspace).toContain('/admin/dashboard/users');
    expect(demoWorkspace).toContain('/admin/coupons');
    expect(demoWorkspace).toContain('/admin/events');
    expect(demoWorkspace).toContain('비식별 샘플 데이터');
    expect(demoWorkspace).toContain('disabled');

    expect(serverAuth).toContain('const isAdmin = hasAdminClaim && role === "admin"');
    expect(serverAuth).toContain('decodedToken.demoAdmin === true && role === "demo_admin"');
  });


  test('modal entry and cancel controls do not require write reauthentication', () => {
    const coupons = read('src/app/admin/coupons/page.tsx');
    const inquiries = read('src/app/admin/inquiries/page.tsx');
    const eventForm = read('src/app/admin/events/_components/EventForm.tsx');

    expect(coupons).not.toMatch(/data-requires-reauth="true"[\s\S]{0,180}setShowCreateForm\(true\)/);
    expect(inquiries).not.toMatch(/data-requires-reauth="true"[\s\S]{0,180}setShowAnswerModal\(false\)/);
    expect(eventForm).not.toMatch(/data-requires-reauth="true"[\s\S]{0,180}handleCancel/);
  });
});
