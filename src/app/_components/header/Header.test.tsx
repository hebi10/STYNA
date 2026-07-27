import { renderToStaticMarkup } from 'react-dom/server';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Header from './Header';
import { useAuth } from '@/context/authProvider';
import { useCartItemCount } from '@/shared/hooks/useCart';
import { CategoryOrderService } from '@/shared/services/categoryOrderService';
import {
  formatShippingPolicy,
  formatSignupBenefit,
} from '@/shared/constants/commercePolicy';

jest.mock('./Header.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, prop) => String(prop),
  }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock('@/context/authProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/shared/hooks/useCart', () => ({
  useCartItemCount: jest.fn(),
}));

jest.mock('@/shared/services/categoryOrderService', () => ({
  CategoryOrderService: {
    getSortedCategories: jest.fn(),
  },
}));

describe('Header', () => {
  const initialInnerWidth = window.innerWidth;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAuth).mockReturnValue({
      user: null,
      isAdmin: false,
      logout: jest.fn(),
    } as unknown as ReturnType<typeof useAuth>);
    jest.mocked(useCartItemCount).mockReturnValue({
      data: 0,
    } as unknown as ReturnType<typeof useCartItemCount>);
    jest.mocked(CategoryOrderService.getSortedCategories).mockResolvedValue([]);
  });

  afterEach(() => {
    document.body.style.removeProperty('overflow');
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: initialInnerWidth,
    });
  });

  test('renders only implemented commerce announcements', () => {
    const markup = renderToStaticMarkup(<Header />);

    expect(markup).toContain('class="header');
    expect(markup).toContain(formatSignupBenefit());
    expect(markup).toContain(formatShippingPolicy());
    expect(markup).toContain('도움말');
    expect(markup).not.toContain('고객센터');
    expect(markup).not.toMatch(/10% 쿠폰|오늘 출고|당일 출고|구매.*1%/);
  });

  test('includes an all-products entry point in the primary navigation', () => {
    const markup = renderToStaticMarkup(<Header />);

    expect(markup).toContain('href="/products"');
  });

  test('does not expose guessed category detail links before active categories load', () => {
    const markup = renderToStaticMarkup(<Header />);

    expect(markup).toContain('href="/categories"');
    expect(markup).not.toContain('href="/categories/tops"');
  });

  test('locks page scroll and returns focus to the menu button after Escape', async () => {
    document.body.style.overflow = 'clip';
    const { container } = render(<Header />);
    const menuButton = screen.getByRole('button', { name: '메뉴 열기' });

    menuButton.focus();
    fireEvent.click(menuButton);

    expect(document.body.style.overflow).toBe('hidden');
    expect(container.querySelector('.mobileMenuOverlay')).toHaveAttribute('aria-hidden', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '메뉴 열기' })).toHaveFocus();
      expect(document.body.style.overflow).toBe('clip');
    });
  });

  test('restores the existing overflow value when unmounted with the menu open', () => {
    document.body.style.overflow = 'scroll';
    const { unmount } = render(<Header />);

    fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));
    expect(document.body.style.overflow).toBe('hidden');

    unmount();

    expect(document.body.style.overflow).toBe('scroll');
  });

  test('keeps Tab focus inside the open mobile menu', () => {
    render(<Header />);
    const menuButton = screen.getByRole('button', { name: '메뉴 열기' });

    menuButton.focus();
    fireEvent.click(menuButton);

    const dialog = screen.getByRole('dialog', { name: '모바일 메뉴' });
    const firstLink = within(dialog).getByRole('link', { name: '전체 상품' });
    const lastLink = within(dialog).getByRole('link', { name: '로그인' });

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(firstLink).toHaveFocus();

    lastLink.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByRole('button', { name: '메뉴 닫기' })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(lastLink).toHaveFocus();
  });

  test('closes the mobile menu and restores scrolling at the desktop breakpoint', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    document.body.style.overflow = 'scroll';
    render(<Header />);

    fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));
    expect(document.body.style.overflow).toBe('hidden');

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 960 });
    fireEvent(window, new Event('resize'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '메뉴 열기' })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
      expect(screen.getByRole('button', { name: '메뉴 열기' })).not.toHaveFocus();
      expect(document.body.style.overflow).toBe('scroll');
    });
  });
});
