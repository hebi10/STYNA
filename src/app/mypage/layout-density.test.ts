import fs from 'node:fs';
import path from 'node:path';

describe('mypage compact layout CSS', () => {
  const layoutCss = fs.readFileSync(path.join(__dirname, 'layout.module.css'), 'utf8');
  const dashboardCss = fs.readFileSync(path.join(__dirname, 'page.module.css'), 'utf8');
  const recentProductsCss = fs.readFileSync(
    path.join(__dirname, '_components/RecentProducts.module.css'),
    'utf8',
  );
  const wishlistProductsCss = fs.readFileSync(
    path.join(__dirname, '_components/WishlistProducts.module.css'),
    'utf8',
  );

  test('uses a compact desktop sidebar and content panel', () => {
    expect(layoutCss).toContain('grid-template-columns: 220px minmax(0, 1fr);');
    expect(layoutCss).not.toContain('min-height: 560px;');
  });

  test('shows overview statistics in four columns on desktop', () => {
    expect(dashboardCss).toMatch(/\.statsGrid\s*{[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
  });

  test('keeps compact two-column cards on mobile', () => {
    expect(layoutCss).not.toMatch(/@media \(max-width: 480px\)[\s\S]*?\.quickActions\s*{[\s\S]*?grid-template-columns:\s*1fr/);
    expect(dashboardCss).not.toMatch(/@media \(max-width: 480px\)[\s\S]*?\.statsGrid\s*{[\s\S]*?grid-template-columns:\s*1fr/);
    expect(recentProductsCss).toMatch(/@media \(max-width: 480px\)[\s\S]*?\.productGrid\s*{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
    expect(wishlistProductsCss).toMatch(/@media \(max-width: 480px\)[\s\S]*?\.productGrid\s*{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  });
});
