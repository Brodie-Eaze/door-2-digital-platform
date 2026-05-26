import { SecurityDocViewer } from '@/components/SecurityDocViewer';

export const metadata = {
  title: 'Pen-test readiness checklist — Door 2 Digital',
  description: '20-item checklist tracked across releases.',
};

export default function PenTestReadinessPage(): Promise<JSX.Element> {
  return SecurityDocViewer({ slug: 'pen-test-readiness' });
}
