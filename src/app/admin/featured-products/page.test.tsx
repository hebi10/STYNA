import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FeaturedProductManagePage from './page';
import { FeaturedProductService } from '@/shared/services/featuredProductService';
import { ProductService } from '@/shared/services/productService';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/shared/services/featuredProductService', () => ({
  FeaturedProductService: {
    getFeaturedProductConfig: jest.fn(),
    updateFeaturedProductConfig: jest.fn(),
  },
}));

jest.mock('@/shared/services/productService', () => ({
  ProductService: { getAllProducts: jest.fn() },
}));

jest.mock('./page.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, { get: (_target, key) => String(key) }),
}));

describe('FeaturedProductManagePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(FeaturedProductService.getFeaturedProductConfig).mockResolvedValue({
      id: 'mainPageFeatured',
      productIds: [],
      title: 'STYNA SELECT',
      subtitle: '세 가지 선택',
      description: '한 가지 무드로 이어지는 스타일',
      heroImage: '/style-now/spring/style-now-spring-main.webp',
      maxCount: 3,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    jest.mocked(ProductService.getAllProducts).mockResolvedValue([]);
    jest.mocked(FeaturedProductService.updateFeaturedProductConfig).mockResolvedValue();
  });

  test('saves the configured mood image with the three-product STYNA SELECT limit', async () => {
    render(<FeaturedProductManagePage />);

    const heroImage = await screen.findByLabelText('무드 이미지 경로');
    expect(heroImage).toHaveValue('/style-now/spring/style-now-spring-main.webp');
    expect(screen.getByText('선택된 추천 상품 (0/3)')).toBeInTheDocument();

    fireEvent.change(heroImage, { target: { value: '/style-now/autumn/style-now-autumn-main.webp' } });
    fireEvent.click(screen.getByRole('button', { name: '설정 저장' }));

    await waitFor(() => {
      expect(FeaturedProductService.updateFeaturedProductConfig).toHaveBeenCalledWith(
        [],
        'mainPageFeatured',
        expect.objectContaining({
          heroImage: '/style-now/autumn/style-now-autumn-main.webp',
          maxCount: 3,
        }),
      );
    });
  });
});
