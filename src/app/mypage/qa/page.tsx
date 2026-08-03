import { redirect } from 'next/navigation';

export default function QAPage() {
  redirect('/cs/inquiry?tab=list');
}
