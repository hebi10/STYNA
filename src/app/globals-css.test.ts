import fs from 'fs';
import path from 'path';

const WCAG_AA_NORMAL_TEXT_RATIO = 4.5;

const parseHexColor = (hex: string) => {
  const channels = hex.slice(1).match(/.{2}/g);

  if (!channels || channels.length !== 3) {
    throw new Error(`Unsupported color: ${hex}`);
  }

  return channels.map(channel => Number.parseInt(channel, 16) / 255);
};

const relativeLuminance = (hex: string) =>
  parseHexColor(hex)
    .map(channel => channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);

const contrastRatio = (foreground: string, background: string) => {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));

  return (lighter + 0.05) / (darker + 0.05);
};

describe('global stylesheet loading', () => {
  test('does not block app chrome styles on remote font imports', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8');

    expect(css).not.toMatch(/^@import\s+url\(["']https?:/m);
  });

  test('does not make root elements a scroll container that breaks sticky header', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8');
    const rootBlock = css.match(/html,\s*body\s*\{[^}]*\}/)?.[0] ?? '';

    expect(rootBlock).not.toContain('overflow-y: auto');
    expect(rootBlock).not.toContain('overflow-x: hidden');
    expect(rootBlock).toContain('overflow-x: clip');
  });

  test.each([
    ['text-soft', 'white', '#ffffff'],
    ['text-soft', 'off-white', '#f7f7f7'],
    ['text-subtle', 'white', '#ffffff'],
    ['text-subtle', 'off-white', '#f7f7f7'],
  ])('keeps --%s readable on the %s surface at WCAG AA contrast', (
    token,
    _surface,
    background,
  ) => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8');
    const textColor = css.match(
      new RegExp(`--${token}:\\s*(#[0-9a-f]{6})`, 'i'),
    )?.[1];

    expect(textColor).toBeDefined();
    expect(contrastRatio(textColor as string, background))
      .toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT_RATIO);
  });

  test('uses the subtle text token for the home section description', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src/app/page.module.css'), 'utf8');
    const sectionDescription = css.match(/\.sectionDescription\s*\{[^}]*\}/)?.[0] ?? '';

    expect(sectionDescription).toContain('color: var(--text-subtle)');
    expect(sectionDescription).not.toMatch(/color:\s*#[0-9a-f]{6}/i);
  });

  test('keeps muted and tertiary text derived from the soft text token', () => {
    const variables = fs.readFileSync(
      path.join(process.cwd(), 'src/styles/variables.css'),
      'utf8',
    );

    expect(variables).toMatch(/--color-text-muted:\s*var\(--text-soft\);/);
    expect(variables).toMatch(/--color-text-tertiary:\s*var\(--text-soft\);/);
  });
});
