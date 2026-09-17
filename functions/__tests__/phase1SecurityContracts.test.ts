import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '..', '..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('phase 1 security contracts', () => {
  test('demo login UI does not contain demo account passwords or direct credential login', () => {
    const source = read('src/app/auth/login/page.tsx');

    expect(source).not.toContain('testtest');
    expect(source).not.toContain('test01test01');
    expect(source).not.toMatch(/login\(\s*["']test(?:01)?@test\.com["']/);
  });

  test('next server does not return internal error details to clients', () => {
    const source = read('functions/src/index.ts');

    expect(source).not.toContain('details: String(error)');
    expect(source).not.toMatch(/details\s*:\s*error/);
  });

  test('all public HTTP functions use an explicit web origin allowlist', () => {
    const files = [
      'functions/src/index.ts',
      'functions/src/handlers/adminUsers.ts',
      'functions/src/handlers/coupon.ts',
      'functions/src/handlers/event.ts',
      'functions/src/handlers/order.ts',
      'functions/src/handlers/points.ts',
      'functions/src/handlers/qna.ts',
      'functions/src/handlers/review.ts',
    ];

    for (const file of files) {
      expect(read(file)).not.toContain('cors: true');
    }

    const sharedPolicy = read('functions/src/config/httpPolicy.ts');
    expect(sharedPolicy).toContain('http://localhost:3000');
    expect(sharedPolicy).toContain('http://localhost:3001');
    expect(sharedPolicy).toContain('https://hebimall.firebaseapp.com');
    expect(sharedPolicy).toContain('https://hebimall.web.app');
  });

  test('server demo login handler exists and issues custom tokens instead of exposing passwords', () => {
    const handlerPath = path.join(repoRoot, 'functions/src/handlers/demoLogin.ts');

    expect(fs.existsSync(handlerPath)).toBe(true);
    if (!fs.existsSync(handlerPath)) return;

    const source = fs.readFileSync(handlerPath, 'utf8');
    expect(source).toContain('createCustomToken');
    expect(source).not.toContain('testtest');
    expect(source).not.toContain('test01test01');
  });
});
