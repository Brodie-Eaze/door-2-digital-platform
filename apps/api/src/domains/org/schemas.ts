/**
 * Org-domain Zod schemas — extend the shared-types ones with the
 * Phase 1.1 patch/billing/brand-kit shapes the API uses internally.
 */
import { z } from 'zod';
import { createOrgRequestSchema } from '@d2d/shared-types';

export { createOrgRequestSchema };

/**
 * PATCH /v1/orgs/:id — region locked at create, must not appear here.
 * Mutable fields only.
 */
export const updateOrgRequestSchema = z
  .object({
    legalName: z.string().min(1).max(200).optional(),
    tradingName: z.string().min(1).max(200).optional(),
    abnAcnUen: z.string().optional(),
    brandCode: z.string().min(1).max(40).optional(),
    aiBudgetCents: z.union([z.bigint(), z.string().regex(/^\d+$/)]).optional(),
    aiRetargetingOptOut: z.boolean().optional(),
    ssoProvider: z
      .enum(['okta', 'azuread', 'auth0', 'google_workspace', 'generic_saml'])
      .optional(),
    // Trap field — region pinning is immutable; reject if caller sends it.
    regionCode: z.never().optional(),
  })
  .strict();
export type UpdateOrgRequest = z.infer<typeof updateOrgRequestSchema>;

export const updateBrandKitRequestSchema = z
  .object({
    displayName: z.string().min(1).max(200).optional(),
    logoLightKey: z.string().optional(),
    logoDarkKey: z.string().optional(),
    iconKey: z.string().optional(),
    faviconKey: z.string().optional(),
    primaryColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    accentColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    customDomain: z.string().optional(),
    supportEmail: z.string().email().optional(),
    supportPhone: z.string().optional(),
    privacyPolicyUrl: z.string().url().optional(),
    termsUrl: z.string().url().optional(),
  })
  .strict();
export type UpdateBrandKitRequest = z.infer<typeof updateBrandKitRequestSchema>;

export const updateBillingRequestSchema = z
  .object({
    platformFeeMonthlyCents: z.union([z.bigint(), z.string().regex(/^\d+$/)]).optional(),
    doorRakePercent: z.number().min(0).max(100).optional(),
    insideSalesRakePercent: z.number().min(0).max(100).optional(),
    retargetingRakePercent: z.number().min(0).max(100).optional(),
    billingDay: z.number().int().min(1).max(28).optional(),
    currency: z.string().length(3).optional(),
    micampMerchantId: z.string().optional(),
    stripeCustomerId: z.string().optional(),
  })
  .strict();
export type UpdateBillingRequest = z.infer<typeof updateBillingRequestSchema>;
