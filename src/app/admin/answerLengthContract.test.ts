import fs from 'node:fs';
import path from 'node:path';

const ANSWER_MAX_LENGTH_PATTERN = /<textarea[\s\S]*?id="answer"[\s\S]*?maxLength=\{2000\}[\s\S]*?\/>/;

describe('admin answer length contract', () => {
  test.each([
    'src/app/admin/qna/page.tsx',
    'src/app/admin/inquiries/page.tsx',
  ])('%s matches the Firestore answer limit', (relativePath) => {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

    expect(source).toMatch(ANSWER_MAX_LENGTH_PATTERN);
  });
});
