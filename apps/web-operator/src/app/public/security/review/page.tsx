import { SecurityDocViewer } from '@/components/SecurityDocViewer';

export const metadata = {
  title: 'Security review — Door 2 Digital',
  description: 'Honest pen-test-readiness audit of the operator surface.',
};

export default function SecurityReviewPage(): Promise<JSX.Element> {
  return SecurityDocViewer({ slug: 'review' });
}
