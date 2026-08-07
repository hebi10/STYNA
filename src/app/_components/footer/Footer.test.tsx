import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import Footer from './Footer';

jest.mock('./Footer.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, prop) => String(prop),
  }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('Footer', () => {
  test('uses the ink navy closing surface with readable footer colors', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/_components/footer/Footer.module.css'),
      'utf8',
    );

    expect(source).toContain('background-color: #101315;');
    expect(source).toContain('--footer-foreground: #f7f8fa;');
    expect(source).toContain('--footer-muted: #b9c1ca;');
  });

  test('keeps every footer destination on the mobile 44px hit-target class', () => {
    render(<Footer />);
    const links = screen.getAllByRole('link');
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/_components/footer/Footer.module.css'),
      'utf8',
    );

    expect(links).toHaveLength(11);
    links.forEach((link) => expect(link).toHaveClass('link'));
    expect(source).toMatch(
      /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.link\s*\{[^}]*min-height:\s*44px;/,
    );
  });
});
