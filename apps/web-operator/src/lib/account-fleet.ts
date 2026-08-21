/**
 * Per-account map camera config for the live satellite maps.
 *
 * Pre-W3 this file also held per-account FleetRep/AiZone/AiZoneSuggestion/
 * AnomalyItem/ActivityEvent fixtures. Fleet positions now come from
 * /api/orgs/[slug]/fleet (real KnockSession + Knock.geo — see that route);
 * AI zone suggestions and anomaly detection have no backing table yet (see
 * schema.prisma), so those surfaces render an honest empty state instead of
 * hand-authored copy.
 *
 * center/zoom/scopeLabel stay hand-authored here deliberately — they're map
 * camera placement (where to point the satellite view for each account), not
 * business data, and there's no cheap real-data substitute (Territory
 * centroids only exist once an account has drawn territories, which several
 * demo accounts haven't yet).
 */

export interface AccountMapConfig {
  /** [lat, lng] for initial map center */
  center: [number, number];
  zoom: number;
  /** Display label for the floating "Live · …" badge */
  scopeLabel: string;
}

const ACCOUNT_MAP_CONFIG: Record<string, AccountMapConfig> = {
  'hope-forward': { center: [31.2, -97.0], zoom: 6, scopeLabel: 'Hope Forward · US' },
  'world-vision': { center: [-32.5, 148.0], zoom: 5, scopeLabel: 'World Vision · AU' },
  pestmax: { center: [32.0, -103.0], zoom: 5, scopeLabel: 'PestMax · US' },
  'gold-coast-hospital': {
    center: [-28.02, 153.4],
    zoom: 11,
    scopeLabel: 'Gold Coast Hospital · AU',
  },
};

export function getAccountMapConfig(slug: string): AccountMapConfig | undefined {
  return ACCOUNT_MAP_CONFIG[slug];
}
