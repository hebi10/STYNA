import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { SITE_INFO } from '@/shared/constants/siteInfo';
import { buildDemoDataNotice } from '@/shared/constants/commercePolicy';
import {
  OPEN_SITE_GUIDE_EVENT,
  type SiteGuideEventDetail,
} from '@/shared/utils/siteGuide';
import PortfolioDemoSection from './PortfolioDemoSection';

jest.mock('./PortfolioDemoSection.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, property) => String(property),
  }),
}));

describe('PortfolioDemoSection', () => {
  test('presents the portfolio as a clear demo notice and opens the portfolio tour', () => {
    const listener = jest.fn();
    window.addEventListener(OPEN_SITE_GUIDE_EVENT, listener);

    const { container } = render(<PortfolioDemoSection />);

    expect(container.querySelectorAll('section')).toHaveLength(1);
    expect(screen.getByText('PORTFOLIO PROJECT')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '포트폴리오용 데모 사이트입니다' })).toBeInTheDocument();
    expect(screen.getByText(
      '실제 쇼핑몰이 아닌 포트폴리오용 데모입니다. 상품 탐색, 주문, 관리자 기능을 직접 체험할 수 있습니다.',
    )).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '쇼핑 경험' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '운영 기능' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '데모 안내' })).toBeInTheDocument();

    const capabilityList = screen.getByRole('list', { name: '구현 범위' });
    expect(within(capabilityList).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText(SITE_INFO.demoNotice)).toBeInTheDocument();
    expect(screen.getByText(buildDemoDataNotice())).toBeInTheDocument();
    expect(screen.getByText(
      '상품 탐색부터 장바구니, 주문내역까지 전체 쇼핑 흐름을 확인할 수 있습니다.',
    )).toBeInTheDocument();
    expect(screen.getByText(
      '조회 전용 관리자 체험에서 상품, 주문, 이벤트, 쿠폰 운영 구조를 확인할 수 있습니다.',
    )).toBeInTheDocument();
    expect(screen.queryByText('가입 혜택')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '프로젝트 둘러보기' }));

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0] as CustomEvent<SiteGuideEventDetail>;
    expect(event.detail).toEqual({ mode: 'portfolio' });
    window.removeEventListener(OPEN_SITE_GUIDE_EVENT, listener);
  });

  test('keeps restrained typography and responsive layouts for desktop, tablet, and mobile', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/app/_components/PortfolioDemoSection.module.css'),
      'utf8',
    );

    expect(css).toContain('max-width: 1200px');
    expect(css).toContain('font-size: clamp(1.75rem, 2.5vw, 2.4rem)');
    expect(css).toContain('@media (max-width: 768px)');
    expect(css).toContain('@media (max-width: 480px)');
    expect(css).toContain('min-height: 44px');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(css).not.toMatch(/box-shadow|border-radius/);
  });
});
