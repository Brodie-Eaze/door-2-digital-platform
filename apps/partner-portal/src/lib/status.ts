/**
 * Local status → tone mapping.
 *
 * `STATUS_TONE` / `humaniseStatus` live inside ui-web's StatusPill module but
 * are not re-exported from the package index, so the portal owns its own thin
 * mapping for the two enums it renders (invoice + solicitor registration).
 */

import type { Tone } from '@d2d/ui-web';
import type { InvoiceStatus, SolicitorStatus } from './portal-data';

export function invoiceTone(status: InvoiceStatus): Tone {
  switch (status) {
    case 'paid':
      return 'success';
    case 'open':
      return 'info';
    case 'overdue':
      return 'danger';
  }
}

export function invoiceLabel(status: InvoiceStatus): string {
  switch (status) {
    case 'paid':
      return 'Paid';
    case 'open':
      return 'Open';
    case 'overdue':
      return 'Overdue';
  }
}

export function solicitorTone(status: SolicitorStatus): Tone {
  switch (status) {
    case 'approved':
      return 'success';
    case 'submitted':
      return 'info';
    case 'pending':
      return 'warn';
    case 'expired':
      return 'danger';
  }
}

export function solicitorLabel(status: SolicitorStatus): string {
  switch (status) {
    case 'approved':
      return 'Approved';
    case 'submitted':
      return 'Submitted';
    case 'pending':
      return 'In prep';
    case 'expired':
      return 'Expired';
  }
}
