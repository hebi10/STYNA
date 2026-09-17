import fs from 'node:fs';
import path from 'node:path';

const servicesDir = path.join(process.cwd(), 'src/shared/services');
const productServicePath = path.join(servicesDir, 'productService.ts');
const productDomainPath = path.join(servicesDir, 'productDomain.ts');
const productMapperPath = path.join(servicesDir, 'productMapper.ts');
const productRepositoryPath = path.join(servicesDir, 'productRepository.ts');

const read = (filePath: string) => fs.readFileSync(filePath, 'utf8');

describe('ProductService architecture', () => {
  test('separates pure product domain logic, document mapping, and Firestore data access', () => {
    expect(fs.existsSync(productDomainPath)).toBe(true);
    expect(fs.existsSync(productMapperPath)).toBe(true);
    expect(fs.existsSync(productRepositoryPath)).toBe(true);

    const serviceSource = read(productServicePath);

    expect(serviceSource).toContain("from './productDomain'");
    expect(serviceSource).toContain("from './productMapper'");
    expect(serviceSource).toContain("from './productRepository'");
    expect(serviceSource).not.toContain("from 'firebase/firestore'");
    expect(serviceSource).not.toContain('private static normalizeProduct');
    expect(serviceSource).not.toContain('private static selectRecommendedProducts');
  });

  test('keeps pure domain and mapping modules independent from Firebase SDK imports', () => {
    if (!fs.existsSync(productDomainPath) || !fs.existsSync(productMapperPath)) {
      expect(false).toBe(true);
      return;
    }

    expect(read(productDomainPath)).not.toContain('firebase/');
    expect(read(productMapperPath)).not.toContain('firebase/');
  });
});
