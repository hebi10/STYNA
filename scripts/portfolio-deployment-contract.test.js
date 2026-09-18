const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

describe('portfolio production deployment contract', () => {
  test('CI builds both normal and portfolio-demo client variants', () => {
    const ci = read('.github/workflows/ci.yml');

    expect(ci).toContain('demo_login:');
    expect(ci).toContain("- 'false'");
    expect(ci).toContain("- 'true'");
    expect(ci).toContain('NEXT_PUBLIC_ENABLE_DEMO_LOGIN: ${{ matrix.demo_login }}');
  });

  test('Firebase hosting keeps the server-issued demo login boundary', () => {
    const firebase = JSON.parse(read('firebase.json'));

    expect(firebase.hosting.rewrites).toEqual(expect.arrayContaining([
      {
        source: '/api/demo-login',
        function: 'demoLogin',
      },
    ]));
  });

  test('production smoke script checks public demo entry points without printing tokens', () => {
    const smoke = read('scripts/production-smoke-check.js');

    expect(smoke).toContain('포트폴리오용 데모 사이트입니다');
    expect(smoke).toContain('일반 사용자 체험');
    expect(smoke).toContain('관리자 페이지 체험');
    expect(smoke).toContain("STYNA_SMOKE_DEMO_LOGIN === 'true'");
    expect(smoke).not.toContain('console.log(data.token)');
    expect(smoke).not.toContain('console.log(token)');
  });

  test('Firebase deployment still gates on the full verify command', () => {
    const pkg = JSON.parse(read('package.json'));

    expect(pkg.scripts['deploy:firebase']).toBe('npm run verify && firebase deploy');
    expect(pkg.scripts['smoke:production']).toBe('node scripts/production-smoke-check.js');
  });
});
