import { SecurityDocViewer } from '@/components/SecurityDocViewer';

export const metadata = {
  title: 'ADR-0016 · Region pinning — Door 2 Digital',
  description: 'Multi-region data residency — pinned at org creation, immutable.',
};

export default function RegionPinningPage(): Promise<JSX.Element> {
  return SecurityDocViewer({ slug: 'region-pinning' });
}
