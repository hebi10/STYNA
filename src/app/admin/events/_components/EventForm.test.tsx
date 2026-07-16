import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EventForm from './EventForm';
import { Event } from '@/shared/types/event';
import { CategoryService } from '@/shared/services/categoryService';
import { EventService } from '@/shared/services/eventService';

jest.mock('./EventForm.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, prop) => String(prop),
  }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => React.createElement('img', props),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
}));

jest.mock('@/app/_components/Button', () => ({
  __esModule: true,
  default: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock('@/app/_components/Input', () => ({
  __esModule: true,
  default: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

jest.mock('@/shared/services/categoryService', () => ({
  CategoryService: {
    getCategories: jest.fn(),
  },
}));

jest.mock('@/shared/services/eventService', () => ({
  EventService: {
    uploadImage: jest.fn(),
    updateEvent: jest.fn(),
    createEvent: jest.fn(),
  },
}));

const baseEvent: Event = {
  id: 'event-1',
  title: '상세 이미지 이벤트',
  description: '설명',
  content: '<p>본문</p>',
  bannerImage: '/banner.webp',
  thumbnailImage: '/thumb.webp',
  detailImage: '/detail.webp',
  editorialImages: {
    benefit: '/benefit.webp',
    styling: '/styling.webp',
    product: '/product.webp',
  },
  eventType: 'sale',
  startDate: new Date('2026-06-01T00:00:00+09:00'),
  endDate: new Date('2026-06-30T23:59:59+09:00'),
  isActive: true,
  participantCount: 0,
  hasMaxParticipants: false,
  createdAt: new Date('2026-06-01T00:00:00+09:00'),
  updatedAt: new Date('2026-06-01T00:00:00+09:00'),
};

describe('EventForm', () => {
  beforeEach(() => {
    jest.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  test('renders an existing detail image for editing', async () => {
    jest.mocked(CategoryService.getCategories).mockResolvedValue([]);

    render(<EventForm event={baseEvent} isEdit />);

    await waitFor(() => {
      expect(screen.getByAltText('상세 이미지')).toHaveAttribute('src', '/detail.webp');
    });
  });

  test('renders existing editorial images with clear admin labels', async () => {
    jest.mocked(CategoryService.getCategories).mockResolvedValue([]);

    render(<EventForm event={baseEvent} isEdit />);

    expect(screen.getByText('혜택 이미지')).toBeInTheDocument();
    expect(screen.getByText('MD 추천 이미지')).toBeInTheDocument();
    expect(screen.getByText('상품 에디토리얼 이미지')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByAltText('혜택 이미지')).toHaveAttribute('src', '/benefit.webp');
      expect(screen.getByAltText('MD 추천 이미지')).toHaveAttribute('src', '/styling.webp');
      expect(screen.getByAltText('상품 에디토리얼 이미지')).toHaveAttribute('src', '/product.webp');
    });
  });

  test('uploads editorial images and includes only provided editorial image urls in the update payload', async () => {
    jest.mocked(CategoryService.getCategories).mockResolvedValue([]);
    jest.mocked(EventService.uploadImage).mockResolvedValue('/benefit-uploaded.webp');
    jest.mocked(EventService.updateEvent).mockResolvedValue();

    const eventWithoutEditorialImages: Event = {
      ...baseEvent,
      editorialImages: undefined,
    };

    const { container } = render(<EventForm event={eventWithoutEditorialImages} isEdit />);
    const benefitFile = new File(['benefit'], 'benefit.png', { type: 'image/png' });

    fireEvent.change(screen.getByLabelText('혜택 이미지 업로드'), {
      target: { files: [benefitFile] },
    });

    await waitFor(() => {
      expect(EventService.uploadImage).toHaveBeenCalledWith(benefitFile, 'events/editorial/benefit');
    });

    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(EventService.updateEvent).toHaveBeenCalledWith(
        'event-1',
        expect.objectContaining({
          bannerImage: '/banner.webp',
          thumbnailImage: '/thumb.webp',
          detailImage: '/detail.webp',
          editorialImages: {
            benefit: '/benefit-uploaded.webp',
          },
        })
      );
    });
  });

  test('does not create an empty editorialImages payload when no editorial image is provided', async () => {
    jest.mocked(CategoryService.getCategories).mockResolvedValue([]);
    jest.mocked(EventService.createEvent).mockResolvedValue('new-event');

    const eventWithoutEditorialImages: Event = {
      ...baseEvent,
      editorialImages: undefined,
    };

    const { container } = render(<EventForm event={eventWithoutEditorialImages} />);

    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(EventService.createEvent).toHaveBeenCalledWith(
        expect.not.objectContaining({
          editorialImages: expect.anything(),
        })
      );
    });
  });
});
