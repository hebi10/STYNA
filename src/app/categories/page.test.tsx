import { render, screen } from '@testing-library/react';
import CategoriesPage from './page';

jest.mock('@/context/categoryProvider', () => ({
  CategoryProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useCategories: jest.fn(),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => {
    const imageProps = { ...props };
    delete imageProps.fill;

    // eslint-disable-next-line @next/next/no-img-element
    return <img alt="" {...imageProps} />;
  },
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

jest.mock('./page.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, { get: (_target, key) => String(key) }),
}));

import { useCategories } from '@/context/categoryProvider';

describe('CategoriesPage', () => {
  test('renders a category image URL as an image instead of visible URL text', () => {
    jest.mocked(useCategories).mockReturnValue({
      categories: [{
        id: 'tops',
        name: '상의',
        description: '상의 상품',
        icon: 'https://firebasestorage.googleapis.com/v0/b/hebimall/o/categories%2Ftops.webp?alt=media',
        color: '#000000',
        order: 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }],
      loading: false,
      error: null,
      refreshCategories: jest.fn(),
    });

    const { container } = render(<CategoriesPage />);

    expect(screen.getByRole('link', { name: /상의/ })).toHaveAttribute('href', '/categories/clothing');
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'https://firebasestorage.googleapis.com/v0/b/hebimall/o/categories%2Ftops.webp?alt=media',
    );
    expect(screen.queryByText(/firebasestorage\.googleapis\.com/)).not.toBeInTheDocument();
  });
});
