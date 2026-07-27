import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fireEvent, render, screen } from '@testing-library/react';
import { SITE_INFO } from '@/shared/constants/siteInfo';
import {
  buildDemoDataNotice,
  formatSignupBenefit,
} from '@/shared/constants/commercePolicy';
import { OPEN_SITE_GUIDE_EVENT } from '@/shared/utils/siteGuide';
import PortfolioDemoSection from './PortfolioDemoSection';

jest.mock('./PortfolioDemoSection.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, property) => String(property),
  }),
}));

describe('PortfolioDemoSection', () => {
  test('keeps portfolio disclosure in one section and opens the shopping guide', () => {
    const listener = jest.fn();
    window.addEventListener(OPEN_SITE_GUIDE_EVENT, listener);

    const { container } = render(<PortfolioDemoSection />);

    expect(container.querySelectorAll('section')).toHaveLength(1);
    expect(screen.getByText('PORTFOLIO DEMO')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '포트폴리오 데모 안내' })).toBeInTheDocument();
    expect(screen.getByText(SITE_INFO.demoNotice)).toBeInTheDocument();
    expect(screen.getByText(buildDemoDataNotice())).toBeInTheDocument();
    expect(screen.getByText(formatSignupBenefit())).toBeInTheDocument();
    expect(screen.getByText(
      '일반 회원 화면에서는 쇼핑과 주문 흐름을 확인할 수 있으며, 관리자 화면에서는 상품, 이벤트, 쿠폰 관리 화면을 확인할 수 있습니다.',
    )).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '구현 범위 자세히 보기' }));

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(OPEN_SITE_GUIDE_EVENT, listener);
  });

  test('uses the existing global color tokens without adding shadows or radii', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/app/_components/PortfolioDemoSection.module.css'),
      'utf8',
    );

    expect(css).toContain('var(--surface-raised)');
    expect(css).toContain('var(--line)');
    expect(css).toContain('var(--text-subtle)');
    expect(css).toContain('var(--text)');
    expect(css).toContain('var(--black)');
    expect(css).toContain('var(--action)');
    expect(css).toContain('var(--action-hover)');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(css).not.toMatch(/box-shadow|border-radius/);
  });
});
