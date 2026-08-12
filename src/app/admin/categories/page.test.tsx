import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import AdminCategoriesPage from './page';
import { getDocs } from 'firebase/firestore';

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  getDocs: jest.fn(),
  doc: jest.fn(),
  updateDoc: jest.fn(),
  addDoc: jest.fn(),
  deleteDoc: jest.fn(),
}));

jest.mock('@/shared/libs/firebase/firebase', () => ({ db: {} }));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => createElement('img', { ...props, alt: props.alt ?? '' }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>) => (
    <a {...props}>{children}</a>
  ),
}));

jest.mock('./page.module.css', () => new Proxy({}, {
  get: (_target, property) => String(property),
}));

describe('AdminCategoriesPage icons', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getDocs).mockResolvedValue({
      docs: [{
        id: 'clothing',
        data: () => ({
          name: '의류',
          description: '의류 카테고리',
          order: 1,
          isActive: true,
          icon: 'https://firebasestorage.googleapis.com/v0/b/hebimall/o/categories%2Fadmin-icon-clothing.webp?alt=media',
          color: '#007bff',
        }),
      }],
    } as never);
  });

  test('renders a category image when the icon field contains an image URL', async () => {
    const { container } = render(<AdminCategoriesPage />);

    await screen.findByText('의류');
    const image = container.querySelector('img');

    expect(image).toHaveAttribute(
      'src',
      'https://firebasestorage.googleapis.com/v0/b/hebimall/o/categories%2Fadmin-icon-clothing.webp?alt=media',
    );
  });
});
