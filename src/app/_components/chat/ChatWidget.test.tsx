import React from 'react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { auth as mockedFirebaseAuth } from '@/shared/libs/firebase/firebase';
import ChatWidget from './ChatWidget';

const mockUsePathname = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

jest.mock('@/shared/libs/firebase/firebase', () => ({
  auth: { currentUser: null },
}));

jest.mock('@/shared/utils/chatSession', () => ({
  getChatSessionId: jest.fn(() => 'widget-session-id-1234567890'),
}));

const mockAuthState = mockedFirebaseAuth as unknown as {
  currentUser: null | { getIdToken: jest.Mock<Promise<string>, []> };
};

jest.mock('./ChatWidget.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, prop) => String(prop),
  }),
}));

function renderChatWidget() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const renderWidget = () => (
    <QueryClientProvider client={queryClient}>
      <ChatWidget />
    </QueryClientProvider>
  );

  const rendered = render(renderWidget());

  return {
    ...rendered,
    rerenderWidget: () => rendered.rerender(renderWidget()),
  };
}

describe('ChatWidget', () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_CHAT_API_URL;
    mockAuthState.currentUser = null;
    mockUsePathname.mockReturnValue('/');
    jest.clearAllMocks();

    Element.prototype.scrollIntoView = jest.fn();
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
    });
    Object.defineProperty(window, 'cancelAnimationFrame', {
      configurable: true,
      value: jest.fn(),
    });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn().mockReturnValue({ matches: false }),
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { response: '배송 안내입니다.' } }),
    }) as jest.Mock;
  });

  test.each(['/auth/login', '/orders/cart'])
  ('does not render the chatbot on %s', (pathname) => {
    mockUsePathname.mockReturnValue(pathname);

    renderChatWidget();

    expect(screen.queryByRole('button', { name: '채팅 열기' })).not.toBeInTheDocument();
  });

  test('closes an open chat before returning from a hidden order route', () => {
    const { container, rerenderWidget } = renderChatWidget();

    fireEvent.click(screen.getByRole('button', { name: '채팅 열기' }));
    expect(container.querySelector('#help-chat-window')).toHaveAttribute('aria-hidden', 'false');

    mockUsePathname.mockReturnValue('/orders/cart');
    rerenderWidget();
    expect(screen.queryByRole('button', { name: '채팅 열기' })).not.toBeInTheDocument();

    mockUsePathname.mockReturnValue('/');
    rerenderWidget();

    expect(screen.getByRole('button', { name: '채팅 열기' })).toHaveAttribute('aria-expanded', 'false');
    expect(container.querySelector('#help-chat-window')).toHaveAttribute('aria-hidden', 'true');
  });

  test.each(['/products/item-1', '/events/summer-sale'])
  ('marks the chatbot as mobile-suppressed on %s', (pathname) => {
    mockUsePathname.mockReturnValue(pathname);

    renderChatWidget();

    expect(screen.getByTestId('chat-widget')).toHaveClass('mobileSuppressed');
  });

  test('keeps the chatbot visible without mobile suppression on the public home', () => {
    renderChatWidget();

    expect(screen.getByTestId('chat-widget')).not.toHaveClass('mobileSuppressed');
    expect(screen.getByRole('button', { name: '채팅 열기' })).toBeInTheDocument();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('connects the toggle, window, title, message log, and labeled input with ARIA', () => {
    const { container } = renderChatWidget();
    const toggle = screen.getByRole('button', { name: '채팅 열기' });
    const chatWindow = container.querySelector('#help-chat-window');

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', 'help-chat-window');
    expect(chatWindow).toHaveAttribute('aria-hidden', 'true');
    expect(chatWindow).toHaveAttribute('inert');
    expect(chatWindow).toHaveAttribute('aria-labelledby', 'help-chat-title');

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(chatWindow).toHaveAttribute('aria-hidden', 'false');
    expect(chatWindow).not.toHaveAttribute('inert');
    expect(screen.getByRole('log')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('textbox', { name: '도움말 질문' })).not.toBeDisabled();
    expect(screen.getByRole('textbox', { name: '도움말 질문' })).toHaveFocus();
  });

  test('opens with an enabled input and moves focus to it', () => {
    renderChatWidget();

    fireEvent.click(screen.getByRole('button', { name: '채팅 열기' }));

    expect(screen.getByRole('textbox', { name: '도움말 질문' })).toHaveFocus();
    expect(screen.getByRole('textbox', { name: '도움말 질문' })).not.toBeDisabled();
  });

  test('returns focus to the toggle when the window close button hides the chat', () => {
    renderChatWidget();

    fireEvent.click(screen.getByRole('button', { name: '채팅 열기' }));
    fireEvent.click(screen.getAllByRole('button', { name: '채팅 닫기' })[0]);

    expect(screen.getByRole('button', { name: '채팅 열기' })).toHaveFocus();
  });

  test('uses instant message scrolling when reduced motion is preferred', () => {
    jest.useFakeTimers();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn().mockReturnValue({ matches: true }),
    });
    renderChatWidget();

    fireEvent.click(screen.getByRole('button', { name: '채팅 열기' }));
    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto' });
  });

  test('keeps chatbot controls at least 44px in both dimensions', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/app/_components/chat/ChatWidget.module.css'),
      'utf8',
    );

    for (const selector of [
      'chatButton',
      'quickButton',
      'startChatButton',
      'resetButton',
      'closeButton',
      'sendButton',
    ]) {
      const rule = css.match(new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`, 's'))?.[1];
      expect(rule).toMatch(/min-width:\s*(?:44px|(?:4[5-9]|[5-9]\d|\d{3,})px)/);
      expect(rule).toMatch(/min-height:\s*(?:44px|(?:4[5-9]|[5-9]\d|\d{3,})px)/);
    }
  });

  test('uses a generous fixed chat height on desktop and mobile', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/app/_components/chat/ChatWidget.module.css'),
      'utf8',
    );

    expect(css).toMatch(/height:\s*min\(600px,\s*calc\(100dvh\s*-\s*5rem\)\)/);
    expect(css).toMatch(/@media\s*\(max-width:\s*480px\)\s*\{[\s\S]*?bottom:\s*calc\(0\.75rem\s*\+\s*env\(safe-area-inset-bottom\)\)[\s\S]*?height:\s*min\(600px,\s*calc\(100dvh\s*-\s*1\.5rem\)\)/);
  });

  test('uses larger chat controls on desktop while keeping the mobile size', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/app/_components/chat/ChatWidget.module.css'),
      'utf8',
    );

    expect(css).toMatch(/\.chatButton\s*\{[\s\S]*?width:\s*48px[\s\S]*?height:\s*48px/);
    expect(css).toMatch(/\.chatButtonIcon\s*\{[\s\S]*?width:\s*28px[\s\S]*?height:\s*28px/);
    expect(css).toMatch(/@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.chatButton\s*\{[\s\S]*?width:\s*44px[\s\S]*?height:\s*44px/);
    expect(css).toMatch(/@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.chatButtonIcon\s*\{[\s\S]*?width:\s*24px[\s\S]*?height:\s*24px/);
  });

  test('keeps quick buttons after a quick selection', () => {
    renderChatWidget();

    fireEvent.click(screen.getByLabelText('채팅 열기'));
    fireEvent.click(screen.getByRole('button', { name: '주문/배송' }));
    expect(screen.getByRole('button', { name: '교환/반품' })).toBeInTheDocument();
  });

  test('hides quick buttons when direct text input begins', () => {
    renderChatWidget();

    fireEvent.click(screen.getByLabelText('채팅 열기'));

    const input = screen.getByPlaceholderText('메시지를 입력하세요...');
    fireEvent.change(input, { target: { value: '직접 문의합니다' } });

    expect(screen.queryByRole('button', { name: '주문/배송' })).not.toBeInTheDocument();
  });

  test('renders an icon-only toggle with a labeled, enabled input', () => {
    renderChatWidget();

    const toggle = screen.getByLabelText('채팅 열기');
    expect(toggle.querySelector('img')).toHaveAttribute(
      'src',
      '/icons/chat-help-icon.png',
    );

    fireEvent.click(toggle);
    expect(screen.getByPlaceholderText('메시지를 입력하세요...')).not.toBeDisabled();
  });

  test('uses local chat API route after direct question mode is requested', async () => {
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

  test('uses shopping help copy without demo or portfolio framing', () => {
    const { container } = renderChatWidget();

    fireEvent.click(screen.getByLabelText('채팅 열기'));

    expect(screen.getAllByText(/도움말 챗봇/).length).toBeGreaterThan(0);
    expect(container.textContent).toContain('궁금한 내용을 바로 입력하거나 빠른 도움말을 선택해 주세요.');
    expect(container.textContent).not.toMatch(/데모|포트폴리오/);
  });
});
