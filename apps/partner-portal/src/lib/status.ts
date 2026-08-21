/**
 * Local status → tone mapping.
 *
 * `STATUS_TONE` / `humaniseStatus` live inside ui-web's StatusPill module but
 * are not re-exported from the package index, so the portal owns its own thin
 * mapping for the enums it renders (billing invoice, payout batch, and
 * compliance state-clearance status — all sourced from the live API).
 */

import type { Tone } from '@d2d/ui-web';
import type { StateClearanceStatus } from './api';

/** Billing invoice status — apps/api/src/domains/billing/schemas.ts */
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'void';

export function invoiceTone(status: string): Tone {
  switch (status as InvoiceStatus) {
    case 'paid':
      return 'success';
    case 'sent':
      return 'info';
    case 'void':
      return 'muted';
    case 'draft':
    default:
      return 'warn';
  }
}

export function invoiceLabel(status: string): string {
  switch (status as InvoiceStatus) {
    case 'paid':
      return 'Paid';
    case 'sent':
      return 'Sent';
    case 'void':
      return 'Void';
    case 'draft':
      return 'Draft';
    default:
      return status;
  }
}

/** Payout batch status — apps/api/src/domains/payout/service.ts */
export type PayoutBatchStatus = 'draft' | 'ready_to_pay' | 'instructed' | 'acknowledged';

export function payoutTone(status: string): Tone {
  switch (status as PayoutBatchStatus) {
    case 'acknowledged':
      return 'success';
    case 'instructed':
      return 'info';
    case 'ready_to_pay':
      return 'warn';
    case 'draft':
    default:
      return 'muted';
  }
}

export function payoutLabel(status: string): string {
  switch (status as PayoutBatchStatus) {
    case 'acknowledged':
      return 'Acknowledged';
    case 'instructed':
      return 'Instructed';
    case 'ready_to_pay':
      return 'Ready to pay';
    case 'draft':
      return 'Draft';
    default:
      return status;
  }
}

/** Compliance state-clearance status — apps/api/src/domains/compliance/service.ts */
export function clearanceTone(status: StateClearanceStatus): Tone {
  switch (status) {
    case 'cleared':
      return 'success';
    case 'pending_registration':
      return 'warn';
    case 'expired':
      return 'danger';
  }
}

export function clearanceLabel(status: StateClearanceStatus): string {
  switch (status) {
    case 'cleared':
      return 'Cleared';
    case 'pending_registration':
      return 'Pending registration';
    case 'expired':
      return 'Expired';
  }
}
