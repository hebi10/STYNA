import { addDoc } from 'firebase/firestore';
import { SimpleQnAService } from './simpleQnAService';

jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn(),
  collection: jest.fn(() => ({ path: 'qna' })),
  getDocs: jest.fn(),
  limit: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  serverTimestamp: jest.fn(() => ({ kind: 'serverTimestamp' })),
  where: jest.fn(),
}));

jest.mock('@/shared/libs/firebase/firebase', () => ({ db: {} }));

describe('SimpleQnAService.createQnA', () => {
  test('omits undefined optional product fields from the Firestore payload', async () => {
    jest.mocked(addDoc).mockResolvedValue({ id: 'qna-1' } as never);

    await SimpleQnAService.createQnA(
      'owner-1',
      'owner@example.com',
      'owner name',
      {
        category: 'general',
        title: '문의',
        content: '문의 내용',
        isSecret: false,
        isNotified: false,
      }
    );

    const payload = jest.mocked(addDoc).mock.calls[0][1];
    expect(payload).not.toHaveProperty('productId');
    expect(payload).not.toHaveProperty('productName');
  });
});
