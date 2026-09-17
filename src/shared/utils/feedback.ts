export type FeedbackTone = 'info' | 'success' | 'error';

export interface FeedbackMessage {
  message: string;
  tone?: FeedbackTone;
  duration?: number;
}

export const FEEDBACK_EVENT_NAME = 'styna:feedback';

export function publishFeedback(
  feedback: string | FeedbackMessage,
  tone: FeedbackTone = 'info',
) {
  if (typeof window === 'undefined') {
    return;
  }

  const detail: FeedbackMessage = typeof feedback === 'string'
    ? { message: feedback, tone }
    : feedback;

  window.dispatchEvent(new CustomEvent<FeedbackMessage>(FEEDBACK_EVENT_NAME, { detail }));
}
