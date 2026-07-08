jest.mock('@/shared/libs/firebase/firebase', () => ({
  db: {},
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  setDoc: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date() })),
  },
  updateDoc: jest.fn(),
}));

import { getCuratedMainPageCategories } from './categoryOrderService';

describe('getCuratedMainPageCategories', () => {
  test('keeps main category exposure aligned to available category images', () => {
    const categories = [
      { id: 'bottoms', name: '하의', order: 0 },
      { id: 'shoes', name: '신발', order: 1 },
      { id: 'sports', name: '스포츠', order: 2 },
      { id: 'outdoor', name: '아웃도어', order: 3 },
      { id: 'bags', name: '가방', order: 4 },
      { id: 'jewelry', name: '주얼리', order: 5 },
      { id: 'tops', name: '상의', order: 6 },
    ];

    expect(getCuratedMainPageCategories(categories, 4).map((category) => category.id)).toEqual([
      'tops',
      'bottoms',
      'shoes',
      'sports',
    ]);
  });
});
