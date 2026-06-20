/**
 * @d2d/integrations — provider-adapter plug-in system for the AI Marketing
 * Studio. Every external creative-gen or ad-delivery vendor lives behind a
 * `ProviderAdapter`, dispatched via `IntegrationRegistry`.
 *
 * Adding a new provider is three steps:
 *   1. Add the kind string to `ProviderKind` in `types.ts`.
 *   2. Drop a new file in `adapters/<kind>.ts` exporting `create<X>Adapter()`.
 *   3. Register it in `buildDefaultRegistry()` in `registry.ts`.
 *
 * The route layer (`apps/api/src/domains/marketing/*`) is provider-agnostic.
 */

export * from './types';
export * from './errors';
export * from './registry';
export { createCrmZapierAdapter } from './adapters/crm-zapier';
export { createCrmHubSpotAdapter } from './adapters/crm-hubspot';
export { createCrmSalesforceAdapter } from './adapters/crm-salesforce';
