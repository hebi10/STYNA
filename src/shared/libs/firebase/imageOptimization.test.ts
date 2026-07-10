import {
  IMAGE_OPTIMIZATION,
  getImageUploadMetadata,
  getOptimizedImageDimensions,
  getOptimizedWebpFileName,
  getOptimizedWebpStorageFileName,
} from './imageOptimization';

describe('imageOptimization', () => {
  test('uses WebP quality 75 for product upload optimization', () => {
    expect(IMAGE_OPTIMIZATION.outputMimeType).toBe('image/webp');
    expect(IMAGE_OPTIMIZATION.quality).toBe(0.75);
  });

  test('normalizes uploaded image names to .webp', () => {
    expect(getOptimizedWebpFileName('photo.JPG')).toBe('photo.webp');
    expect(getOptimizedWebpFileName('look.book.png')).toBe('look.book.webp');
    expect(getOptimizedWebpFileName('image')).toBe('image.webp');
  });

  test('builds q75 WebP storage names', () => {
    expect(getOptimizedWebpStorageFileName('photo.JPG')).toBe('photo_q75.webp');
    expect(getOptimizedWebpStorageFileName('look.book.png', '177849')).toBe('177849_look.book_q75.webp');
  });

  test('limits upload dimensions while preserving the original aspect ratio', () => {
    expect(getOptimizedImageDimensions(2000, 1000)).toEqual({ width: 1600, height: 800 });
    expect(getOptimizedImageDimensions(1254, 1254)).toEqual({ width: 1254, height: 1254 });
  });

  test('marks versioned optimized uploads as immutable browser-cacheable images', () => {
    expect(getImageUploadMetadata('image/webp')).toEqual({
      contentType: 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable',
    });
  });
});
