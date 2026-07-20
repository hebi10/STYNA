import { render, screen, waitFor } from '@testing-library/react';
import OfflinePage from './page';
import { SiteContentService } from '@/shared/services/siteContentService';

jest.mock('@/shared/services/siteContentService', () => ({
  SiteContentService: {
    getOfflineStores: jest.fn(),
    getOfflineServices: jest.fn(),
    getOfflineInfo: jest.fn(),
  },
}));

jest.mock('./page.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, { get: (_target, property) => String(property) }),
}));

test('labels sample stores and does not render unavailable actions', async () => {
  jest.mocked(SiteContentService.getOfflineStores).mockResolvedValue([{
    id: 'sample-store',
    name: 'STYNA SAMPLE',
    type: '가상 매장',
    address: '예시 주소',
    phone: '예시 연락처',
    hours: '예시 운영시간',
    transport: '예시 교통편',
    features: [],
    order: 1,
  }]);
  jest.mocked(SiteContentService.getOfflineServices).mockResolvedValue([]);
  jest.mocked(SiteContentService.getOfflineInfo).mockResolvedValue(null);

  render(<OfflinePage />);

  await waitFor(() => expect(screen.getByText('STYNA SAMPLE')).toBeInTheDocument());
  expect(screen.getByText(/포트폴리오 데모용 가상 매장/)).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: '상세보기' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '길찾기' })).not.toBeInTheDocument();
});
