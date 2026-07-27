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
  '직접 질문하기',
] as const;

const INITIAL_BOT_TEXT = `STYNA 도움말 챗봇입니다.

빠른 도움말을 선택하거나 직접 질문 모드를 시작해 주세요.
답변은 포트폴리오 데모 안내이며 실제 상담 요청을 접수하지 않습니다.`;

const DIRECT_QUESTION_TEXT = `챗봇 직접 질문 모드입니다.

입력 내용은 안내 답변 생성에만 사용되며 상담 요청을 저장하거나 전송하지 않습니다.
별도 문의는 1:1 문의 페이지를 이용해 주세요.`;

const ERROR_TEXT =
  '죄송합니다. 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해 주시거나 포트폴리오 문의(sevim0104@naver.com)를 이용해 주세요.';

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
function isDirectQuestionCommand(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  const compact = normalized.replace(/\s+/g, '');

  if (compact === '직접질문하기' || compact === '상담원' + '연결') return true;

  return [
    '직접 질문하기',
    '직접 질문',
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
  const [isDirectQuestionEnabled, setIsDirectQuestionEnabled] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const firstQuickButtonRef = useRef<HTMLButtonElement>(null);
  const chatToggleButtonRef = useRef<HTMLButtonElement>(null);
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
      const prefersReducedMotion =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      messagesEndRef.current.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
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
    if (!isMounted) return '도움말을 선택해 보세요';
    if (chatMutation.isPending) return '답변 작성 중...';

    switch (chatMode) {
      case 'active':
        return isDirectQuestionEnabled ? '직접 질문 모드' : '빠른 도움말 선택';
      default:
        return '도움말을 선택해 보세요';
    }
  }, [isMounted, chatMutation.isPending, chatMode, isDirectQuestionEnabled]);

  // ── 채팅 시작 ─────────────────────────────────────
  const startChat = useCallback(() => {
    setChatMode('active');
    setIsDirectQuestionEnabled(false);
    setMessages([createMessage(INITIAL_BOT_TEXT, 'bot')]);
  }, []);

  useEffect(() => {
    if (!isOpen || chatMode === 'idle') return;

    const frameId = window.requestAnimationFrame(() => {
      if (isDirectQuestionEnabled) {
        inputRef.current?.focus();
        return;
      }

      firstQuickButtonRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [chatMode, isDirectQuestionEnabled, isOpen]);

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

      const isDirectQuestion = isDirectQuestionCommand(messageText);

      // 직접 질문 모드는 API 호출 없이 데이터 처리 범위를 먼저 안내한다.
      if (isDirectQuestion) {
        setChatMode('active');
        setIsDirectQuestionEnabled(true);
        setMessages((prev) => [
          ...prev,
          createMessage(messageText, 'user'),
          createMessage(DIRECT_QUESTION_TEXT, 'bot'),
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
  const isInputDisabled = chatMutation.isPending || chatMode === 'idle' || !isDirectQuestionEnabled;
  const isSendDisabled = !inputValue.trim() || isInputDisabled;
  const isEventPage = pathname?.startsWith('/events');

  const toggleChat = useCallback(() => {
    if (!isOpen && chatMode === 'idle') {
      startChat();
    }
    setIsOpen((prev) => !prev);
  }, [chatMode, isOpen, startChat]);

  const closeChat = useCallback(() => {
    setIsOpen(false);
    window.requestAnimationFrame(() => chatToggleButtonRef.current?.focus());
  }, []);

  if (pathname?.startsWith('/auth')) {
    return null;
  }

  // ── 렌더링 ────────────────────────────────────────
  return (
    <div className={`${styles.chatWidget} ${isEventPage ? styles.eventPageWidget : ''}`}>
      {/* 채팅 창 */}
      <div
        id="help-chat-window"
        role="region"
        aria-labelledby="help-chat-title"
        aria-hidden={!isOpen}
        inert={!isOpen}
        className={`${styles.chatWindow} ${isOpen ? styles.open : ''} ${
          isDirectQuestionEnabled ? styles.agentConnected : ''
        }`}
      >
        {/* 헤더 */}
        <div className={styles.chatHeader}>
          <div>
            <h3 id="help-chat-title" className={styles.chatTitle}>
              도움말 챗봇
            </h3>
            <p className={styles.chatSubtitle}>
              {isMounted ? subtitleText : '도움말을 선택해 보세요'}
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
              onClick={closeChat}
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
          role="log"
          aria-live="polite"
        >
          {chatMode === 'idle' ? (
            <div className={styles.chatStart}>
              <div className={styles.welcomeMessage}>
                <h3>STYNA 도움말</h3>
                <p>안녕하세요! 무엇을 도와드릴까요?</p>
                <div className={styles.chatFeatures}>
                  <div className={styles.feature}>
                    <span className={styles.featureIcon}>●</span>
                    <span>주문/배송 문의</span>
                  </div>
                  <div className={styles.feature}>
                    <span className={styles.featureIcon}>●</span>
                    <span>상품 정보 안내</span>
                  </div>
                </div>
                <button className={styles.startChatButton} onClick={startChat}>
                  챗봇 시작하기
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
        {isChatActive && !isDirectQuestionEnabled && (
          <div className={styles.quickButtons}>
            {QUICK_BUTTONS.map((label, index) => (
              <button
                key={label}
                ref={index === 0 ? firstQuickButtonRef : undefined}
                className={`${styles.quickButton} ${label === '직접 질문하기' ? styles.connect : ''}`}
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
                  chatMode === 'active' && isDirectQuestionEnabled
                    ? '메시지를 입력하세요...'
                    : '직접 질문하기 선택 후 메시지를 입력하세요'
                }
                disabled={isInputDisabled}
                rows={1}
                aria-label="도움말 질문"
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
        ref={chatToggleButtonRef}
        className={`${styles.chatButton} ${isOpen ? styles.open : ''}`}
        onClick={toggleChat}
        aria-label={isOpen ? '채팅 닫기' : '채팅 열기'}
        aria-expanded={isOpen}
        aria-controls="help-chat-window"
      >
        {isOpen ? '×' : '도움말 챗봇'}
      </button>
    </div>
  );
};

export default ChatWidget;
