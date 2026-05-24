/**
 * Themed creative photo picker for the Marketing Studio.
 *
 * Strategy: LoremFlickr keyword endpoints. Each theme maps to a set of
 * Flickr-friendly keywords, and the picker builds a URL like:
 *
 *   https://loremflickr.com/600/600/food,family,meal?lock=<hash(id)>
 *
 * `lock=<n>` makes the result deterministic — same creative id always gets
 * the same photo so HMR + reloads don't reshuffle. Real photos, no curated
 * ID list to keep in sync. CSP allows loremflickr.com + staticflickr.com.
 *
 * When we ship real storage in Phase 1.3 (per ADR-0008), creative URLs come
 * from the org's S3/R2 bucket via signed URL. This file goes away then.
 */

export type CreativeTheme =
  | 'charity_food'
  | 'charity_water'
  | 'charity_children'
  | 'charity_medical'
  | 'charity_disaster'
  | 'charity_environment'
  | 'charity_animals'
  | 'solar'
  | 'pest_control'
  | 'energy_telco'
  | 'healthcare'
  | 'security'
  | 'home_services'
  | 'business_b2b';

/**
 * Flickr-friendly keyword groups per theme. Comma-separated keywords narrow
 * the photo pool — keep them concrete (objects/scenes) not abstract.
 */
const THEME_KEYWORDS: Record<CreativeTheme, string> = {
  charity_food: 'food,family,meal',
  charity_water: 'water,well,village',
  charity_children: 'children,school,classroom',
  charity_medical: 'clinic,nurse,medical',
  charity_disaster: 'disaster,relief,refugee',
  charity_environment: 'forest,ocean,nature',
  charity_animals: 'rescue,dog,puppy',
  solar: 'solar,panel,rooftop',
  pest_control: 'house,suburban,home',
  energy_telco: 'power,electricity,grid',
  healthcare: 'hospital,nurse,doctor',
  security: 'security,camera,doorbell',
  home_services: 'home,garden,lawn',
  business_b2b: 'office,team,meeting',
};

const FALLBACK_THEME: CreativeTheme = 'business_b2b';

/**
 * djb2 hash → stable integer from a string. Used as the `lock` param so the
 * same creative id always renders the same photo.
 */
function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h % 100000; // LoremFlickr accepts any positive int
}

/**
 * Pick a deterministic, theme-relevant image URL for a creative.
 *
 *   pickCreativeImage('charity_food', 'c-001', { w: 600, h: 750 })
 *   → https://loremflickr.com/600/750/food,family,meal?lock=42137
 */
export function pickCreativeImage(
  theme: CreativeTheme,
  id: string,
  opts: { w?: number; h?: number } = {},
): string {
  const keywords = THEME_KEYWORDS[theme] ?? THEME_KEYWORDS[FALLBACK_THEME];
  const lock = djb2(id);
  const w = opts.w ?? 600;
  const h = opts.h ?? 600;
  return `https://loremflickr.com/${w}/${h}/${encodeURIComponent(keywords)}?lock=${lock}`;
}

/**
 * Infer a theme from a creative's vertical + headline when fixture data
 * doesn't carry an explicit `theme` field.
 */
export function inferTheme(input: {
  vertical?: string;
  headline?: string;
  copy?: string;
}): CreativeTheme {
  const text = `${input.headline ?? ''} ${input.copy ?? ''}`.toLowerCase();
  const vertical = (input.vertical ?? '').toLowerCase();

  if (vertical.includes('charity')) {
    if (/\b(feed|hungr|food|meal|families\s*fed|kitchen|hunger)\b/.test(text))
      return 'charity_food';
    if (/\b(water|well|drink|thirst|clean\s*water)\b/.test(text)) return 'charity_water';
    if (/\b(child|kid|sponsor|school|learn|education|classroom|teach)\b/.test(text))
      return 'charity_children';
    if (/\b(clinic|vaccin|medical|nurse|doctor|treatment|health|disease)\b/.test(text))
      return 'charity_medical';
    if (/\b(disaster|refug|relief|crisis|recover|earthquake|flood|hurricane|war)\b/.test(text))
      return 'charity_disaster';
    if (
      /\b(forest|tree|ocean|environment|climate|reef|coral|wildlife|conserv|sustainab|planet)\b/.test(
        text,
      )
    )
      return 'charity_environment';
    if (/\b(dog|cat|puppy|kitten|pet|rescue|shelter|paw|animal|wildlife)\b/.test(text))
      return 'charity_animals';
    return 'charity_children';
  }

  if (/\b(solar|panel|kilowatt|kwh|sun|rooftop\s*solar)\b/.test(text)) return 'solar';
  if (/\b(pest|roach|termite|rodent|spray|exterminat|bug|insect)\b/.test(text))
    return 'pest_control';
  if (/\b(wifi|fibre|fiber|broadband|electric|gas|telco|carrier|network|internet)\b/.test(text))
    return 'energy_telco';
  if (/\b(camera|doorbell|alarm|security|burglar|monitor|locks?)\b/.test(text)) return 'security';
  if (/\b(lawn|garden|paint|clean|maid|handyman|handyperson|tradie|landscaping)\b/.test(text))
    return 'home_services';

  if (vertical.includes('healthcare') || vertical.includes('hospital')) return 'healthcare';

  return 'business_b2b';
}
