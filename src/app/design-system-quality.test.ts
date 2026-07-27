import { readFileSync } from 'fs';
import { resolve } from 'path';

function hasLayoutTransition(source: string) {
  const shorthandDeclarations = source.matchAll(/transition\s*:\s*([^;}]+)(?=;|})/g);
  const propertyDeclarations = source.matchAll(/transition-property\s*:\s*([^;}]+)(?=;|})/g);

  const hasTransitionToken = (value: string) =>
    value
      .split(',')
      .some(component => component.trim().split(/\s+/).some(token => token === 'width' || token === 'all'));

  return [
    ...Array.from(shorthandDeclarations, declaration => declaration[1]),
    ...Array.from(propertyDeclarations, declaration => declaration[1]),
  ].some(hasTransitionToken);
}

const task9SurfaceFiles = [
  'src/app/auth/find-password/page.module.css',
  'src/app/auth/reset-password/page.module.css',
  'src/app/auth/signup/page.module.css',
  'src/app/mypage/info-edit/page.module.css',
  'src/app/mypage/coupons/page.module.css',
  'src/app/mypage/order-detail/[orderId]/page.module.css',
  'src/app/mypage/order-list/page.module.css',
  'src/app/mypage/point/page.module.css',
  'src/app/mypage/qa/page.module.css',
];

const task9HeaderFiles = [
  'src/app/mypage/coupons/page.module.css',
  'src/app/mypage/order-detail/[orderId]/page.module.css',
  'src/app/mypage/order-list/page.module.css',
  'src/app/mypage/qa/page.module.css',
];

const spinnerContracts = [
  ['src/app/auth/reset-password/page.module.css', 4],
  ['src/app/mypage/coupons/page.module.css', 4],
  ['src/app/mypage/order-detail/[orderId]/page.module.css', 4],
  ['src/app/mypage/order-list/page.module.css', 3],
  ['src/app/mypage/qa/page.module.css', 4],
] as const;

const decorativeAccentSelectors = ['.pageHeader', '.pointNote'];

