import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  buildDemoDataNotice,
  formatShippingPolicy,
  formatSignupBenefit,
  formatSupportHours,
} from '@/shared/constants/commercePolicy';
import SiteGuidePopup from './SiteGuidePopup';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock('./SiteGuidePopup.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, property) => String(property),
  }),
}));

describe('SiteGuidePopup policy copy', () => {
  test('shows canonical policies without promising staffed support', () => {
    const markup = renderToStaticMarkup(
      <SiteGuidePopup isOpen onClose={jest.fn()} />,
    );

    expect(markup).toContain(formatShippingPolicy());
    expect(markup).toContain(formatSignupBenefit());
    expect(markup).toContain(buildDemoDataNotice());
    expect(markup).toContain(formatSupportHours());
    expect(markup).toContain('포트폴리오 문의 안내');
    expect(markup).toContain('답변 여부와 시점은 보장하지 않습니다');
    expect(markup).not.toMatch(/순차적으로 확인|고객센터.*운영/);
    expect(markup).not.toMatch(
      /생일 쿠폰|구매 적립|당일 출고|수령 후 7일|무료 교환|구매.*1%/,
    );
  });

  test('renders nothing while closed', () => {
    expect(renderToStaticMarkup(
      <SiteGuidePopup isOpen={false} onClose={jest.fn()} />,
    )).toBe('');
  });

  test('provides dialog semantics and closes with Escape', () => {
    const onClose = jest.fn();

    render(<SiteGuidePopup isOpen onClose={onClose} />);

    const dialog = screen.getByRole('dialog', { name: 'STYNA 쇼핑 안내' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('moves focus inside, traps Tab, and restores the previous focus when closed', () => {
    const onClose = jest.fn();
    const { rerender } = render(
      <>
        <button>안내 열기</button>
        <SiteGuidePopup isOpen={false} onClose={onClose} />
      </>,
    );
    const trigger = screen.getByRole('button', { name: '안내 열기' });
    trigger.focus();

    rerender(
      <>
        <button>안내 열기</button>
        <SiteGuidePopup isOpen onClose={onClose} />
      </>,
    );
    const dialog = screen.getByRole('dialog', { name: 'STYNA 쇼핑 안내' });
    const dialogButtons = within(dialog).getAllByRole('button');
    const firstButton = dialogButtons[0];
    const lastButton = dialogButtons[dialogButtons.length - 1];

    expect(firstButton).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(lastButton).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(firstButton).toHaveFocus();

    rerender(
      <>
        <button>안내 열기</button>
        <SiteGuidePopup isOpen={false} onClose={onClose} />
      </>,
    );
    expect(trigger).toHaveFocus();
  });

  test('keeps the dialog content scrollable on short mobile viewports', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/app/_components/popup/SiteGuidePopup.module.css'),
      'utf8',
    );
    const popupRule = css.match(/\.popup\s*\{([\s\S]*?)\}/)?.[1];

    expect(popupRule).toMatch(/overflow-y:\s*auto/);
    expect(css).toMatch(/max-height:\s*calc\(100dvh\s*-\s*1\.5rem\)/);
  });
});
