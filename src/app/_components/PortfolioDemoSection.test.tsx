import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
  test('presents the portfolio as a shopping showcase and opens the shopping guide', () => {
    const listener = jest.fn();
    window.addEventListener(OPEN_SITE_GUIDE_EVENT, listener);

    const { container } = render(<PortfolioDemoSection />);

    expect(container.querySelectorAll('section')).toHaveLength(1);
    expect(screen.getByText('PORTFOLIO PROJECT')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '쇼핑 경험과 운영 흐름을 함께 담은 커머스 데모' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '쇼핑 경험' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '운영 기능' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '데모 안내' })).toBeInTheDocument();
    const capabilityList = screen.getByRole('list', { name: '구현 범위' });
    expect(within(capabilityList).getAllByRole('listitem')).toHaveLength(3);
    expect(container.querySelectorAll('article')).toHaveLength(0);
    expect(screen.getByText(SITE_INFO.demoNotice)).toBeInTheDocument();
    expect(screen.getByText(buildDemoDataNotice())).toBeInTheDocument();
    expect(screen.getByText(formatSignupBenefit())).toBeInTheDocument();
    expect(screen.getByText(
      '상품 탐색부터 장바구니와 주문 완료까지 전체 흐름을 확인할 수 있습니다.',
    )).toBeInTheDocument();
    expect(screen.getByText(
      '관리자 화면에서 상품, 주문, 이벤트, 쿠폰의 운영 구조를 살펴볼 수 있습니다.',
    )).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '프로젝트 둘러보기' }));

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(OPEN_SITE_GUIDE_EVENT, listener);
  });

  test('uses the existing global color tokens without adding shadows or radii', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/app/_components/PortfolioDemoSection.module.css'),
      'utf8',
    );

    expect(css).toContain('var(--surface-raised)');
    expect(css).toContain('var(--text)');
    expect(css).toContain('var(--black)');
    expect(css).toContain('var(--action)');
    expect(css).toContain('var(--action-hover)');
    expect(css).toContain('var(--off-white)');
    expect(css).toContain('@media (max-width: 768px)');
    expect(css).toContain('grid-template-columns: 1fr');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(css).not.toMatch(/box-shadow|border-radius/);
  });
});
