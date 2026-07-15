import React from 'react';
import { render, screen } from '@testing-library/react';
import EventResponsiveImage from './EventResponsiveImage';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => {
    const { alt, ...imageProps } = props;
    delete imageProps.priority;

    return React.createElement('img', { alt, ...imageProps });
  },
}));

describe('EventResponsiveImage', () => {
  test('uses the mobile source at 640px and the desktop image otherwise', () => {
    render(
      <EventResponsiveImage
        desktopSrc="/wide.webp"
        mobileSrc="/card.webp"
        alt="미드이어 세일"
        width={1600}
        height={820}
      />
    );

    expect(document.querySelector('source')).toHaveAttribute('media', '(max-width: 640px)');
    expect(document.querySelector('source')).toHaveAttribute('srcset', '/card.webp');
    expect(screen.getByAltText('미드이어 세일')).toHaveAttribute('src', '/wide.webp');
  });
});
