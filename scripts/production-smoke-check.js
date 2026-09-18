#!/usr/bin/env node

const BASE_URL = (process.env.STYNA_SMOKE_BASE_URL || 'https://hebimall.web.app').replace(/\/$/, '');

const pageChecks = [
  {
    path: '/',
    expected: [
      '포트폴리오용 데모 사이트입니다',
      '스타일나우',
    ],
  },
  {
    path: '/auth/login',
    expected: [
      'PORTFOLIO DEMO',
      '일반 사용자 체험',
      '관리자 페이지 체험',
    ],
  },
];

async function readText(path) {
  const response = await fetch(BASE_URL + path, {
    redirect: 'follow',
    headers: {
      'user-agent': 'styna-production-smoke/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(path + ' returned HTTP ' + response.status);
  }

  return response.text();
}

async function verifyPage(check) {
  const html = await readText(check.path);

  for (const expected of check.expected) {
    if (!html.includes(expected)) {
      throw new Error(check.path + ' is missing expected copy: ' + expected);
    }
  }

  console.log('PASS ' + check.path);
}

async function verifyDemoLogin(role) {
  const response = await fetch(BASE_URL + '/api/demo-login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'styna-production-smoke/1.0',
    },
    body: JSON.stringify({ role }),
  });

  if (!response.ok) {
    throw new Error('/api/demo-login (' + role + ') returned HTTP ' + response.status);
  }

  const data = await response.json();
  const customToken = data?.data?.customToken;
  if (typeof customToken !== 'string' || customToken.length < 20) {
    throw new Error('/api/demo-login (' + role + ') did not return a valid custom token');
  }

  console.log('PASS /api/demo-login (' + role + ')');
}

async function main() {
  for (const check of pageChecks) {
    await verifyPage(check);
  }

  if (process.env.STYNA_SMOKE_DEMO_LOGIN === 'true') {
    await verifyDemoLogin('user');
    await verifyDemoLogin('admin');
  } else {
    console.log('SKIP demo token issuance checks (set STYNA_SMOKE_DEMO_LOGIN=true to enable)');
  }

  console.log('Production smoke check passed: ' + BASE_URL);
}

main().catch((error) => {
  console.error('Production smoke check failed:', error.message);
  process.exitCode = 1;
});
