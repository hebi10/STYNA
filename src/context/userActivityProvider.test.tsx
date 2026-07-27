import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UserActivityProvider, useUserActivity } from './userActivityProvider';
import { useAuth } from './authProvider';
import { HybridUserActivityService } from '@/shared/services/hybridUserActivityService';
import type { RecentProduct, WishlistItem } from '@/shared/types/userActivity';

jest.mock('./authProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/shared/services/hybridUserActivityService', () => ({
  HybridUserActivityService: {
    getRecentProducts: jest.fn(),
    getWishlist: jest.fn(),
    clearRecentProducts: jest.fn(),
    clearWishlist: jest.fn(),
    clearAllUserData: jest.fn(),
    addRecentProduct: jest.fn(),
    addToWishlist: jest.fn(),
    removeFromWishlist: jest.fn(),
    isInWishlist: jest.fn(),
  },
}));

const recent = (userId: string, productId: string): RecentProduct => ({
  id: `${userId}-${productId}`,
  userId,
  productId,
  viewedAt: new Date('2026-07-21T00:00:00.000Z'),
});

const wishlist = (userId: string, productId: string): WishlistItem => ({
  id: `${userId}-${productId}`,
  userId,
  productId,
  addedAt: new Date('2026-07-21T00:00:00.000Z'),
});

function Probe() {
  const {
    recentProducts,
    wishlistItems,
    clearAllRecentProducts,
    clearAllWishlistItems,
  } = useUserActivity();

  return (
    <div>
      <output data-testid="recent">{recentProducts.map((item) => item.productId).join(',')}</output>
      <output data-testid="wishlist">{wishlistItems.map((item) => item.productId).join(',')}</output>
      <button type="button" onClick={() => void clearAllRecentProducts()}>최근 삭제</button>
      <button type="button" onClick={() => void clearAllWishlistItems()}>찜 삭제</button>
    </div>
  );
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('UserActivityProvider account boundaries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.mocked(HybridUserActivityService.getRecentProducts).mockResolvedValue([]);
    jest.mocked(HybridUserActivityService.getWishlist).mockResolvedValue([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('ignores late responses from the previous account', async () => {
    const oldRecent = createDeferred<RecentProduct[]>();
    const oldWishlist = createDeferred<WishlistItem[]>();
    let currentUserId = 'user-a';

    jest.mocked(useAuth).mockImplementation(() => ({
      user: { uid: currentUserId },
    } as never));
    jest.mocked(HybridUserActivityService.getRecentProducts).mockImplementation((userId) => (
      userId === 'user-a'
        ? oldRecent.promise
        : Promise.resolve([recent('user-b', 'recent-b')])
    ));
    jest.mocked(HybridUserActivityService.getWishlist).mockImplementation((userId) => (
      userId === 'user-a'
        ? oldWishlist.promise
        : Promise.resolve([wishlist('user-b', 'wishlist-b')])
    ));

    const { rerender } = render(<UserActivityProvider><Probe /></UserActivityProvider>);
    await waitFor(() => expect(HybridUserActivityService.getWishlist).toHaveBeenCalledWith('user-a'));

    currentUserId = 'user-b';
    rerender(<UserActivityProvider><Probe /></UserActivityProvider>);

    await waitFor(() => expect(screen.getByTestId('recent')).toHaveTextContent('recent-b'));
    expect(screen.getByTestId('wishlist')).toHaveTextContent('wishlist-b');

    await act(async () => {
      oldRecent.resolve([recent('user-a', 'recent-a')]);
      oldWishlist.resolve([wishlist('user-a', 'wishlist-a')]);
      await Promise.all([oldRecent.promise, oldWishlist.promise]);
    });

    expect(screen.getByTestId('recent')).toHaveTextContent('recent-b');
    expect(screen.getByTestId('recent')).not.toHaveTextContent('recent-a');
    expect(screen.getByTestId('wishlist')).toHaveTextContent('wishlist-b');
    expect(screen.getByTestId('wishlist')).not.toHaveTextContent('wishlist-a');
  });

  test('clears recent products without deleting wishlist data', async () => {
    jest.mocked(useAuth).mockReturnValue({ user: { uid: 'user-a' } } as never);
    jest.mocked(HybridUserActivityService.getRecentProducts)
      .mockResolvedValue([recent('user-a', 'recent-a')]);
    jest.mocked(HybridUserActivityService.getWishlist)
      .mockResolvedValue([wishlist('user-a', 'wishlist-a')]);

    render(<UserActivityProvider><Probe /></UserActivityProvider>);
    await waitFor(() => expect(screen.getByTestId('wishlist')).toHaveTextContent('wishlist-a'));

    fireEvent.click(screen.getByRole('button', { name: '최근 삭제' }));

    await waitFor(() => expect(HybridUserActivityService.clearRecentProducts).toHaveBeenCalledWith('user-a'));
    expect(HybridUserActivityService.clearWishlist).not.toHaveBeenCalled();
    expect(HybridUserActivityService.clearAllUserData).not.toHaveBeenCalled();
    expect(screen.getByTestId('recent')).toHaveTextContent('');
    expect(screen.getByTestId('wishlist')).toHaveTextContent('wishlist-a');
  });
});
