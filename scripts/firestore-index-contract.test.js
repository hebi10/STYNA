const firestoreIndexes = require('../firestore.indexes.json');

describe('Firestore index contracts', () => {
  test('supports rating aggregate queries for a product review collection', () => {
    expect(firestoreIndexes.indexes).toContainEqual(expect.objectContaining({
      collectionGroup: 'reviews',
      queryScope: 'COLLECTION',
      fields: [
        { fieldPath: 'productId', order: 'ASCENDING' },
        { fieldPath: 'rating', order: 'ASCENDING' },
        { fieldPath: '__name__', order: 'ASCENDING' },
      ],
    }));
  });
});
