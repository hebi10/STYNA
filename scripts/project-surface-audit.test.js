const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('public project surface', () => {
  test('does not ship empty mypage routes', () => {
    expect(exists('src/app/mypage/counsel/page.tsx')).toBe(false);
    expect(exists('src/app/mypage/restock/page.tsx')).toBe(false);
    expect(exists('src/app/mypage/withdrawal/page.tsx')).toBe(false);
  });

  test('does not ship the actionless find-email route', () => {
    expect(exists('src/app/auth/find-email/page.tsx')).toBe(false);
    expect(exists('src/app/auth/find-email/page.module.css')).toBe(false);
    expect(read('src/app/auth/login/page.tsx')).not.toContain('/auth/find-email');
  });

  test('does not expose Firestore-only admin user creation', () => {
    expect(read('src/app/admin/dashboard/users/page.tsx')).not.toContain('handleAddUser');
    expect(read('src/shared/services/adminUserService.ts')).not.toContain('static async createUser');
  });

  test('does not expose admin user data through browser debug logs', () => {
    expect(read('src/shared/services/adminUserService.ts')).not.toContain('console.log');
    expect(read('src/app/admin/dashboard/users/page.tsx')).not.toContain('console.log');
  });

  test('does not keep the detached category product tabs implementation', () => {
    expect(exists('src/app/_components/CategoryProductTabs.tsx')).toBe(false);
    expect(exists('src/app/_components/CategoryProductTabs.module.css')).toBe(false);
    expect(read('src/app/page.test.tsx')).not.toContain('CategoryProductTabs');
  });

  test('does not keep the detached legacy review sync utility', () => {
    expect(exists('src/shared/utils/syncProductReviews.ts')).toBe(false);
    expect(read('src/app/products/_components/ProductDetailClient.test.tsx'))
      .not.toContain('syncProductReviews');
  });

  test('keeps one featured-product system and removes recommendationSettings', () => {
    expect(exists('src/app/admin/recommendations/page.tsx')).toBe(false);
    expect(exists('src/app/admin/recommendations/page.module.css')).toBe(false);

    for (const file of [
      'src/shared/services/siteContentService.ts',
      'scripts/static-content-data.js',
      'scripts/seed-static-content.js',
      'firestore.rules',
    ]) {
      expect(read(file)).not.toContain('recommendationSettings');
    }

    expect(exists('src/app/admin/featured-products/page.tsx')).toBe(true);
    expect(exists('src/app/_components/FeaturedProducts.tsx')).toBe(true);
    expect(exists('src/shared/services/featuredProductService.ts')).toBe(true);
  });

  test('keeps only implemented automatic point rewards and public policy copy', () => {
    const pointService = read('src/shared/services/pointService.ts');
    const pointHooks = read('src/shared/hooks/usePoint.ts');
    const pointPage = read('src/app/mypage/point/page.tsx');
    const userSeed = read('scripts/seed-users.js');
    const staticContent = read('scripts/static-content-data.js');
    const removedHelpers =
      /addOrderPoint|addReviewPoint|addBirthdayPoint|useOrderPoint|useReviewPoint|useBirthdayPoint/;

    expect(`${pointService}\n${pointHooks}`).not.toMatch(removedHelpers);
    expect(pointService).toContain('addSignupPoint');
    expect(pointHooks).toContain('useSignupPoint');
    expect(pointPage).not.toMatch(/구매금액의 1%|리뷰 작성|생일 혜택|최대 50%/);

    expect(userSeed).toContain('신규 회원가입 적립');
    expect(userSeed).toContain('signupBonusGrantedAt');
    expect(userSeed).toContain("source: 'signupBonus'");
    expect(userSeed).toContain("batch.set(userRef, user, { merge: true })");
    expect(userSeed).toContain("type: 'refund'");
    expect(userSeed).not.toMatch(/주문 완료 적립|리뷰 작성 적립|생일 축하 포인트/);
    expect(userSeed).toMatch(
      /RETIRED_POINT_HISTORY_IDS[\s\S]*point-4[\s\S]*point-5/,
    );
    expect(userSeed).toContain('batch.delete(pointHistoryRef.doc(retiredPointId))');

    expect(staticContent).toContain('회원가입 완료 시 5,000P');
    expect(staticContent).toContain('쿠폰 할인 적용 후 상품금액');
    expect(staticContent).toContain('특급 배송');
    expect(staticContent).not.toMatch(
      /구매 확정 후 24시간 이내 적립|1-3영업일|1회 무료 사이즈 교환|5만원 이상 구매로|당일배송|상반기 베스트 최대 60%|휴가룩 쿠폰 3종|쿨터치 최대 35%/,
    );
  });

  test('does not promise staffed support or an unimplemented response SLA', () => {
    const publicSources = [
      'src/app/_components/chat/ChatWidget.tsx',
      'src/shared/utils/chatResponses.ts',
      'src/app/_components/popup/SiteGuidePopup.tsx',
      'src/app/cs/inquiry/page.tsx',
      'src/app/admin/page.tsx',
      'src/app/page.tsx',
      'src/app/_components/footer/Footer.tsx',
    ].map(read).join('\n');

    expect(publicSources).not.toMatch(
      /상담 연결 요청을 접수|다음 영업일.*답변|영업일 기준 1-2일|SLA:\s*24시간|빠른 시일 내에 답변|CUSTOMER CENTER|운영시간 외 문의.*순차적으로 확인/,
    );
    expect(publicSources).toMatch(/답변 (?:여부와 )?시점은 보장하지 않습니다/);
    expect(read('src/app/cs/layout.tsx')).toContain('title="도움말"');
    expect(read('src/app/cs/layout.tsx')).not.toContain('title="고객센터"');
    expect(read('src/app/404.tsx')).not.toContain('인기 상품 보기');
  });

  test('does not invent weekly or human merchandising provenance', () => {
    const merchandisingSources = [
      'src/app/page.tsx',
      'src/app/_components/ProductSection.tsx',
      'src/shared/services/featuredProductService.ts',
    ].map(read).join('\n');

    expect(merchandisingSources).not.toMatch(
      /이번 주 추천|이번 주 신상|이번 주 새로|MD가.*선별|전문 MD|MD추천|기준으로 골랐/,
    );
  });

  test('uses the canonical shipping policy in every order pricing path', () => {
    const clientPricing = read('src/shared/utils/orderPricing.ts');
    const functionPricing = read('functions/src/domain/orderDomain.ts');
    const productDetail = read('src/app/products/_components/ProductDetailClient.tsx');

    expect(clientPricing).toContain('COMMERCE_POLICY.shipping');
    expect(functionPricing).toContain('COMMERCE_POLICY.shipping');
    expect(productDetail).toContain('calculateDeliveryFee');
    expect(productDetail).not.toMatch(/subtotal\s*>=\s*50000\s*\?\s*0\s*:\s*3000/);
  });

  test('temporarily redirects every unverified local event image path', () => {
    const redirects = JSON.parse(read('firebase.json')).hosting.redirects;

    expect(redirects).toEqual(expect.arrayContaining([
      {
        source: '/events/2026{,/**}',
        destination: '/events/',
        type: 302,
      },
      {
        source: '/events/2026-v2{,/**}',
        destination: '/events/',
        type: 302,
      },
      {
        source: '/events/2026-v3{,/**}',
        destination: '/events/',
        type: 302,
      },
      {
        source: '/events/2026-editorial/*-20260715-*.webp',
        destination: '/events/',
        type: 302,
      },
      {
        source: '/events/2026-editorial/*-20260721-*.webp',
        destination: '/events/',
        type: 302,
      },
    ]));
  });
});
