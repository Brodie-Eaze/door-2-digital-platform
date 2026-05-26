import { SecurityDocViewer } from '@/components/SecurityDocViewer';

export const metadata = {
  title: 'Code audit — Door 2 Digital',
  description: 'Static review of the operator surface.',
};

export default function CodeAuditPage(): Promise<JSX.Element> {
  return SecurityDocViewer({ slug: 'code-audit' });
}
