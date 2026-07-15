import Image from 'next/image';

interface EventResponsiveImageProps {
  desktopSrc: string;
  mobileSrc: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
}

export default function EventResponsiveImage({
  desktopSrc,
  mobileSrc,
  alt,
  width,
  height,
  className,
  priority,
}: EventResponsiveImageProps) {
  return (
    <picture>
      <source media="(max-width: 640px)" srcSet={mobileSrc} />
      <Image
        src={desktopSrc}
        alt={alt}
        width={width}
        height={height}
        className={className}
        priority={priority}
      />
    </picture>
  );
}
