import fs from 'fs';
import path from 'path';
import postcss from 'postcss';

// Next.js 내장 PostCSS 번들은 타입 선언이 없는 CommonJS 모듈이다.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const postcssPresetEnv = require('next/dist/compiled/postcss-preset-env');

const cssPath = path.resolve(
  process.cwd(),
  'src/app/_components/style-now/StyleNowSection.module.css',
);
const seasonCssPath = path.resolve(
  process.cwd(),
  'src/app/_components/style-now/StyleNowSeasonPage.module.css',
);

describe('StyleNowSection CSS', () => {
  test('autoprefixer 호환성 경고 없이 처리된다', async () => {
    const css = fs.readFileSync(cssPath, 'utf8');
    const result = await postcss([
      postcssPresetEnv({
        browsers: ['defaults'],
        autoprefixer: { flexbox: 'no-2009' },
        stage: 3,
        features: { 'custom-properties': false },
      }),
    ]).process(css, { from: cssPath });

    expect(result.warnings().map((warning) => warning.text)).toEqual([]);
  });

  test('모바일 플로팅 도구와 겹치지 않도록 콘텐츠 안전 여백을 둔다', () => {
    const homeCss = fs.readFileSync(cssPath, 'utf8');
    const seasonCss = fs.readFileSync(seasonCssPath, 'utf8');

    expect(homeCss).toMatch(
      /@media \(max-width: 640px\)[\s\S]*?\.cardContent\s*{[\s\S]*?padding-right:\s*6rem;/,
    );
    expect(seasonCss).toMatch(
      /@media \(max-width: 640px\)[\s\S]*?\.copyLight,[\s\S]*?\.copyDark\s*{[\s\S]*?right:\s*6rem;/,
    );
  });

  test('홈 이동 링크는 모바일에서도 44px 터치 영역을 제공한다', () => {
    const seasonCss = fs.readFileSync(seasonCssPath, 'utf8');

    expect(seasonCss).toMatch(
      /\.backLink\s*{[\s\S]*?min-height:\s*44px;/,
    );
  });
});
