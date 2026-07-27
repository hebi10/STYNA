import React from 'react';
import { render, screen } from '@testing-library/react';
import EditEventPage from './page';

jest.mock('./EditEventLoader', () => ({
  __esModule: true,
  default: ({ eventId }: { eventId: string }) => (
    <div data-testid="event-loader">{eventId}</div>
  ),
}));

describe('EditEventPage', () => {
  test('passes the route id to the authenticated client loader', async () => {
    const element = await EditEventPage({
      params: Promise.resolve({ eventId: 'event-1' }),
    });

    render(element);

    expect(screen.getByTestId('event-loader')).toHaveTextContent('event-1');
  });
});
