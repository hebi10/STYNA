import { act, fireEvent, render, screen } from '@testing-library/react';
import EventInformationSections from './EventInformationSections';

jest.mock('./EventProductShowcase.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, { get: (_target, prop) => String(prop) }),
}));

const mockMatchMedia = (matches: boolean) => {
  const addEventListener = jest.fn();
  const removeEventListener = jest.fn();

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: jest.fn().mockReturnValue({
      matches,
      media: '(max-width: 640px)',
      onchange: null,
      addEventListener,
      removeEventListener,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }),
  });

  return { addEventListener, removeEventListener };
};

describe('EventInformationSections', () => {
  test('renders all three information sections expanded on desktop', () => {
    mockMatchMedia(false);

    render(
      <EventInformationSections
        contentHtml="<p>이벤트 소개</p>"
        benefitItems={['최대 70% 할인']}
        participationSteps={['대상 상품을 확인합니다.']}
        noticeItems={['재고에 따라 종료될 수 있습니다.']}
      />,
    );

    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 640px)');
    expect(screen.getAllByRole('button', { expanded: true })).toHaveLength(3);
    expect(screen.getAllByRole('button')).toHaveLength(3);
    screen.getAllByRole('button').forEach(button => {
      expect(button).toBeDisabled();
    });
    expect(screen.getByText('이벤트 소개')).toBeInTheDocument();
  });

  test('keeps only the first section open initially on mobile and toggles independently', () => {
    mockMatchMedia(true);

    const { container } = render(
      <EventInformationSections
        contentParagraphs={['한 줄 소개']}
        benefitItems={['무료 배송']}
        participationSteps={['로그인합니다.']}
        noticeItems={['계정당 1회 참여할 수 있습니다.']}
      />,
    );

    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      const controls = button.getAttribute('aria-controls');
      expect(controls).toBeTruthy();
      expect(container.querySelector(`#${controls}`)).not.toBeNull();
    });

    const participationButton = screen.getByRole('button', { name: '참여·사용 방법' });
    expect(screen.getAllByRole('button', { expanded: true })).toHaveLength(1);
    expect(participationButton).toBeEnabled();
    expect(participationButton).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(participationButton);
    expect(participationButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: '혜택 안내' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  test('renders the already-sanitized HTML without rewriting it', () => {
    mockMatchMedia(false);

    const { container } = render(
      <EventInformationSections
        contentHtml={'<p>정화된 <strong>이벤트 소개</strong></p>'}
        benefitItems={[]}
        participationSteps={[]}
        noticeItems={[]}
      />,
    );

    expect(screen.getByText('이벤트 소개').tagName).toBe('STRONG');
    expect(container.querySelector('p strong')).toHaveTextContent('이벤트 소개');
  });

  test('responds to media changes and removes the same listener on unmount', () => {
    const { addEventListener, removeEventListener } = mockMatchMedia(false);
    const { unmount } = render(
      <EventInformationSections
        benefitItems={[]}
        participationSteps={[]}
        noticeItems={[]}
      />,
    );
    const changeListener = addEventListener.mock.calls[0][1] as (event: MediaQueryListEvent) => void;

    act(() => {
      changeListener({ matches: true } as MediaQueryListEvent);
    });

    expect(screen.getAllByRole('button', { expanded: true })).toHaveLength(1);
    unmount();
    expect(removeEventListener).toHaveBeenCalledWith('change', changeListener);
  });
});
