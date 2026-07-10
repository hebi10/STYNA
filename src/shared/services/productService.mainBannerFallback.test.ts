import { getDoc } from 'firebase/firestore';
import { ProductService } from './productService';

jest.mock('@/shared/libs/firebase/firebase', () => ({
  db: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(() => ({})),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  writeBatch: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  startAfter: jest.fn(),
  Timestamp: class Timestamp {},
}));

const mockedGetDoc = getDoc as jest.Mock;

describe('ProductService main banner products', () => {
  beforeEach(() => {
    mockedGetDoc.mockReset();
  });

  test('does not use local fallback product data when Firestore does not have the slug document', async () => {
    mockedGetDoc.mockResolvedValue({
      exists: () => false,
    });

    const product = await ProductService.getProductById('mesh-low-profile-sneakers');

    expect(product).toBeNull();
  });
});
