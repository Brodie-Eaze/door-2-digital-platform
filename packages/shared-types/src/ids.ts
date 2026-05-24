/**
 * Branded ID types. Compile-time prevents mixing OrgId with KnockId at
 * function boundaries even though both are strings at runtime.
 *
 * Use:
 *   function fetchOrg(id: OrgId) { ... }
 *   fetchOrg(asOrgId(rawString))   // OK
 *   fetchOrg(rawString)            // type error
 */

export type Brand<T, B extends string> = T & { readonly __brand: B };

export type OrgId = Brand<string, 'OrgId'>;
export type UserId = Brand<string, 'UserId'>;
export type TerritoryId = Brand<string, 'TerritoryId'>;
export type AddressId = Brand<string, 'AddressId'>;
export type KnockSessionId = Brand<string, 'KnockSessionId'>;
export type KnockId = Brand<string, 'KnockId'>;
export type LeadId = Brand<string, 'LeadId'>;
export type LeadActivityId = Brand<string, 'LeadActivityId'>;
export type ConversionId = Brand<string, 'ConversionId'>;
export type DonationId = Brand<string, 'DonationId'>;
export type SaleId = Brand<string, 'SaleId'>;
export type CommissionPlanId = Brand<string, 'CommissionPlanId'>;
export type CommissionId = Brand<string, 'CommissionId'>;
export type PayoutBatchId = Brand<string, 'PayoutBatchId'>;
export type CampaignId = Brand<string, 'CampaignId'>;
export type AdCampaignId = Brand<string, 'AdCampaignId'>;
export type CreativeId = Brand<string, 'CreativeId'>;
export type AdAccountId = Brand<string, 'AdAccountId'>;
export type ApiKeyId = Brand<string, 'ApiKeyId'>;
export type WebhookEndpointId = Brand<string, 'WebhookEndpointId'>;
export type WebhookDeliveryId = Brand<string, 'WebhookDeliveryId'>;
export type AuditEventId = Brand<string, 'AuditEventId'>;
export type PaidSolicitorRegistrationId = Brand<string, 'PaidSolicitorRegistrationId'>;
export type BrandKitId = Brand<string, 'BrandKitId'>;
export type SsoConfigurationId = Brand<string, 'SsoConfigurationId'>;
export type IdempotencyKey = Brand<string, 'IdempotencyKey'>;

// Cast helpers — use these at trust boundaries (API ingress, DB egress).
// Runtime validation belongs in Zod schemas, not these casts.
export const asOrgId = (s: string): OrgId => s as OrgId;
export const asUserId = (s: string): UserId => s as UserId;
export const asTerritoryId = (s: string): TerritoryId => s as TerritoryId;
export const asKnockId = (s: string): KnockId => s as KnockId;
export const asLeadId = (s: string): LeadId => s as LeadId;
export const asConversionId = (s: string): ConversionId => s as ConversionId;
export const asDonationId = (s: string): DonationId => s as DonationId;
export const asSaleId = (s: string): SaleId => s as SaleId;
export const asCommissionId = (s: string): CommissionId => s as CommissionId;
export const asPayoutBatchId = (s: string): PayoutBatchId => s as PayoutBatchId;
export const asCampaignId = (s: string): CampaignId => s as CampaignId;
export const asAdCampaignId = (s: string): AdCampaignId => s as AdCampaignId;
export const asCreativeId = (s: string): CreativeId => s as CreativeId;
export const asApiKeyId = (s: string): ApiKeyId => s as ApiKeyId;
export const asAuditEventId = (s: string): AuditEventId => s as AuditEventId;
export const asIdempotencyKey = (s: string): IdempotencyKey => s as IdempotencyKey;
