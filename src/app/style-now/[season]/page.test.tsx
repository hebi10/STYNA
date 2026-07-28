import { render, screen } from '@testing-library/react';
import { notFound } from 'next/navigation';
import StyleNowPage from './page';

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

jest.mock('@/app/_components/style-now/StyleNowSeasonPage', () => ({
  __esModule: true,
  default: ({ season }: { season: string }) => (
    <div data-testid="style-now-season-page" data-season={season} />
  ),
}));

describe('style-now season route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders the matching season page for a supported route segment', async () => {
    const page = await StyleNowPage({
      params: Promise.resolve({ season: 'summer' }),
    });

    render(page);

    expect(screen.getByTestId('style-now-season-page')).toHaveAttribute(
      'data-season',
      'summer',
    );
    expect(notFound).not.toHaveBeenCalled();
  });

  test('returns not found for an unsupported season route segment', async () => {
    await expect(
      StyleNowPage({
        params: Promise.resolve({ season: 'rainy' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFound).toHaveBeenCalledTimes(1);
  });
});
