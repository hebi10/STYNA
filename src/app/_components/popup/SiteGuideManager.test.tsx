import { readFileSync } from 'fs';
import { resolve } from 'path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { OPEN_SITE_GUIDE_EVENT } from '@/shared/utils/siteGuide';
import SiteGuideManager from './SiteGuideManager';

const mockUsePathname = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

jest.mock('./SiteGuidePopup', () => ({
  __esModule: true,
  default: ({ isOpen }: { isOpen: boolean }) => (
    isOpen ? <div role="dialog" aria-label="쇼핑 안내" /> : null
  ),
}));

jest.mock('./SiteGuideManager.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, property) => String(property),
  }),
}));

describe('SiteGuideManager shared guide event', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/');
  });

  test('opens the popup when the shared guide event is dispatched', () => {
    render(<SiteGuideManager />);

    act(() => {
      window.dispatchEvent(new Event(OPEN_SITE_GUIDE_EVENT));
    });

    expect(screen.getByRole('dialog', { name: '쇼핑 안내' })).toBeInTheDocument();
  });

  test('opens the popup from the fixed shopping guide trigger', () => {
    render(<SiteGuideManager />);

    const trigger = screen.getByRole('button', { name: '쇼핑 안내 열기' });
    expect(trigger.querySelector('img')).toHaveAttribute(
      'src',
      '/icons/shopping-guide-icon.png',
    );

    fireEvent.click(trigger);

    expect(screen.getByRole('dialog', { name: '쇼핑 안내' })).toBeInTheDocument();
  });

  test('closes an open guide before returning from a hidden product route', () => {
    const { rerender } = render(<SiteGuideManager />);

    fireEvent.click(screen.getByRole('button', { name: '쇼핑 안내 열기' }));
    expect(screen.getByRole('dialog', { name: '쇼핑 안내' })).toBeInTheDocument();

    mockUsePathname.mockReturnValue('/products/item-1');
    rerender(<SiteGuideManager />);
    expect(screen.queryByRole('button', { name: '쇼핑 안내 열기' })).not.toBeInTheDocument();

    mockUsePathname.mockReturnValue('/');
    rerender(<SiteGuideManager />);
    expect(screen.getByRole('button', { name: '쇼핑 안내 열기' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '쇼핑 안내' })).not.toBeInTheDocument();
  });

  test('ignores guide open events while the guide is hidden', () => {
    mockUsePathname.mockReturnValue('/products/item-1');
    const { rerender } = render(<SiteGuideManager />);

    act(() => {
      window.dispatchEvent(new Event(OPEN_SITE_GUIDE_EVENT));
    });

    mockUsePathname.mockReturnValue('/');
    rerender(<SiteGuideManager />);

    expect(screen.getByRole('button', { name: '쇼핑 안내 열기' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '쇼핑 안내' })).not.toBeInTheDocument();
  });

  test('does not render the trigger or popup on auth routes', () => {
    mockUsePathname.mockReturnValue('/auth/login');

    render(<SiteGuideManager />);

    expect(screen.queryByRole('button', { name: '쇼핑 안내 열기' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '쇼핑 안내' })).not.toBeInTheDocument();
  });

  test.each(['/orders', '/orders/cart', '/products', '/products/item-1', '/events', '/events/summer-sale'])
  ('does not render the shopping guide on %s', (pathname) => {
    mockUsePathname.mockReturnValue(pathname);

    render(<SiteGuideManager />);

    expect(screen.queryByRole('button', { name: '쇼핑 안내 열기' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '쇼핑 안내' })).not.toBeInTheDocument();
  });

  test('keeps the public home guide available without mobile suppression', () => {
    render(<SiteGuideManager />);

    expect(screen.getByTestId('site-guide-manager')).not.toHaveClass('mobileSuppressed');
    expect(screen.getByRole('button', { name: '쇼핑 안내 열기' })).toBeInTheDocument();
  });

  test('keeps the public fixed controls touch-safe and vertically separated', () => {
    const chatCss = readFileSync(
      resolve(process.cwd(), 'src/app/_components/chat/ChatWidget.module.css'),
      'utf8',
    );
    const guideCss = readFileSync(
      resolve(process.cwd(), 'src/app/_components/popup/SiteGuideManager.module.css'),
      'utf8',
    );

    expect(chatCss).toMatch(/bottom:\s*calc\([^;]*env\(safe-area-inset-bottom\)\)/);
    expect(guideCss).toMatch(/bottom:\s*calc\([^;]*44px[^;]*env\(safe-area-inset-bottom\)\)/);
    expect(guideCss).toMatch(/min-height:\s*44px/);
    expect(guideCss).toMatch(/@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.mobileSuppressed\s*\{[\s\S]*?display:\s*none/);
  });

  test('removes the same shared guide listener when unmounted', () => {
    const addEventListener = jest.spyOn(window, 'addEventListener');
    const removeEventListener = jest.spyOn(window, 'removeEventListener');
    const { unmount } = render(<SiteGuideManager />);
    const registeredListener = addEventListener.mock.calls.find(
      ([eventName]) => eventName === OPEN_SITE_GUIDE_EVENT,
    )?.[1];

    unmount();

    expect(registeredListener).toEqual(expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith(
      OPEN_SITE_GUIDE_EVENT,
      registeredListener,
    );
    addEventListener.mockRestore();
    removeEventListener.mockRestore();
  });
});