const task10SurfaceFiles = [
  'src/app/admin/categories/page.module.css',
  'src/app/admin/dashboard/orders/page.module.css',
  'src/app/admin/dashboard/users/page.module.css',
  'src/app/admin/events/_components/EventForm.module.css',
  'src/app/admin/inquiries/page.module.css',
  'src/app/admin/page.module.css',
  'src/app/admin/qna/page.module.css',
  'src/app/admin/user-coupons/page.module.css',
  'src/app/admin/_components/ErrorBoundary.module.css',
  'src/app/admin/_components/LoadingSpinner.module.css',
  'src/app/qna/page.module.css',
  'src/app/qna/write/page.module.css',
  'src/app/qna/[id]/page.module.css',
  'src/app/support/offline/page.module.css',
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getSelectorBlocks(source: string, selector: string) {
  const pattern = new RegExp(`${escapeRegExp(selector)}\\s*\\{([^{}]*)\\}`, 'g');

  return Array.from(source.matchAll(pattern), match => match[1]);
}

function getFinalDeclaration(source: string, selector: string, property: string) {
  const declaration = new RegExp(
    `(?:^|;)\\s*${escapeRegExp(property)}\\s*:\\s*([^;}]+)`,
    'g',
  );
  const values = getSelectorBlocks(source, selector).flatMap(block =>
    Array.from(block.matchAll(declaration), match => match[1].trim()),
  );

  return values.at(-1);
}

function selectorDeclaresProperty(source: string, selector: string, property: string) {
  return getSelectorBlocks(source, selector).some(block =>
    new RegExp(`${escapeRegExp(property)}\\s*:`, 'g').test(block),
  );
}

function hasTextBackgroundClip(source: string) {
  return /(?:-[a-z-]+)?background-clip\s*:\s*text\b/i.test(source);
}

function hasBounceAnimation(source: string) {
  return /(?:animation|animation-name)\s*:\s*[^;{}]*\bbounce\b/i.test(source);
}

type BorderDirection = 'top' | 'right' | 'bottom' | 'left';
type BorderDeclaration = { width?: number; style?: string; color?: string; colorOnly?: boolean };
type SelectorBorderState = {
  border: Record<BorderDirection, BorderDeclaration>;
  borderRadius?: string;
  animation?: string;
};

const borderDirections: BorderDirection[] = ['top', 'right', 'bottom', 'left'];

function createSelectorBorderState(): SelectorBorderState {
  return {
    border: {
      top: {},
      right: {},
      bottom: {},
      left: {},
    },
  };
}

function readBorderDeclaration(value: string): BorderDeclaration {
  const width = value.match(/(?:^|\s)(\d+(?:\.\d+)?px|0)(?=\s|$)/i)?.[1];
  const style = value.match(/\b(solid|dashed|dotted|double|none)\b/i)?.[1]?.toLowerCase();
  const color = value.match(/var\([^)]*\)|#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\b(?:transparent|currentcolor)\b/i)?.[0];

  return {
    width: width ? Number.parseFloat(width) : undefined,
    style,
    color: color?.replace(/\s+/g, '').toLowerCase(),
  };
}

function applyBorderDeclaration(
  state: SelectorBorderState,
  direction: BorderDirection | 'all',
  declaration: BorderDeclaration,
  colorOnly = false,
) {
  const targets = direction === 'all' ? borderDirections : [direction];

  targets.forEach(target => {
    state.border[target] = {
      ...state.border[target],
      ...declaration,
      ...(declaration.color ? { colorOnly } : {}),
    };
  });
}

function applyCssDeclaration(state: SelectorBorderState, property: string, value: string) {
  if (property === 'border' || property === 'border-width' || property === 'border-style' || property === 'border-color') {
    applyBorderDeclaration(state, 'all', readBorderDeclaration(value), property === 'border-color');
    return;
  }

  const directionalMatch = property.match(/^border-(top|right|bottom|left)(?:-(width|style|color))?$/);
  if (directionalMatch) {
    applyBorderDeclaration(
      state,
      directionalMatch[1] as BorderDirection,
      readBorderDeclaration(value),
      directionalMatch[2] === 'color',
    );
    return;
  }

  if (property === 'border-radius') {
    state.borderRadius = value.trim();
  }

  if (property === 'animation' || property === 'animation-name') {
    state.animation = value.trim();
  }
}

function hasDecorativeThickAccent(source: string) {
  const stateBySelector = new Map<string, SelectorBorderState>();

  Array.from(source.matchAll(/([^{}]+)\{([^{}]*)\}/g)).forEach(([, rawSelectors, declarations]) => {
    const selectors = rawSelectors
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split(',')
      .map(selector => selector.trim())
      .filter(selector => selector.length > 0 && !selector.startsWith('@'));
    const parsedDeclarations = Array.from(declarations.matchAll(/([\w-]+)\s*:\s*([^;}]+)(?:;|$)/g));

    selectors.forEach(selector => {
      const state = stateBySelector.get(selector) ?? createSelectorBorderState();

      parsedDeclarations.forEach(([, property, value]) => applyCssDeclaration(state, property, value));
      stateBySelector.set(selector, state);
    });
  });

  return Array.from(stateBySelector.entries()).some(([selector, state]) => {
    const isFunctionalSpinner =
      /(?:^|[\s>+~.#])\.spinner\b/i.test(selector) &&
      /(?:^|\s)50%(?:\s|$)/.test(state.borderRadius ?? '') &&
      /\bspin\b/i.test(state.animation ?? '');
    const hasThickSideOrTopBorder = ['top', 'right', 'left'].some(direction => {
      const border = state.border[direction as BorderDirection];

      return (border.width ?? 0) >= 3 && border.style === 'solid';
    });
    const hasAsymmetricSideOrTopColor = ['top', 'right', 'left'].some(direction => {
      const border = state.border[direction as BorderDirection];
      const color = border.color;

      return border.colorOnly === true && color !== undefined && borderDirections.some(other => state.border[other].color !== color);
    });

    return !isFunctionalSpinner && (hasThickSideOrTopBorder || hasAsymmetricSideOrTopColor);
  });
}

describe('design-system quality', () => {
  test('detects only layout transition width and all tokens', () => {
    expect(hasLayoutTransition('.fill { transition: width 0.3s ease; }')).toBe(true);
    expect(hasLayoutTransition('.fill { transition: opacity 0.2s, all 0.3s; }')).toBe(true);
    expect(hasLayoutTransition('.fill { transition-property: width, opacity; }')).toBe(true);
    expect(hasLayoutTransition('.line { transition: stroke-width 0.2s ease; }')).toBe(false);
    expect(hasLayoutTransition('.bar { transition: opacity 0.2s ease; }')).toBe(false);
  });

  test.each([
    'src/app/admin/dashboard/products/_components/EditProductForm.module.css',
    'src/app/admin/_components/Chart.module.css',
    'src/app/products/_components/ProductReviews.module.css',
  ])('%s does not animate layout width', file => {
    const source = readFileSync(resolve(process.cwd(), file), 'utf8');

    expect(hasLayoutTransition(source)).toBe(false);
  });

  test('recognizes the Task 9 CSS contracts without depending on declaration formatting', () => {
    expect(hasTextBackgroundClip('.title { -webkit-background-clip: text; }')).toBe(true);
    expect(hasTextBackgroundClip('.title { background-clip: border-box; }')).toBe(false);
    expect(hasBounceAnimation('.icon { animation-name: bounce; }')).toBe(true);
    expect(hasBounceAnimation('.icon { animation: spin 1s linear infinite; }')).toBe(false);

    const sample = '.pageHeader { border-bottom: 2px solid #111; } .pageHeader { border: 0; border-bottom: 1px solid var(--line); }';
    expect(getFinalDeclaration(sample, '.pageHeader', 'border-bottom')).toBe('1px solid var(--line)');
  });

  test('FAQ page title uses solid storefront typography without gradient text', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/cs/faq/page.module.css'),
      'utf8',
    );
    const pageTitleSource = getSelectorBlocks(source, '.pageTitle').join('\n');

    expect(pageTitleSource).not.toMatch(/linear-gradient|background-clip|\btransparent\b/i);
    expect(getFinalDeclaration(source, '.pageTitle', 'color')).toBe('var(--black)');
  });

  test.each(task9SurfaceFiles)('%s does not use deprecated Task 9 decoration', file => {
    const source = readFileSync(resolve(process.cwd(), file), 'utf8');

    expect(hasTextBackgroundClip(source)).toBe(false);
    expect(hasBounceAnimation(source)).toBe(false);
  });

  test('mypage info edit does not use a decorative tiled grid', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/mypage/info-edit/page.module.css'),
      'utf8',
    );

    expect(source).not.toMatch(/repeating-linear-gradient|background-size\s*:\s*\d+px\s+\d+px/);
  });

  test.each(task9HeaderFiles)('%s keeps the final page header divider thin and neutral', file => {
    const source = readFileSync(resolve(process.cwd(), file), 'utf8');

    expect(getFinalDeclaration(source, '.pageHeader', 'border')).toBe('0');
    expect(getFinalDeclaration(source, '.pageHeader', 'border-bottom')).toBe('1px solid var(--line)');
  });

  test('mypage point note does not retain a decorative side accent', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/mypage/point/page.module.css'), 'utf8');

    expect(selectorDeclaresProperty(source, '.pointNote', 'border-left')).toBe(false);
  });

  test('decorative accent checks explicitly exclude meaningful loading spinners', () => {
    expect(decorativeAccentSelectors).not.toContain('.spinner');
  });

  test.each(spinnerContracts)('%s preserves a visible loading spinner with storefront tokens', (file, width) => {
    const source = readFileSync(resolve(process.cwd(), file), 'utf8');

    expect(getFinalDeclaration(source, '.spinner', 'border')).toBe(`${width}px solid var(--line)`);
    expect(getFinalDeclaration(source, '.spinner', 'border-top-color')).toBe('var(--black)');
  });

  test('allows only functional spinners while rejecting grouped, split, and asymmetric accents', () => {
    expect(
      hasDecorativeThickAccent(
        '.spinner { border: 4px solid var(--line); border-top-color: var(--black); border-radius: 50%; animation: spin 1s linear infinite; }',
      ),
    ).toBe(false);
    expect(hasDecorativeThickAccent('.spinner, .notice { border-left: 3px solid var(--danger); }')).toBe(true);
    expect(
      hasDecorativeThickAccent(
        '.notice { border-left-width: 3px; border-left-style: solid; border-left-color: var(--danger); }',
      ),
    ).toBe(true);
    expect(
      hasDecorativeThickAccent(
        '.notice { border: 1px solid var(--line); } .notice { border-left-color: var(--black); }',
      ),
    ).toBe(true);
    expect(hasDecorativeThickAccent('.notice { border: 1px solid var(--line); }')).toBe(false);
  });

  test.each(task10SurfaceFiles)('%s has no decorative thick side or top accent', file => {
    const source = readFileSync(resolve(process.cwd(), file), 'utf8');

    expect(hasDecorativeThickAccent(source)).toBe(false);
  });
});
