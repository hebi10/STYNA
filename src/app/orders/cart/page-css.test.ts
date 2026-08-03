import fs from 'fs';
import path from 'path';

describe('order cart page stylesheet', () => {
  test('keeps fill product images inside their thumbnail frame', () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), 'src/app/orders/cart/page.module.css'),
      'utf8'
    );
    const itemImageBlock = css.match(/\.itemImage\s*\{[^}]*\}/)?.[0] ?? '';

    expect(itemImageBlock).toContain('position: relative');
  });
});
