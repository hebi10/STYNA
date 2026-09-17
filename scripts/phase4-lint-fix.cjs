const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function replaceExactly(relativePath, search, replacement) {
  const filePath = path.join(root, relativePath);
  const source = fs.readFileSync(filePath, 'utf8');
  const count = source.split(search).length - 1;
  if (count !== 1) {
    throw new Error(`${relativePath}: expected exactly one match, got ${count}`);
  }
  fs.writeFileSync(filePath, source.replace(search, replacement));
}

replaceExactly(
  'src/app/orders/cart/page.tsx',
  "import Button from '../../_components/Button';\n",
  '',
);

replaceExactly(
  'src/app/products/_components/ProductDetailClient.tsx',
  '  }, [addToCartMutation, product, router, user]);\n',
  '  }, [addToCartMutation, product, user]);\n',
);

console.log('Phase 4 lint cleanup applied.');
