import { readFileSync } from 'fs';
import { resolve } from 'path';

const css = readFileSync(
  resolve(process.cwd(), 'src/app/products/_components/ProductDetail.module.css'),
  'utf8',
);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function selectorHasDeclaration(
  selector: string,
  property: string,
  value: string,
  source = css,
) {
  const selectorPattern = escapeRegExp(selector);
  const declarationPattern = new RegExp(
    `${escapeRegExp(property)}\\s*:\\s*${escapeRegExp(value)}`,
  );
  const selectorBlocks = Array.from(
    source.matchAll(new RegExp(`${selectorPattern}\\s*\\{([^{}]*)\\}`, 'g')),
    match => match[1],
  );

  return selectorBlocks.some(block => declarationPattern.test(block));
}

describe('ProductDetail mobile touch targets', () => {
  const mobileCss = css.slice(css.indexOf('@media (max-width: 768px)'));

  test('does not treat a later selector declaration as a size option declaration', () => {
    const source = '.sizeButton { color: black; } .unrelated { min-height: 44px; }';

    expect(selectorHasDeclaration('.sizeButton', 'min-height', '44px', source)).toBe(false);
  });

  test('keeps size options at least 44 by 44 pixels', () => {
    expect(selectorHasDeclaration('.sizeButton', 'min-width', '44px')).toBe(true);
    expect(selectorHasDeclaration('.sizeButton', 'min-height', '44px')).toBe(true);
  });

  test('keeps color options at least 44 by 44 pixels', () => {
    expect(selectorHasDeclaration('.colorButton', 'width', '44px')).toBe(true);
    expect(selectorHasDeclaration('.colorButton', 'height', '44px')).toBe(true);
  });

  test('keeps quantity controls at least 44 by 44 pixels', () => {
    expect(selectorHasDeclaration('.quantityButton', 'width', '44px')).toBe(true);
    expect(selectorHasDeclaration('.quantityButton', 'min-height', '44px')).toBe(true);
  });

  test('keeps detail tabs at least 44 pixels tall', () => {
    expect(selectorHasDeclaration('.tabHeader', 'min-height', '44px')).toBe(true);
  });

  test('keeps the inquiry action at least 44 pixels tall', () => {
    expect(selectorHasDeclaration('.inquiryButton', 'min-height', '44px')).toBe(true);
  });

  test('keeps purchase actions fixed to the mobile viewport bottom', () => {
    expect(selectorHasDeclaration('.actions', 'position', 'fixed', mobileCss)).toBe(true);
    expect(selectorHasDeclaration('.actions', 'bottom', '0', mobileCss)).toBe(true);
  });

  test('keeps related product cards horizontally scrollable on mobile', () => {
    expect(selectorHasDeclaration('.relatedProducts', 'overflow-x', 'auto', mobileCss)).toBe(true);
    expect(selectorHasDeclaration('.relatedGrid', 'width', 'max-content', mobileCss)).toBe(true);
  });
});
