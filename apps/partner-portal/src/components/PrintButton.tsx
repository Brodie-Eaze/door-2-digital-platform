'use client';

import { Printer } from 'lucide-react';
import { Button } from '@d2d/ui-web';

interface PrintButtonProps {
  label?: string;
}

/**
 * Print-to-PDF trigger. The invoice route ships a scoped print stylesheet that
 * hides the app chrome (sidebar + topbar) and the screen-only controls, so the
 * browser's native "Save as PDF" produces a clean, single-document invoice.
 * No PDF-generation dependency — the document IS the page.
 */
export function PrintButton({ label = 'Download PDF' }: PrintButtonProps): JSX.Element {
  return (
    <Button
      variant="secondary"
      size="sm"
      leftIcon={<Printer size={14} aria-hidden />}
      onClick={() => window.print()}
    >
      {label}
    </Button>
  );
}
