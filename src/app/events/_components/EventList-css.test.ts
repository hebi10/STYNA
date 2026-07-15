import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

describe('EventList responsive gallery CSS', () => {
  const css = fs.readFileSync(path.join(__dirname, 'EventList.module.css'), 'utf8');

  test('uses a four-column desktop grid and preserves the full 4:5 card image', () => {
    expect(css).toMatch(
      /\.eventGrid\s*{[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/
    );
    expect(css).toMatch(/\.posterCardMedia\s*{[\s\S]*?aspect-ratio:\s*4 \/ 5/);
    expect(css).toMatch(/\.posterCardImage\s*{[\s\S]*?object-fit:\s*contain/);
  });

  test('uses two columns on tablet and one column on mobile', () => {
    expect(css).toMatch(
      /@media \(max-width: 900px\)[\s\S]*?\.eventGrid\s*{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/
    );
    expect(css).toMatch(
      /@media \(max-width: 640px\)[\s\S]*?\.eventGrid\s*{[\s\S]*?grid-template-columns:\s*1fr/
    );
  });

  test('keeps the event hub image at 27:9 on every viewport', () => {
    expect(css).toMatch(/\.posterHero\s*{[\s\S]*?aspect-ratio:\s*27 \/ 9/);
    expect(css).not.toMatch(
      /@media \(max-width: 640px\)[\s\S]*?\.posterHero\s*{[\s\S]*?aspect-ratio:\s*4 \/ 5/
    );
  });

  test('ships a 2700 by 900 event hub asset', async () => {
    const metadata = await sharp(
      path.join(process.cwd(), 'public/events/event-hub-hero.webp')
    ).metadata();

    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(2700);
    expect(metadata.height).toBe(900);
  });
});
