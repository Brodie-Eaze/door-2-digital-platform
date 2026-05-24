/**
 * ULID — lexicographically sortable, monotonically increasing IDs.
 *
 * Preferred over UUIDv4 for D2D primary keys: 26 chars, base32, sort
 * by creation time, no central registry.
 *
 * Use via `newId('lead')` → `lead_01HXJZP1...` for human-grokkable IDs
 * in logs and admin UIs.
 */
import { ulid } from 'ulid';

export function newId(prefix?: string): string {
  const id = ulid();
  return prefix ? `${prefix}_${id}` : id;
}

export function newOrgId(): string {
  return newId('org');
}
export function newUserId(): string {
  return newId('usr');
}
export function newLeadId(): string {
  return newId('lead');
}
export function newKnockId(): string {
  return newId('knk');
}
export function newConversionId(): string {
  return newId('cnv');
}
export function newDonationId(): string {
  return newId('don');
}
export function newSaleId(): string {
  return newId('sal');
}
export function newCommissionId(): string {
  return newId('com');
}
export function newPayoutBatchId(): string {
  return newId('pay');
}
export function newAuditEventId(): string {
  return newId('aud');
}
export function newApiKeyId(): string {
  return newId('key');
}
export function newWebhookId(): string {
  return newId('whk');
}
export function newCampaignId(): string {
  return newId('cmp');
}
export function newCreativeId(): string {
  return newId('crv');
}
