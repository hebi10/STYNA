import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import Header from './Header';
import { useAuth } from '@/context/authProvider';
import { useCartItemCount } from '@/shared/hooks/useCart';
import { useInquiryNotification } from '@/shared/hooks/useInquiryNotification';
import { CategoryOrderService } from '@/shared/services/categoryOrderService';
import { formatSignupBenefit } from '@/shared/constants/commercePolicy';

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

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}));

jest.mock('@/context/authProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/shared/hooks/useCart', () => ({
  useCartItemCount: jest.fn(),
}));

jest.mock('@/shared/hooks/useInquiryNotification', () => ({
  useInquiryNotification: jest.fn(),
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
    jest.mocked(useInquiryNotification).mockReturnValue(false);
    jest.mocked(CategoryOrderService.getSortedCategories).mockResolvedValue([]);
    jest.mocked(usePathname).mockReturnValue('/');
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
    expect(markup).not.toContain('쿠폰 할인 적용 후 상품금액');
    expect(markup).not.toContain('고객센터');
    expect(markup).not.toMatch(/10% 쿠폰|오늘 출고|당일 출고|구매.*1%/);
  });

  test('restores the previous desktop primary and secondary links', async () => {
    jest.mocked(CategoryOrderService.getSortedCategories).mockResolvedValue([
      { id: 'bags', name: '가방', order: 0 },
    ]);
    render(<Header />);

    const desktopNav = screen.getByRole('navigation', { name: 'Primary' });

    await waitFor(() => {
      expect(within(desktopNav).getByRole('link', { name: '가방' })).toHaveAttribute(
        'href',
        '/categories/bags',
      );
    });

    expect(within(desktopNav).getAllByRole('link').map((link) => link.textContent)).toEqual([
      '전체 상품',
      '신상',
      '베스트',
      '가방',
      '세일',
      '브랜드',
      '추천',
      '이벤트',
      '리뷰',
      '1:1문의',
      '상품문의',
    ]);
    expect(
      within(desktopNav).queryByRole('button', { name: 'SHOP 메뉴 열기' }),
    ).not.toBeInTheDocument();
  });

  test('renders the five shared groups in the mobile dialog and closes after a destination is chosen', async () => {
    render(<Header />);
    fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));

    const dialog = screen.getByRole('dialog', { name: '모바일 메뉴' });
    expect(within(dialog).getByRole('button', { name: 'SHOP 메뉴 열기' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: '추천' })).toHaveAttribute('href', '/recommend');
    expect(within(dialog).getByRole('link', { name: '이벤트' })).toHaveAttribute('href', '/events');
    expect(within(dialog).getByRole('link', { name: '리뷰' })).toHaveAttribute('href', '/reviews');
    expect(within(dialog).getByRole('button', { name: '고객지원 메뉴 열기' })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'SHOP 메뉴 열기' }));
    const productLink = within(dialog).getByRole('link', { name: '전체 상품' });
    productLink.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(productLink);

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '모바일 메뉴' })).not.toBeInTheDocument();
    });
  });

  test('keeps the mobile logo link hit target at least 44px high', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/_components/header/Header.module.css'),
      'utf8',
    );

    expect(source).toMatch(/\.logoLink\s*\{[^}]*min-height:\s*44px;/);
  });

  test('does not move focus while observing the initial pathname', () => {
    const focusTarget = document.createElement('button');
    document.body.appendChild(focusTarget);
    focusTarget.focus();

    const { unmount } = render(<Header />);

    expect(focusTarget).toHaveFocus();
    unmount();
    focusTarget.remove();
  });

  test('keeps one mobile disclosure open at a time and preserves inert desktop siblings', () => {
    const { container } = render(<Header />);
    fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));

    const dialog = screen.getByRole('dialog', { name: '모바일 메뉴' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'SHOP 메뉴 열기' }));
    expect(within(dialog).getByRole('link', { name: '전체 상품' })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: '고객지원 메뉴 열기' }));
    expect(within(dialog).queryByRole('link', { name: '전체 상품' })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'FAQ' })).toBeInTheDocument();
    expect(container.querySelector('.announcementBar')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.nav')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.userMenu')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.nav')).toHaveAttribute('inert');
  });

  test('resets the mobile category disclosure when the menu closes', async () => {
    jest.mocked(CategoryOrderService.getSortedCategories).mockResolvedValue([
      { id: 'bags', name: '가방', order: 0 },
    ]);
    render(<Header />);

    fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));
    let dialog = screen.getByRole('dialog', { name: '모바일 메뉴' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'SHOP 메뉴 열기' }));
    const categoryTrigger = await within(dialog).findByRole('button', {
      name: '카테고리 하위 메뉴 열기',
    });
    fireEvent.click(categoryTrigger);
    expect(within(dialog).getByRole('link', { name: '가방' })).toBeInTheDocument();

    fireEvent.click(dialog.querySelector('.mobileMenuOverlay')!);
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '모바일 메뉴' })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));
    dialog = screen.getByRole('dialog', { name: '모바일 메뉴' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'SHOP 메뉴 열기' }));

    expect(
      within(dialog).getByRole('button', { name: '카테고리 하위 메뉴 열기' }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(within(dialog).queryByRole('link', { name: '가방' })).not.toBeInTheDocument();
  });

  test('keeps member, admin, cart badge and logout conditions in the mobile menu', async () => {
    const logout = jest.fn();
    jest.mocked(useAuth).mockReturnValue({
      user: { uid: 'member-1' },
      isAdmin: true,
      logout,
    } as unknown as ReturnType<typeof useAuth>);
    jest.mocked(useCartItemCount).mockReturnValue({
      data: 3,
    } as unknown as ReturnType<typeof useCartItemCount>);
    render(<Header />);

    await waitFor(() => {
      expect(screen.getAllByText('3')).toHaveLength(2);
    });
    fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));
    const dialog = screen.getByRole('dialog', { name: '모바일 메뉴' });
    expect(within(dialog).getByRole('link', { name: '마이페이지' })).toHaveAttribute('href', '/mypage');
    expect(within(dialog).getByRole('link', { name: '관리자' })).toHaveAttribute('href', '/admin');
    expect(within(dialog).queryByRole('link', { name: '로그인' })).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: '로그아웃' }));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  test('closes the mobile menu when a direct or user destination is selected', async () => {
    render(<Header />);
    fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));

    const dialog = screen.getByRole('dialog', { name: '모바일 메뉴' });
    const recommend = within(dialog).getByRole('link', { name: '추천' });
    recommend.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(recommend);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));
    const search = within(screen.getByRole('dialog')).getByRole('link', { name: '검색' });
    search.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(search);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
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

  test('excludes page and floating siblings while the mobile dialog is open and restores their attributes on close', async () => {
    render(
      <>
        <Header />
        <main aria-hidden="false" data-testid="page-main" />
        <footer data-testid="page-footer" />
        <div aria-hidden="false" data-testid="chat-widget" />
        <div aria-hidden="true" data-testid="site-guide-manager" />
      </>,
    );
    const main = screen.getByTestId('page-main');
    const footer = screen.getByTestId('page-footer');
    const chatWidget = screen.getByTestId('chat-widget');
    const siteGuideManager = screen.getByTestId('site-guide-manager');
    footer.setAttribute('inert', '');
    siteGuideManager.setAttribute('inert', '');

    fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));

    expect(main).toHaveAttribute('aria-hidden', 'true');
    expect(main).toHaveAttribute('inert');
    expect(footer).toHaveAttribute('aria-hidden', 'true');
    expect(footer).toHaveAttribute('inert');
    expect(chatWidget).toHaveAttribute('aria-hidden', 'true');
    expect(chatWidget).toHaveAttribute('inert');
    expect(siteGuideManager).toHaveAttribute('aria-hidden', 'true');
    expect(siteGuideManager).toHaveAttribute('inert');

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(main).toHaveAttribute('aria-hidden', 'false');
      expect(main).not.toHaveAttribute('inert');
      expect(footer).not.toHaveAttribute('aria-hidden');
      expect(footer).toHaveAttribute('inert');
      expect(chatWidget).toHaveAttribute('aria-hidden', 'false');
      expect(chatWidget).not.toHaveAttribute('inert');
      expect(siteGuideManager).toHaveAttribute('aria-hidden', 'true');
      expect(siteGuideManager).toHaveAttribute('inert');
    });
  });

  test('restores page and floating sibling attributes when unmounted with the mobile dialog open', () => {
    const { unmount } = render(
      <>
        <Header />
        <main aria-hidden="false" data-testid="page-main" />
        <footer data-testid="page-footer" />
        <div aria-hidden="false" data-testid="chat-widget" />
        <div aria-hidden="true" data-testid="site-guide-manager" />
      </>,
    );
    const main = screen.getByTestId('page-main');
    const footer = screen.getByTestId('page-footer');
    const chatWidget = screen.getByTestId('chat-widget');
    const siteGuideManager = screen.getByTestId('site-guide-manager');
    main.setAttribute('inert', '');
    chatWidget.setAttribute('inert', '');

    fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));
    expect(main).toHaveAttribute('aria-hidden', 'true');
    expect(footer).toHaveAttribute('aria-hidden', 'true');
    expect(footer).toHaveAttribute('inert');
    expect(chatWidget).toHaveAttribute('aria-hidden', 'true');
    expect(chatWidget).toHaveAttribute('inert');
    expect(siteGuideManager).toHaveAttribute('aria-hidden', 'true');
    expect(siteGuideManager).toHaveAttribute('inert');

    unmount();

    expect(main).toHaveAttribute('aria-hidden', 'false');
    expect(main).toHaveAttribute('inert');
    expect(footer).not.toHaveAttribute('aria-hidden');
    expect(footer).not.toHaveAttribute('inert');
    expect(chatWidget).toHaveAttribute('aria-hidden', 'false');
    expect(chatWidget).toHaveAttribute('inert');
    expect(siteGuideManager).toHaveAttribute('aria-hidden', 'true');
    expect(siteGuideManager).not.toHaveAttribute('inert');
  });

  test('closes the mobile menu and nested disclosure when the pathname changes externally', async () => {
    jest.mocked(CategoryOrderService.getSortedCategories).mockResolvedValue([
      { id: 'bags', name: '가방', order: 0 },
    ]);
    document.body.style.overflow = 'scroll';
    const { rerender } = render(<Header />);

    fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));
    const dialog = screen.getByRole('dialog', { name: '모바일 메뉴' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'SHOP 메뉴 열기' }));
    const categoryTrigger = await within(dialog).findByRole('button', {
      name: '카테고리 하위 메뉴 열기',
    });
    fireEvent.click(categoryTrigger);
    expect(within(dialog).getByRole('link', { name: '가방' })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');

    jest.mocked(usePathname).mockReturnValue('/products');
    rerender(<Header />);

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '모바일 메뉴' })).not.toBeInTheDocument();
      expect(document.body.style.overflow).toBe('scroll');
    });

    fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }));
    const reopenedDialog = screen.getByRole('dialog', { name: '모바일 메뉴' });
    fireEvent.click(within(reopenedDialog).getByRole('button', { name: 'SHOP 메뉴 열기' }));
    expect(
      within(reopenedDialog).getByRole('button', { name: '카테고리 하위 메뉴 열기' }),
    ).toHaveAttribute('aria-expanded', 'false');
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
    const firstLink = within(dialog).getByRole('button', { name: 'SHOP 메뉴 열기' });
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

  test.each([
    [false, '/cs/inquiry?tab=list', '새 문의 답변 확인'],
    [true, '/admin/inquiries?filter=unread', '새 고객 문의 확인'],
  ] as const)('읽지 않은 문의가 있으면 admin=%s 역할의 종 링크를 표시한다', (isAdmin, href, label) => {
    jest.mocked(useAuth).mockReturnValue({
      user: { uid: 'owner-1' },
      userData: {
        email: 'owner-1@example.com',
        name: '작성자',
        role: isAdmin ? 'admin' : 'user',
        status: 'active',
      },
      isAdmin,
      loading: false,
      isUserDataLoading: false,
      logout: jest.fn(),
    } as unknown as ReturnType<typeof useAuth>);
    jest.mocked(useInquiryNotification).mockReturnValue(true);

    render(<Header />);

    const links = screen.getAllByRole('link', { name: label });
    expect(links).toHaveLength(2);
    links.forEach((link) => expect(link).toHaveAttribute('href', href));
  });

  test('읽지 않은 문의가 없으면 종 링크를 표시하지 않는다', () => {
    jest.mocked(useAuth).mockReturnValue({
      user: { uid: 'owner-1' },
      isAdmin: false,
      loading: false,
      isUserDataLoading: false,
      logout: jest.fn(),
    } as unknown as ReturnType<typeof useAuth>);

    render(<Header />);

    expect(screen.queryByRole('link', { name: '새 문의 답변 확인' }))
      .not.toBeInTheDocument();
  });

  test('비로그인 또는 인증 로딩 중에는 알림 구독을 비활성화한다', () => {
    const { rerender } = render(<Header />);

    expect(useInquiryNotification).toHaveBeenLastCalledWith({
      userId: null,
      isAdmin: false,
      enabled: false,
    });

    jest.mocked(useAuth).mockReturnValue({
      user: { uid: 'owner-1' },
      isAdmin: false,
      loading: true,
      isUserDataLoading: false,
      logout: jest.fn(),
    } as unknown as ReturnType<typeof useAuth>);
    rerender(<Header />);

    expect(useInquiryNotification).toHaveBeenLastCalledWith({
      userId: 'owner-1',
      isAdmin: false,
      enabled: false,
    });
    expect(screen.queryByRole('link', { name: '새 문의 답변 확인' }))
      .not.toBeInTheDocument();
  });
});
