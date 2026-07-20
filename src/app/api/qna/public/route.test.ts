/**
 * @jest-environment node
 */

import { POST } from './route';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('/api/qna/public', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'hebimall';
    delete process.env.QNA_FUNCTION_URL;
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        success: true,
        qnas: [{ id: 'qna-1', title: '문의' }],
      }),
    }) as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('proxies the public list request to the QnA Firebase Function', async () => {
    const response = await POST(new Request('http://localhost:3000/api/qna/public', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'publicList', filters: {}, page: 1, limit: 10 }),
    }) as never);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://us-central1-hebimall.cloudfunctions.net/qna',
      expect.objectContaining({ method: 'POST', cache: 'no-store' })
    );
    await expect(response.json()).resolves.toEqual({
      success: true,
      qnas: [{ id: 'qna-1', title: '문의' }],
    });
  });

  test('keeps the Firebase Hosting rewrite on the QnA Function boundary', () => {
    const firebaseConfig = JSON.parse(
      readFileSync(resolve(process.cwd(), 'firebase.json'), 'utf8')
    ) as { hosting: { rewrites: Array<{ source: string; function?: string }> } };

    expect(firebaseConfig.hosting.rewrites).toContainEqual({
      source: '/api/qna/public',
      function: 'qna',
    });
  });
});
