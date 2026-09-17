const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

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

  test('admin write reauthentication uses explicit intent instead of button-label inference', () => {
    const shell = read('src/app/admin/AdminShell.tsx');

    expect(shell).toContain('requiresAdminReauthentication');
    expect(shell).toContain('data-requires-reauth');
    expect(shell).not.toContain('저장|수정|삭제|등록|추가|발급|승인|취소|상태 변경|답변|활성|비활성|권한|포인트|순서');
  });
});
