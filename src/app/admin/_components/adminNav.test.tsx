import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import AdminNav from './adminNav';

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}));

jest.mock('./adminNav.module.css', () => new Proxy({}, {
  get: (_target, property) => String(property),
}));

describe('AdminNav', () => {
  test('exposes the 1:1 inquiry management route', () => {
    jest.mocked(usePathname).mockReturnValue('/admin/inquiries');

    render(<AdminNav />);

    expect(screen.getByRole('link', { name: '1:1 문의 관리' }))
      .toHaveAttribute('href', '/admin/inquiries');
    expect(screen.getByRole('link', { name: '1:1 문의 관리' }))
      .toHaveAttribute('aria-current', 'page');
  });
});
