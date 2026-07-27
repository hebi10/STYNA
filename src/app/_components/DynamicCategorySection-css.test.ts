import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const cssPath = resolve(
  process.cwd(),
  'src/app/_components/DynamicCategorySection.module.css',
);
const cssExists = existsSync(cssPath);
const css = cssExists ? readFileSync(cssPath, 'utf8') : '';

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

describe('DynamicCategorySection stylesheet contract', () => {
  test('owns a dedicated stylesheet with every rendered class', () => {
    expect(cssExists).toBe(true);

    const renderedClasses = [
      'categoryGrid',
      'categoryCard',
      'categoryCardTextOnly',
      'categoryImageWrapper',
      'categoryImagePlaceholder',
      'categoryImage',
      'categoryInfo',
      'categoryLabel',
      'categoryCount',
      'loading',
      'loadingShimmer',
      'errorContainer',
      'errorMessage',
      'retryButton',
    ];

    renderedClasses.forEach(className => {
      expect(css).toMatch(new RegExp(`\\.${className}(?:[\\s.:,{]|$)`));
    });
  });

  test('restores the grid, card, image, and text-mode layout', () => {
    expect(selectorHasDeclaration('.categoryGrid', 'display', 'grid')).toBe(true);
    expect(
      selectorHasDeclaration(
        '.categoryGrid',
        'grid-template-columns',
        'repeat(4, minmax(0, 1fr))',
      ),
    ).toBe(true);
    expect(selectorHasDeclaration('.categoryCard', 'display', 'block')).toBe(true);
    expect(selectorHasDeclaration('.categoryCard', 'overflow', 'hidden')).toBe(true);
    expect(selectorHasDeclaration('.categoryCardTextOnly', 'min-height', '118px')).toBe(true);
    expect(selectorHasDeclaration('.categoryImageWrapper', 'position', 'relative')).toBe(true);
    expect(selectorHasDeclaration('.categoryImagePlaceholder', 'min-height', '145px')).toBe(true);
    expect(selectorHasDeclaration('.categoryInfo', 'display', 'grid')).toBe(true);
  });

  test('restores category typography and state presentation', () => {
    expect(selectorHasDeclaration('.categoryLabel', 'font-weight', '700')).toBe(true);
    expect(selectorHasDeclaration('.categoryCount', 'line-height', '1.5')).toBe(true);
    expect(selectorHasDeclaration('.loading', 'pointer-events', 'none')).toBe(true);
    expect(selectorHasDeclaration('.loadingShimmer', 'animation', 'shimmer 1.5s infinite linear')).toBe(true);
    expect(selectorHasDeclaration('.errorContainer', 'text-align', 'center')).toBe(true);
    expect(selectorHasDeclaration('.errorMessage', 'color', 'var(--error)')).toBe(true);
  });

  test('provides visible keyboard focus and a 44px retry action', () => {
    expect(selectorHasDeclaration('.categoryCard:focus-visible', 'outline', '2px solid var(--action)')).toBe(true);
    expect(selectorHasDeclaration('.retryButton:focus-visible', 'outline', '2px solid var(--action)')).toBe(true);
    expect(selectorHasDeclaration('.retryButton', 'min-height', '44px')).toBe(true);
  });

  test('adapts the grid and image height on smaller viewports', () => {
    expect(css).toMatch(
      /@media \(max-width: 900px\)[\s\S]*?\.categoryGrid\s*{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
    );
    expect(css).toMatch(
      /@media \(max-width: 480px\)[\s\S]*?\.categoryImageWrapper[\s\S]*?min-height:\s*180px/,
    );
  });

  test('does not add shadows or rounded corners', () => {
    expect(css).not.toMatch(/\bbox-shadow\s*:/);
    expect(css).not.toMatch(/\bborder-radius\s*:/);
  });
});
