import fs from 'fs';
import path from 'path';

describe('mypage order detail stylesheet', () => {
  test('keeps fill product images inside their thumbnail frame', () => {
    const css = fs.readFileSync(
      path.join(
        process.cwd(),
        'src/app/mypage/order-detail/[orderId]/page.module.css'
      ),
      'utf8'
    );
    const productImageBlock = css.match(/\.productImage\s*\{[^}]*\}/)?.[0] ?? '';

    expect(productImageBlock).toContain('position: relative');
  });
});
