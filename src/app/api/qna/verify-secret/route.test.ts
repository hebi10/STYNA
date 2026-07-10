/**
 * @jest-environment node
 */

import { POST } from './route';

describe('/api/qna/verify-secret', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'hebimall';
    delete process.env.QNA_FUNCTION_URL;

    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        success: true,
        qna: { id: 'qna-1', title: '문의' },
      }),
    }) as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('proxies QnA access verification to the Firebase Function URL in local Next dev', async () => {
    const response = await POST(new Request('http://localhost:3000/api/qna/verify-secret/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer user-token',
      },
      body: JSON.stringify({ qnaId: 'qna-1' }),
    }) as never);

    const body = await response.json();

    expect(global.fetch).toHaveBeenCalledWith(
      'https://us-central1-hebimall.cloudfunctions.net/qna',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer user-token',
        }),
      }),
    );
    expect(body).toEqual({ success: true, qna: { id: 'qna-1', title: '문의' } });
  });
});
