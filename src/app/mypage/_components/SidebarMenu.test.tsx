import { render, screen } from '@testing-library/react';
import SidebarMenu from './SidebarMenu';

jest.mock('../layout.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, property) => String(property),
  }),
}));

describe('SidebarMenu', () => {
  test('highlights the shopping overview on the mypage root', () => {
    render(<SidebarMenu activeTab="overview" logout={jest.fn()} />);

    expect(screen.getByRole('link', { name: '나의 쇼핑 현황' })).toHaveClass('active');
    expect(screen.getByRole('link', { name: '주문내역' })).not.toHaveClass('active');
  });
});
