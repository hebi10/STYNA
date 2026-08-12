import { SITE_INFO } from './siteInfo';

describe('SITE_INFO', () => {
  test('does not expose a mobile-number shaped support phone value', () => {
    expect(SITE_INFO.supportPhone).toBe('전화 상담 미제공');
  });
});
