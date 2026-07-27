import { render, screen } from '@testing-library/react';
import RootProviders from './RootProviders';

const mountedProviders: string[] = [];

function providerMock(name: string) {
  return function MockProvider({ children }: { children: React.ReactNode }) {
    mountedProviders.push(name);
    return <>{children}</>;
  };
}

jest.mock('./ReactQueryProvider', () => ({
  __esModule: true,
  default: providerMock('query'),
}));

jest.mock('@/context/authProvider', () => ({
  AuthProvider: providerMock('auth'),
}));

jest.mock('@/context/productProvider', () => ({
  ProductProvider: providerMock('product'),
}));

jest.mock('@/context/categoryProvider', () => ({
  CategoryProvider: providerMock('category'),
}));

jest.mock('@/context/reviewProvider', () => ({
  ReviewProvider: providerMock('review'),
}));

jest.mock('@/context/userActivityProvider', () => ({
  UserActivityProvider: providerMock('activity'),
}));

jest.mock('@/context/couponProvider', () => ({
  CouponProvider: providerMock('coupon'),
}));

jest.mock('@/context/eventProvider', () => ({
  EventProvider: providerMock('event'),
}));

jest.mock('../ScrollToTop', () => ({
  ScrollToTop: () => null,
}));

describe('RootProviders', () => {
  beforeEach(() => {
    mountedProviders.length = 0;
  });

  test('mounts only infrastructure providers that every route needs', () => {
    render(
      <RootProviders>
        <div>content</div>
      </RootProviders>,
    );

    expect(screen.getByText('content')).toBeInTheDocument();
    expect(mountedProviders).toEqual(['query', 'auth']);
  });
});
