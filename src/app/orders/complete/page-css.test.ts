import fs from 'fs';
import path from 'path';

describe('order complete page stylesheet', () => {
  test('keeps fill product images inside their thumbnail frame', () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), 'src/app/orders/complete/page.module.css'),
      'utf8'
    );
    const productImageBlock = css.match(/\.productImage\s*\{[^}]*\}/)?.[0] ?? '';

    expect(productImageBlock).toContain('position: relative');
  });
});
