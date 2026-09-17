const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

const CORE_ALERT_FREE_FILES = [
  'src/app/products/_components/ProductDetailClient.tsx',
  'src/app/orders/cart/page.tsx',
  'src/app/orders/checkout/page.tsx',
  'src/app/admin/categories/page.tsx',
  'src/app/admin/dashboard/orders/page.tsx',
  'src/app/admin/dashboard/users/page.tsx',
  'src/app/admin/coupons/page.tsx',
  'src/app/admin/inquiries/page.tsx',
  'src/app/admin/qna/page.tsx',
  'src/app/admin/events/_components/AdminEventList.tsx',
  'src/app/admin/events/_components/EventForm.tsx',
];

describe('phase 4 UX accessibility contracts', () => {
  test('mounts one common non-blocking feedback region at the app root', () => {
    const regionPath = path.join(ROOT, 'src/app/_components/feedback/FeedbackRegion.tsx');
    const publisherPath = path.join(ROOT, 'src/shared/utils/feedback.ts');
    const layout = read('src/app/layout.tsx');

    expect(fs.existsSync(regionPath)).toBe(true);
    expect(fs.existsSync(publisherPath)).toBe(true);
    expect(layout).toContain('FeedbackRegion');
  });

  test.each(CORE_ALERT_FREE_FILES)('%s does not use blocking window alerts', (relativePath) => {
    const source = read(relativePath);
    expect(source).not.toMatch(/\b(?:window\.)?alert\s*\(/);
  });

  test('product detail exposes accessible tabs, pressed option state, and quantity labels', () => {
    const source = read('src/app/products/_components/ProductDetailClient.tsx');

    expect(source).toContain('role="tablist"');
    expect(source).toContain('role="tab"');
    expect(source).toContain('role="tabpanel"');
    expect(source).toContain('aria-selected');
    expect(source).toContain('aria-controls');
    expect(source).toContain('aria-labelledby');
    expect(source).toContain("'ArrowRight'");
    expect(source).toContain("'ArrowLeft'");
    expect(source).toContain("'Home'");
    expect(source).toContain("'End'");
    expect(source).toContain('aria-pressed');
    expect(source).toContain('수량 ${quantity}개 감소');
    expect(source).toContain('수량 ${quantity}개 증가');
  });

  test('cart and checkout use the shared async state pattern for primary loading/error/empty gates', () => {
    const cart = read('src/app/orders/cart/page.tsx');
    const checkout = read('src/app/orders/checkout/page.tsx');

    expect(cart).toContain('AsyncStatePanel');
    expect(checkout).toContain('AsyncStatePanel');
    expect(cart).not.toContain('className={styles.loading}>장바구니를 불러오는 중');
    expect(cart).not.toContain('className={styles.error}');
  });

  test('admin mobile menu controls meet the 44px target and expose dialog semantics', () => {
    const shell = read('src/app/admin/AdminShell.tsx');
    const css = read('src/app/admin/layout.module.css');

    expect(shell).toContain("role={isMenuOpen ? 'dialog' : undefined}");
    expect(shell).toContain("aria-modal={isMenuOpen ? true : undefined}");
    expect(shell).toContain('aria-expanded={isMenuOpen}');
    expect(shell).toContain('aria-controls="admin-navigation"');
    expect(shell).toContain("event.key !== 'Escape'");
    expect(css).toContain('min-width: 44px');
    expect(css).toContain('min-height: 44px');
  });
});
