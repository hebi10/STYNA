jest.mock('@/shared/libs/firebase/firebase', () => ({
  db: {},
  storage: {},
}));

const getDocs = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDocs,
  getDoc: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  where: jest.fn(),
  Timestamp: { now: jest.fn() },
  FirestoreError: class FirestoreError extends Error {},
}));

jest.mock('firebase/storage', () => ({
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
  deleteObject: jest.fn(),
}));

import { CategoryService } from './categoryService';

describe('CategoryService.getCategories', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('keeps legacy category documents active when isActive is omitted', async () => {
    getDocs.mockResolvedValue({
      forEach: (callback: (document: { id: string; data: () => object }) => void) => {
        callback({
          id: 'Bags',
          data: () => ({
            name: '가방',
            slug: 'Bags',
            path: '/categories/Bags',
            order: 1,
            productCount: 10,
          }),
        });
      },
    });

    await expect(CategoryService.getCategories()).resolves.toEqual([
      expect.objectContaining({ id: 'Bags', name: '가방' }),
    ]);
  });
});
