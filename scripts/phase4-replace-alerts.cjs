const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const files = [
  'src/app/products/_components/ProductDetailClient.tsx',
  'src/app/orders/cart/page.tsx',
  'src/app/orders/checkout/page.tsx',
  'src/app/admin/categories/page.tsx',
  'src/app/admin/dashboard/orders/page.tsx',
  'src/app/admin/dashboard/users/page.tsx',
  'src/app/admin/coupons/page.tsx',
  'src/app/admin/inquiries/page.tsx',
  'src/app/admin/qna/page.tsx',
  'src/app/admin/events/_components/AdminEventList.tsx',
  'src/app/admin/events/_components/EventForm.tsx',
];

const importLine = "import { publishFeedback } from '@/shared/utils/feedback';";
let totalReplacements = 0;

for (const relativePath of files) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing target file: ${relativePath}`);
  }

  let source = fs.readFileSync(filePath, 'utf8');
  const before = source;
  let replacements = 0;

  source = source.replace(/\b(?:window\.)?alert\s*\(([^;]*?)\);/gs, (_match, expression) => {
    replacements += 1;
    return `publishFeedback(${expression});`;
  });

  if (replacements === 0) {
    throw new Error(`No alert() calls found in expected target: ${relativePath}`);
  }

  if (!source.includes(importLine)) {
    const firstImportIndex = source.indexOf('import ');
    if (firstImportIndex < 0) {
      throw new Error(`No import anchor found: ${relativePath}`);
    }
    source = `${source.slice(0, firstImportIndex)}${importLine}\n${source.slice(firstImportIndex)}`;
  }

  if (/\b(?:window\.)?alert\s*\(/.test(source)) {
    throw new Error(`Blocking alert remains: ${relativePath}`);
  }

  if (source === before) {
    throw new Error(`Target did not change: ${relativePath}`);
  }

  fs.writeFileSync(filePath, source);
  totalReplacements += replacements;
  console.log(`${relativePath}: ${replacements} alert(s) migrated`);
}

if (totalReplacements < files.length) {
  throw new Error(`Unexpected replacement count: ${totalReplacements}`);
}

console.log(`Migrated ${totalReplacements} blocking alert(s) across ${files.length} files.`);
