import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { auth as mockedFirebaseAuth } from '@/shared/libs/firebase/firebase';
import ChatWidget from './ChatWidget';

jest.mock('@/shared/libs/firebase/firebase', () => ({
  auth: { currentUser: null },
}));

jest.mock('@/shared/utils/chatSession', () => ({
  getChatSessionId: jest.fn(() => 'widget-session-id-1234567890'),
}));

const mockAuthState = mockedFirebaseAuth as unknown as {
  currentUser: null | { getIdToken: jest.Mock<Promise<string>, []> };
};

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
    mockAuthState.currentUser = null;
    jest.clearAllMocks();

    Element.prototype.scrollIntoView = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { response: '배송 안내입니다.' } }),
    }) as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('keeps message input disabled until agent connect is requested', () => {
    renderChatWidget();

    fireEvent.click(screen.getByLabelText('채팅 열기'));

    expect(screen.getByPlaceholderText('상담원 연결 후 메시지를 입력하세요')).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: '상담원 연결' }));

    expect(screen.getByPlaceholderText('메시지를 입력하세요...')).not.toBeDisabled();
  });

  test('uses local chat API route after agent connect is requested', async () => {
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
          headers: {
            'Content-Type': 'application/json',
            'X-Chat-Session-Id': 'widget-session-id-1234567890',
          },
        }),
      );
    });
  });

  test('adds a bearer token when Firebase has a current user', async () => {
    const getIdToken = jest.fn<Promise<string>, []>().mockResolvedValue('valid-id-token');
    mockAuthState.currentUser = { getIdToken };
    renderChatWidget();

    fireEvent.click(screen.getByLabelText('채팅 열기'));
    fireEvent.click(screen.getByRole('button', { name: '상담원 연결' }));
    fireEvent.change(screen.getByPlaceholderText('메시지를 입력하세요...'), {
      target: { value: '로그인 상담 요청' },
    });
    fireEvent.click(screen.getByLabelText('메시지 전송'));

    await waitFor(() => {
      expect(getIdToken).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/chat',
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer valid-id-token',
            'Content-Type': 'application/json',
            'X-Chat-Session-Id': 'widget-session-id-1234567890',
          },
        }),
      );
    });
  });

  test('fails closed without making a request when token retrieval fails', async () => {
    mockAuthState.currentUser = {
      getIdToken: jest.fn<Promise<string>, []>().mockRejectedValue(new Error('token failed')),
    };
    renderChatWidget();

    fireEvent.click(screen.getByLabelText('채팅 열기'));
    fireEvent.click(screen.getByRole('button', { name: '상담원 연결' }));
    fireEvent.change(screen.getByPlaceholderText('메시지를 입력하세요...'), {
      target: { value: '토큰 실패 요청' },
    });
    fireEvent.click(screen.getByLabelText('메시지 전송'));

    await waitFor(() => {
      expect(screen.getByText(/일시적인 문제가 발생했습니다/)).toBeInTheDocument();
    });
    expect(global.fetch).not.toHaveBeenCalled();
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
