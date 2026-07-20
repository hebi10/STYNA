'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { auth } from '@/shared/libs/firebase/firebase';
import { getChatSessionId } from '@/shared/utils/chatSession';
import styles from './ChatWidget.module.css';

// ─── 상수 ──────────────────────────────────────────────
function getChatAPIUrl(): string {
  return '/api/chat';
}
const TYPING_DELAY_BASE = 800;
const TYPING_DELAY_RANGE = 400;
const SCROLL_THRESHOLD = 50;
const MAX_HISTORY_LENGTH = 5;
const MAX_TEXTAREA_HEIGHT = 80;

const QUICK_BUTTONS = [
  '주문/배송',
  '교환/반품',
  '상품 문의',
  '쿠폰/혜택',
  '상담원 연결',
] as const;

const INITIAL_BOT_TEXT = `STYNA 실시간 상담입니다.

문의 목적을 선택하거나 바로 메시지를 남겨주세요.
운영시간 외 문의는 1:1 문의로도 접수할 수 있습니다.`;

const CONNECT_REQUEST_TEXT = `상담 연결 요청을 접수했습니다.

평일 10:00~18:00에는 순차적으로 확인합니다.
운영시간 외에는 1:1 문의를 남겨주시면 다음 영업일에 답변드리겠습니다.`;

const ERROR_TEXT =
  '죄송합니다. 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해 주시거나 고객센터(sevim0104@naver.com)로 연락해 주세요.';

// ─── 타입 ──────────────────────────────────────────────
export type ChatMode = 'idle' | 'active';

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

interface ChatAPIParams {
  message: string;
  useAI: boolean;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
}

interface ChatAPIResponse {
  response?: string;
  error?: string;
}

// ─── 유틸리티 함수 ─────────────────────────────────────
function isAgentConnectCommand(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  const compact = normalized.replace(/\s+/g, '');

  if (compact === '상담원' + '연결') return true;

  return [
    '상담원 연결',
    '상담 연결',
    '상담원',
    '실시간 상담',
    '담당자 연결',
  ].includes(normalized);
}

function createMessage(text: string, sender: 'user' | 'bot'): ChatMessage {
  return {
    id: `${Date.now()}-${sender}`,
    text,
    sender,
    timestamp: new Date(),
  };
}

