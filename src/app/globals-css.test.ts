import fs from 'fs';
import path from 'path';

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
});
