export const OPEN_SITE_GUIDE_EVENT = 'styna:open-site-guide';

export function openSiteGuide(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(OPEN_SITE_GUIDE_EVENT));
}
