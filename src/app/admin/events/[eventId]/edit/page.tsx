import EditEventLoader from './EditEventLoader';

interface Props {
  params: Promise<{
    eventId: string;
  }>;
}

export default async function EditEventPage({ params }: Props) {
  const { eventId } = await params;
  return <EditEventLoader eventId={eventId} />;
}
