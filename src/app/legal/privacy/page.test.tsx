import { render, screen } from '@testing-library/react';
import { buildDemoDataNotice } from '@/shared/constants/commercePolicy';
import PrivacyPage from './page';

jest.mock('../terms/page.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, property) => String(property),
  }),
}));

describe('PrivacyPage demo notice', () => {
  test('states that payment is not real and data may persist in Firebase', () => {
    render(<PrivacyPage />);

    expect(screen.getByText(buildDemoDataNotice())).toBeInTheDocument();
  });
});
