import { OPEN_SITE_GUIDE_EVENT, openSiteGuide } from './siteGuide';

describe('openSiteGuide', () => {
  test('dispatches the shared open-site-guide event exactly once', () => {
    const listener = jest.fn();
    window.addEventListener(OPEN_SITE_GUIDE_EVENT, listener);

    openSiteGuide();

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(OPEN_SITE_GUIDE_EVENT, listener);
  });
});
