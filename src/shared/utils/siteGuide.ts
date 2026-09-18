export const OPEN_SITE_GUIDE_EVENT = 'styna:open-site-guide';

export type SiteGuideMode = 'shopping' | 'portfolio';

export interface SiteGuideEventDetail {
  mode: SiteGuideMode;
}

export function openSiteGuide(mode: SiteGuideMode = 'shopping'): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent<SiteGuideEventDetail>(
    OPEN_SITE_GUIDE_EVENT,
    { detail: { mode } },
  ));
}
