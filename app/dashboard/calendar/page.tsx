import CalendarView from '@/components/CalendarView';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Calendar' };

export default function CalendarPage() {
  return <CalendarView />;
}
