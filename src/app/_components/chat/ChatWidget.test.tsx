import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ChatWidget from './ChatWidget';

jest.mock('./ChatWidget.module.css', () => new Proxy({}, {
  get: (_target, prop) => String(prop),
}));

function renderChatWidget() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ChatWidget />
    </QueryClientProvider>,
  );
}

describe('ChatWidget', () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_CHAT_API_URL;

    Element.prototype.scrollIntoView = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { response: '배송 안내입니다.' } }),
    }) as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('enables message input as soon as chat opens', () => {
    renderChatWidget();

    fireEvent.click(screen.getByLabelText('채팅 열기'));

    expect(screen.getByPlaceholderText('메시지를 입력하세요...')).not.toBeDisabled();
  });

  test('uses local chat API route for a direct message', async () => {
    renderChatWidget();

    fireEvent.click(screen.getByLabelText('채팅 열기'));
    fireEvent.change(screen.getByPlaceholderText('메시지를 입력하세요...'), {
      target: { value: '배송이 궁금합니다' },
    });
    fireEvent.click(screen.getByLabelText('메시지 전송'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/chat',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });
  });

  test('uses local chat API route even when a public chat API URL is configured', async () => {
    process.env.NEXT_PUBLIC_CHAT_API_URL = 'https://example.com/chat';

    renderChatWidget();

    fireEvent.click(screen.getByLabelText('채팅 열기'));
    fireEvent.click(screen.getByRole('button', { name: '상담원 연결' }));
    fireEvent.change(screen.getByPlaceholderText('메시지를 입력하세요...'), {
      target: { value: '배송이 궁금합니다' },
    });
    fireEvent.click(screen.getByLabelText('메시지 전송'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/chat',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });
  });
});
