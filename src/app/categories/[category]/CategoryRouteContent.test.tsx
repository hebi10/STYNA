import { render, screen } from '@testing-library/react';
import CategoryRouteContent from './CategoryRouteContent';
import { useCategories } from '@/context/categoryProvider';

jest.mock('@/context/categoryProvider', () => ({
  useCategories: jest.fn(),
}));

jest.mock('@/app/_components/PageHeader', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

jest.mock('@/app/products/_components/ProductList', () => ({
  __esModule: true,
  default: ({ initialCategory, lockCategory }: { initialCategory: string; lockCategory: boolean }) => (
    <div data-testid="product-list" data-category={initialCategory} data-locked={String(lockCategory)} />
  ),
}));

describe('CategoryRouteContent', () => {
  test('renders the active bags category supplied by the public category provider', () => {
    jest.mocked(useCategories).mockReturnValue({
      categories: [{
        id: 'bags',
        name: '가방',
        description: '실용성과 스타일을 겸비한 가방 컬렉션',
        order: 3,
        isActive: true,
        icon: '',
        color: '#000000',
        createdAt: new Date(),
        updatedAt: new Date(),
      }],
      loading: false,
      error: null,
      refreshCategories: jest.fn(),
    });

    render(<CategoryRouteContent categoryId="bags" />);

    expect(screen.getByRole('heading', { level: 1, name: '가방' })).toBeInTheDocument();
    expect(screen.getByTestId('product-list')).toHaveAttribute('data-category', 'bags');
    expect(screen.getByTestId('product-list')).toHaveAttribute('data-locked', 'true');
  });
});
