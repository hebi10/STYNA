import React from 'react';
import fs from 'fs';
import path from 'path';
import { fireEvent, render, screen } from '@testing-library/react';
import AsyncStatePanel from './AsyncStatePanel';

jest.mock('./AsyncStatePanel.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, property) => String(property),
  }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe('AsyncStatePanel', () => {
  test('uses an h2 by default', () => {
    render(
      <AsyncStatePanel kind="permission" title="기본 안내 제목" />,
    );

    expect(screen.getByRole('heading', { level: 2, name: '기본 안내 제목' }))
      .toBeInTheDocument();
  });

  test('allows a page-level h1', () => {
    const pageHeadingProps = {
      kind: 'permission',
      title: '페이지 안내 제목',
      headingLevel: 'h1',
    } as React.ComponentProps<typeof AsyncStatePanel> & { headingLevel: 'h1' };

    render(<AsyncStatePanel {...pageHeadingProps} />);

    expect(screen.getByRole('heading', { level: 1, name: '페이지 안내 제목' }))
      .toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: '페이지 안내 제목' }))
      .not.toBeInTheDocument();
  });

  test('announces loading progress with a busy status and title', () => {
    render(<AsyncStatePanel kind="loading" title="상품을 불러오는 중입니다." />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('status')).toHaveTextContent('상품을 불러오는 중입니다.');
    expect(screen.getByRole('status').querySelector('.spinner')).toHaveAttribute('aria-hidden', 'true');
  });

  test('announces an error title and description as an alert', () => {
    render(
      <AsyncStatePanel
        kind="error"
        title="상품을 불러오지 못했습니다."
        description="잠시 후 다시 시도해 주세요."
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('상품을 불러오지 못했습니다.');
    expect(screen.getByRole('alert')).toHaveTextContent('잠시 후 다시 시도해 주세요.');
  });

  test.each(['empty', 'permission'] as const)(
    'does not create an unnecessary live region for %s',
    (kind) => {
      render(<AsyncStatePanel kind={kind} title="안내 제목" description="안내 설명" />);

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByText('안내 제목')).toBeInTheDocument();
      expect(screen.getByText('안내 설명')).toBeInTheDocument();
    },
  );

  test('runs a callback primary action when clicked', () => {
    const retry = jest.fn();
    render(
      <AsyncStatePanel
        kind="error"
        title="상품을 불러오지 못했습니다."
        primaryAction={{ label: '다시 시도', onClick: retry }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(screen.getByRole('button', { name: '다시 시도' })).toHaveAttribute('type', 'button');
    expect(retry).toHaveBeenCalledTimes(1);
  });

  test('renders a callback action with an explicit undefined href as a button', () => {
    const retry = jest.fn();
    render(
      <AsyncStatePanel
        kind="error"
        title="상품을 불러오지 못했습니다."
        primaryAction={{ label: '다시 시도', onClick: retry, href: undefined }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  test('renders primary and secondary links in their declared order', () => {
    render(
      <AsyncStatePanel
        kind="permission"
        title="로그인이 필요합니다."
        primaryAction={{
          label: '로그인하고 계속하기',
          href: '/auth/login?redirect=/orders/cart',
        }}
        secondaryAction={{ label: '쇼핑 계속하기', href: '/products' }}
      />,
    );

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAccessibleName('로그인하고 계속하기');
    expect(links[0]).toHaveAttribute('href', '/auth/login?redirect=/orders/cart');
    expect(links[0]).toHaveClass('action', 'primaryAction');
    expect(links[1]).toHaveAccessibleName('쇼핑 계속하기');
    expect(links[1]).toHaveAttribute('href', '/products');
    expect(links[1]).toHaveClass('action', 'secondaryAction');
  });

  test('gives primary and secondary actions distinct visual treatments', () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), 'src/app/_components/AsyncStatePanel.module.css'),
      'utf8',
    );
    const actionBlock = css.match(/\.action\s*\{[^}]*\}/)?.[0] ?? '';
    const primaryActionBlock = css.match(/\.primaryAction\s*\{[^}]*\}/)?.[0] ?? '';
    const secondaryActionBlock = css.match(/\.secondaryAction\s*\{[^}]*\}/)?.[0] ?? '';

    expect(actionBlock).toContain('min-height: 44px');
    expect(primaryActionBlock).toContain('background: var(--black)');
    expect(primaryActionBlock).toContain('color: var(--color-white)');
    expect(secondaryActionBlock).toContain('background: var(--color-bg-primary)');
    expect(secondaryActionBlock).toContain('color: var(--black)');
    expect(secondaryActionBlock).toContain('border: 1px solid var(--black)');
  });

  test('renders an empty href action as a link instead of a callback button', () => {
    render(
      <AsyncStatePanel
        kind="permission"
        title="로그인이 필요합니다."
        primaryAction={{ label: '로그인하고 계속하기', href: '' }}
      />,
    );

    const action = screen.getByText('로그인하고 계속하기');
    expect(action.tagName).toBe('A');
    expect(action).toHaveAttribute('href', '');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('does not nest interactive controls for link actions', () => {
    render(
      <AsyncStatePanel
        kind="permission"
        title="로그인이 필요합니다."
        primaryAction={{ label: '로그인하고 계속하기', href: '/auth/login' }}
      />,
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '로그인하고 계속하기' }))
      .not.toContainElement(screen.queryByRole('button'));
  });

  test('does not render an action area when no action is provided', () => {
    const { container } = render(
      <AsyncStatePanel kind="empty" title="조건에 맞는 상품이 없습니다." />,
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(container.querySelector('.actions')).not.toBeInTheDocument();
  });
});
