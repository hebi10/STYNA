'use client';

export default function EventDetailError({ reset }: { reset: () => void }) {
  return (
    <section role="alert" aria-labelledby="event-error-title">
      <h1 id="event-error-title">이벤트 정보를 불러오지 못했습니다</h1>
      <p>일시적인 연결 문제일 수 있습니다. 잠시 후 다시 시도해 주세요.</p>
      <button type="button" onClick={reset}>다시 시도</button>
    </section>
  );
}