function buildConversationHistory(messages: ChatMessage[]) {
  return messages.slice(-MAX_HISTORY_LENGTH).map((msg) => ({
    role: (msg.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: msg.text,
  }));
}

function typingDelay(): Promise<void> {
  return new Promise((resolve) =>
    setTimeout(resolve, TYPING_DELAY_BASE + Math.random() * TYPING_DELAY_RANGE),
  );
}

// ─── API 호출 함수 ─────────────────────────────────────
async function callChatAPI(params: ChatAPIParams): Promise<ChatAPIResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Chat-Session-Id': getChatSessionId(),
  };
  const currentUser = auth.currentUser;
  if (currentUser) {
    const token = await currentUser.getIdToken();
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(getChatAPIUrl(), {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const json = await response.json();

  // 통합 응답 포맷 { success, data: { response } } 처리
  if (json.success && json.data?.response) {
    return { response: json.data.response };
  }

  // 레거시 포맷 호환 { response }
  return json;
}

// ─── MessageText 컴포넌트 (split 1회) ──────────────────
const MessageText = React.memo<{ text: string }>(({ text }) => {
  const lines = useMemo(() => text.split('\n'), [text]);

  return (
    <div>
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {line}
          {i < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </div>
  );
});
MessageText.displayName = 'MessageText';

// ─── ChatWidget 컴포넌트 ───────────────────────────────
const ChatWidget: React.FC = () => {
  const pathname = usePathname();

  // UI 상태
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // 통합 채팅 상태: idle → active
  const [chatMode, setChatMode] = useState<ChatMode>('idle');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isAgentConnectRequested, setIsAgentConnectRequested] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);

  // 파생 상태
  const isChatActive = chatMode !== 'idle';

  // ── 마운트 확인 ────────────────────────────────────
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ── 스크롤 제어 ───────────────────────────────────
  const scrollToBottom = useCallback(() => {
    if (!isUserScrollingRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (!chatMessagesRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatMessagesRef.current;
    isUserScrollingRef.current = scrollTop + clientHeight < scrollHeight - SCROLL_THRESHOLD;
  }, []);

  // 메시지 추가 시 자동 스크롤
  useEffect(() => {
    if (messages.length === 0) return;
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [messages, scrollToBottom]);

  // ── TanStack Query Mutation ────────────────────────
  const chatMutation = useMutation({
    mutationFn: async (params: ChatAPIParams) => {
      const data = await callChatAPI(params);
      await typingDelay();
      return data;
    },
    onSuccess: (data) => {
      const responseText = data.response || '응답을 받을 수 없습니다.';
      setMessages((prev) => [...prev, createMessage(responseText, 'bot')]);
    },
    onError: () => {
      setMessages((prev) => [...prev, createMessage(ERROR_TEXT, 'bot')]);
    },
  });

  // 타이핑 인디케이터 표시 중 스크롤
  useEffect(() => {
    if (!chatMutation.isPending) return;
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [chatMutation.isPending, scrollToBottom]);

  // ── Subtitle 텍스트 ───────────────────────────────
  const subtitleText = useMemo(() => {
    if (!isMounted) return '채팅 상담을 시작해보세요';
    if (chatMutation.isPending) return '답변 작성 중...';

    switch (chatMode) {
      case 'active':
        return isAgentConnectRequested ? '상담 연결 후 직접 입력' : '상담원 연결 후 직접 입력';
      default:
        return '채팅 상담을 시작해보세요';
    }
  }, [isMounted, chatMutation.isPending, chatMode, isAgentConnectRequested]);

  // ── 채팅 시작 ─────────────────────────────────────
  const startChat = useCallback(() => {
    setChatMode('active');
    setIsAgentConnectRequested(false);
    setMessages([createMessage(INITIAL_BOT_TEXT, 'bot')]);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, []);

  // ── 채팅 리셋 ─────────────────────────────────────
  const resetChat = useCallback(() => {
    setInputValue('');
    chatMutation.reset();
    startChat();
  }, [chatMutation, startChat]);

  // ── 공통 메시지 전송 코어 ─────────────────────────
  const sendMessageCore = useCallback(
    (messageText: string) => {
      if (!messageText.trim() || chatMutation.isPending) return;

      const isConnect = isAgentConnectCommand(messageText);

      // 상담 연결 요청은 API 호출 없이 접수 안내를 먼저 표시한다.
      if (isConnect) {
        setChatMode('active');
        setIsAgentConnectRequested(true);
        setMessages((prev) => [
          ...prev,
          createMessage(messageText, 'user'),
          createMessage(CONNECT_REQUEST_TEXT, 'bot'),
        ]);
        return;
      }

      const shouldUseAI = chatMode === 'active';

      // Optimistic: 사용자 메시지 즉시 추가
      setMessages((prev) => [...prev, createMessage(messageText, 'user')]);

      chatMutation.mutate({
        message: messageText,
        useAI: shouldUseAI,
        conversationHistory: buildConversationHistory(messages),
      });
    },
    [chatMutation, chatMode, messages],
  );

  // ── 텍스트 입력 → 전송 ────────────────────────────
  const sendMessage = useCallback(() => {
    sendMessageCore(inputValue.trim());
    setInputValue('');
  }, [inputValue, sendMessageCore]);

  // ── 빠른 선택 버튼 → 전송 ─────────────────────────
  const handleQuickButton = useCallback(
    (text: string) => {
      if (chatMode === 'idle') return;
      sendMessageCore(text);
    },
    [chatMode, sendMessageCore],
  );

  // ── 키보드 이벤트 ─────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && chatMode === 'active') {
        e.preventDefault();
        sendMessage();
      }
    },
    [chatMode, sendMessage],
  );

  // ── 입력 변경 + 자동 높이 ─────────────────────────
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputValue(e.target.value);

      const textarea = e.target;
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
    },
    [],
  );

  // ── 파생 disabled 상태 ────────────────────────────
  const isInputDisabled = chatMutation.isPending || chatMode === 'idle' || !isAgentConnectRequested;
  const isSendDisabled = !inputValue.trim() || isInputDisabled;
  const isEventPage = pathname?.startsWith('/events');

  const toggleChat = useCallback(() => {
    if (!isOpen && chatMode === 'idle') {
      startChat();
    }
    setIsOpen((prev) => !prev);
  }, [chatMode, isOpen, startChat]);

  if (pathname?.startsWith('/auth')) {
    return null;
  }

  // ── 렌더링 ────────────────────────────────────────
  return (
    <div className={`${styles.chatWidget} ${isEventPage ? styles.eventPageWidget : ''}`}>
      {/* 채팅 창 */}
      <div
        className={`${styles.chatWindow} ${isOpen ? styles.open : ''} ${
          isAgentConnectRequested ? styles.agentConnected : ''
        }`}
      >
        {/* 헤더 */}
        <div className={styles.chatHeader}>
          <div>
            <h3 className={styles.chatTitle}>
              실시간 상담
            </h3>
            <p className={styles.chatSubtitle}>
              {isMounted ? subtitleText : '채팅 상담을 시작해보세요'}
            </p>
          </div>
          <div className={styles.headerButtons}>
            {isChatActive && (
              <button
                className={styles.resetButton}
                onClick={resetChat}
                aria-label="채팅 처음부터 시작"
                title="새로 시작"
              >
                ↻
              </button>
            )}
            <button
              className={styles.closeButton}
              onClick={() => setIsOpen(false)}
              aria-label="채팅 닫기"
            >
              ×
            </button>
          </div>
        </div>

        {/* 메시지 영역 */}
        <div
          className={styles.chatMessages}
          ref={chatMessagesRef}
          onScroll={handleScroll}
        >
          {chatMode === 'idle' ? (
            <div className={styles.chatStart}>
              <div className={styles.welcomeMessage}>
                <h3>STYNA 고객상담</h3>
                <p>안녕하세요! 무엇을 도와드릴까요?</p>
                <div className={styles.chatFeatures}>
                  <div className={styles.feature}>
                    <span className={styles.featureIcon}>●</span>
                    <span>주문/배송 문의</span>
                  </div>
                  <div className={styles.feature}>
                    <span className={styles.featureIcon}>●</span>
                    <span>상품 문의 접수</span>
                  </div>
                </div>
                <button className={styles.startChatButton} onClick={startChat}>
                  채팅 상담 시작하기
                </button>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`${styles.message} ${styles[message.sender]}`}
                >
                  <div className={styles.messageBubble}>
                    <MessageText text={message.text} />
                  </div>
                </div>
              ))}

              {/* 타이핑 인디케이터 */}
              {chatMutation.isPending && (
                <div className={`${styles.message} ${styles.bot}`}>
                  <div className={styles.typingIndicator}>
                    <div className={styles.typingDots}>
                      <div className={styles.typingDot}></div>
                      <div className={styles.typingDot}></div>
                      <div className={styles.typingDot}></div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 빠른 선택 버튼 */}
        {isChatActive && !isAgentConnectRequested && (
          <div className={styles.quickButtons}>
            {QUICK_BUTTONS.map((label) => (
              <button
                key={label}
                className={`${styles.quickButton} ${label === '상담원 연결' ? styles.connect : ''}`}
                onClick={() => handleQuickButton(label)}
                disabled={chatMutation.isPending}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* 입력 영역 */}
        {isChatActive && (
          <div className={styles.chatInput}>
            <div className={styles.inputGroup}>
              <textarea
                ref={inputRef}
                className={styles.messageInput}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  chatMode === 'active' && isAgentConnectRequested
                    ? '메시지를 입력하세요...'
                    : '상담원 연결 후 메시지를 입력하세요'
                }
                disabled={isInputDisabled}
                rows={1}
              />
              <button
                className={styles.sendButton}
                onClick={sendMessage}
                disabled={isSendDisabled}
                aria-label="메시지 전송"
              >
                전송
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 채팅 토글 버튼 */}
      <button
        className={`${styles.chatButton} ${isOpen ? styles.open : ''}`}
        onClick={toggleChat}
        aria-label={isOpen ? '채팅 닫기' : '채팅 열기'}
      >
        {isOpen ? '×' : '실시간 상담'}
      </button>
    </div>
  );
};

export default ChatWidget;
