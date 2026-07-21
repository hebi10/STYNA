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
      /구매 확정 후 24시간 이내 적립|1-3영업일|1회 무료 사이즈 교환|5만원 이상 구매로/,
    );
  });
});
