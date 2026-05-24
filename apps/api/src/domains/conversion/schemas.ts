/**
 * Conversion-domain Zod schemas — request body for `POST /v1/conversions`
 * and list filters. Re-exports `@d2d/shared-types` shapes so callers don't
 * import both packages.
 */
import { z } from 'zod';
import {
  attributionSourceSchema,
  bigIntCentsSchema,
  conversionTypeSchema,
  cursorPageQuerySchema,
  donationFrequencySchema,
  idSchema,
  paymentProviderSchema,
} from '@d2d/shared-types';

export const conversionDonationDetailsSchema = z
  .object({
    frequency: donationFrequencySchema.optional(), // null = one-off
    firstChargeAt: z.string().datetime().optional(),
    giftAidEligible: z.boolean().optional(),
    deductibleGiftRecipientNo: z.string().max(40).optional(),
    einOrEquivalent: z.string().max(40).optional(),
  })
  .strict();

export const conversionSaleDetailsSchema = z
  .object({
    productSku: z.string().min(1).max(100),
    installerOrgId: idSchema.optional(),
    scheduledInstallAt: z.string().datetime().optional(),
    contractTermMonths: z.number().int().min(0).max(120).optional(),
  })
  .strict();

export const createConversionRequestSchema = z
  .object({
    leadId: idSchema,
    knockId: idSchema.optional(),
    knockerId: idSchema.optional(),
    closerId: idSchema.optional(),
    campaignId: idSchema.optional(),
    retargetingCampaignId: idSchema.optional(),
    type: conversionTypeSchema,
    attributionSource: attributionSourceSchema,
    amountCents: bigIntCentsSchema,
    currency: z.string().length(3),
    signedAt: z.string().datetime().optional(),
    signatureKey: z.string().max(500).optional(),
    paymentProvider: paymentProviderSchema,
    paymentExternalId: z.string().max(120).optional(),
    paymentMethodToken: z.string().max(200).optional(),
    donationDetails: conversionDonationDetailsSchema.optional(),
    saleDetails: conversionSaleDetailsSchema.optional(),
  })
  .strict();
export type CreateConversionRequest = z.infer<typeof createConversionRequestSchema>;

export const listConversionsQuerySchema = cursorPageQuerySchema.extend({
  leadId: idSchema.optional(),
  type: conversionTypeSchema.optional(),
  attributionSource: attributionSourceSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type ListConversionsQuery = z.infer<typeof listConversionsQuerySchema>;
