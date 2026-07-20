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
});
