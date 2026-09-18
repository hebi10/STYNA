import {
  OPEN_SITE_GUIDE_EVENT,
  openSiteGuide,
  type SiteGuideEventDetail,
} from './siteGuide';

describe('openSiteGuide', () => {
  test('dispatches shopping mode by default', () => {
    const listener = jest.fn();
    window.addEventListener(OPEN_SITE_GUIDE_EVENT, listener);

    openSiteGuide();

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0] as CustomEvent<SiteGuideEventDetail>;
    expect(event.detail).toEqual({ mode: 'shopping' });

    window.removeEventListener(OPEN_SITE_GUIDE_EVENT, listener);
  });

  test('dispatches portfolio mode for the project tour entry', () => {
    const listener = jest.fn();
    window.addEventListener(OPEN_SITE_GUIDE_EVENT, listener);

    openSiteGuide('portfolio');

    const event = listener.mock.calls[0][0] as CustomEvent<SiteGuideEventDetail>;
    expect(event.detail).toEqual({ mode: 'portfolio' });

    window.removeEventListener(OPEN_SITE_GUIDE_EVENT, listener);
  });
});
