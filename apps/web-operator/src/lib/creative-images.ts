/**
 * Themed creative photo picker for the Marketing Studio.
 *
 * Strategy: hand-curated local photo bank under
 * `apps/web-operator/public/creative-bank/<theme>/<n>.jpg`. Photos were
 * downloaded once from Unsplash search results, visually verified to match
 * their theme, then served same-origin — no third-party reliability, no
 * keyword roulette, no CSP issues, no API key. Each theme has 5 verified
 * photos; the picker rotates by deterministic hash of the creative id.
 *
 * Real creative storage lands in Phase 1.3 (S3/R2 per ADR-0008).
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

/** Photos per theme. Numbers match files in /public/creative-bank/<theme>/<n>.jpg */
const PHOTOS_PER_THEME: Record<CreativeTheme, number> = {
  charity_food: 5,
  charity_water: 5,
  charity_children: 5,
  charity_medical: 5,
  charity_disaster: 5,
  charity_environment: 5,
  charity_animals: 5,
  solar: 5,
  pest_control: 5,
  energy_telco: 5,
  healthcare: 5,
  security: 5,
  home_services: 5,
  business_b2b: 5,
};

const FALLBACK_THEME: CreativeTheme = 'business_b2b';

/**
 * djb2 hash → stable integer from a string. Used to pick which of the N
 * photos for a theme this creative id should display.
 */
function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * Pick a deterministic, theme-relevant image path for a creative.
 *
 *   pickCreativeImage('charity_food', 'c-001')
 *   → /creative-bank/charity_food/3.jpg
 *
 * `opts.w` / `opts.h` are accepted for backward compatibility but ignored —
 * source photos are 900×900 and the browser handles resizing.
 */
export function pickCreativeImage(
  theme: CreativeTheme,
  id: string,
  _opts: { w?: number; h?: number } = {},
): string {
  const t = PHOTOS_PER_THEME[theme] ? theme : FALLBACK_THEME;
  const count = PHOTOS_PER_THEME[t];
  const n = (djb2(id) % count) + 1; // 1-based
  return `/creative-bank/${t}/${n}.jpg`;
}

/**
 * Hint table — if vertical exactly matches a theme name, use it directly
 * rather than running the regex inference.
 */
const VERTICAL_THEMES: Record<string, CreativeTheme> = {
  charity_food: 'charity_food',
  charity_water: 'charity_water',
  charity_children: 'charity_children',
  charity_medical: 'charity_medical',
  charity_disaster: 'charity_disaster',
  charity_environment: 'charity_environment',
  charity_animals: 'charity_animals',
  solar: 'solar',
  pest_control: 'pest_control',
  energy_telco: 'energy_telco',
  healthcare: 'healthcare',
  security: 'security',
  home_services: 'home_services',
  business_b2b: 'business_b2b',
};

/**
 * Infer a theme from a creative's vertical + headline when fixture data
 * doesn't carry an explicit `theme` field.
 *
 * Charity copy without a specific keyword (food/water/medical/disaster/
 * environment/animals) defaults to charity_children — sponsorship / general
 * giving creatives are the safe visual default for "charity" copy.
 */
export function inferTheme(input: {
  vertical?: string;
  headline?: string;
  copy?: string;
  /** Optional extra context — e.g. the account name. Folded into text matching. */
  account?: string;
  /** Optional campaign / segment / asset name. Folded into text matching. */
  name?: string;
  /** Allow callers to pass extra fields without TS complaints. */
  [extra: string]: string | undefined;
}): CreativeTheme {
  const text =
    `${input.headline ?? ''} ${input.copy ?? ''} ${input.account ?? ''} ${input.name ?? ''}`.toLowerCase();
  let vertical = (input.vertical ?? '').toLowerCase();

  // 1. Exact vertical → theme hint
  const direct = VERTICAL_THEMES[vertical];
  if (direct) return direct;

  // 1b. Infer vertical from text/account when not supplied. Names like
  // "Hope Forward · TX", "World Vision AU", "Tampines FSC", "SCS pilot"
  // are unambiguously charity work even without a vertical field.
  if (!vertical) {
    if (
      /\b(hospital|oncolog|clinic|cancer|medical|surgery|patient|gold\s*coast)/.test(text) &&
      !/\b(roach|termite|pest|pestmax)/.test(text)
    ) {
      // Healthcare/medical charity context (e.g. "Gold Coast Hospital · Oncology")
      vertical = 'charity';
    } else if (
      /\b(hope\s*forward|world\s*vision|fsc|scs|charity|donat|nonprofit|foundation|sponsor|appeal|sustainer|knocker|relief)/.test(
        text,
      )
    )
      vertical = 'charity';
    else if (/\b(pestmax|pest|roach|termite|exterminat)/.test(text)) vertical = 'pest';
    else if (/\b(sunlink|solar|rooftop)/.test(text)) vertical = 'solar';
    else if (/\b(nextgen|telco|broadband|kwh|electric|gas)/.test(text)) vertical = 'energy';
  }

  // 2. Solar wins outright if vertical or copy mentions it (even without keywords)
  if (vertical.includes('solar') || /\b(solar|panel|kilowatt|kwh|rooftop\s*solar)\b/.test(text)) {
    return 'solar';
  }

  // 3. Charity inference
  if (vertical.includes('charity') || vertical.includes('nonprofit') || vertical.includes('ngo')) {
    // Order matters: concrete topic wins over generic sponsorship.
    // E.g. "Five dollars covers a meal" + "child sponsorship" → charity_food
    // because the literal ask is a meal. But "sponsored a child" with no other
    // theme word → charity_children.
    // Strip trailing \b so plurals match ("meals", "kids", "refugees").
    if (/\b(feed|hungr|food|meal|kitchen|hunger|pantry|families\s*fed)/.test(text))
      return 'charity_food';
    if (/\b(water|well|drink|thirst|clean\s*water|sanitation)/.test(text)) return 'charity_water';
    if (
      /\b(clinic|vaccin|medical|nurse|doctor|treatment|disease|surgery|oncolog|hospital|cancer|patient)/.test(
        text,
      )
    )
      return 'charity_medical';
    if (
      /\b(disaster|refug|relief|crisis|recover|earthquake|flood|hurricane|war|emergency)/.test(text)
    )
      return 'charity_disaster';
    if (/\b(dog|cat|puppy|kitten|pet|rescue|shelter|paw|animal)/.test(text))
      return 'charity_animals';
    // Sponsorship copy wins over environment when both appear — child sponsorship
    // creatives that mention "plants a tree" as a secondary benefit should
    // still show children.
    if (/\b(sponsor|child|kid|school|classroom|teach|learn|orphan)/.test(text))
      return 'charity_children';
    if (
      /\b(forest|tree|ocean|environment|climate|reef|coral|wildlife|conserv|sustainab|planet|reforestation)/.test(
        text,
      )
    )
      return 'charity_environment';
    // Charity context without specific keyword → children/sponsorship (safe default)
    return 'charity_children';
  }

  // 4. Vertical-specific keyword inference
  // (Vertical hint catches the cleanest case; regex handles fixtures where
  // vertical is short, e.g. 'pest' instead of 'pest_control'.)
  if (vertical === 'pest' || /\b(pest|roach|termite|rodent|spray|exterminat|bug|insect)/.test(text))
    return 'pest_control';
  if (
    vertical === 'energy' ||
    vertical === 'telco' ||
    /\b(wifi|fibre|fiber|broadband|electric|gas|telco|carrier|network|internet|kwh|power\s*plan)/.test(
      text,
    )
  )
    return 'energy_telco';
  if (/\b(camera|doorbell|alarm|burglar|monitor|locks?|security\s*system)/.test(text))
    return 'security';
  if (/\b(lawn|garden|paint|clean|maid|handyman|handyperson|tradie|landscaping|mowing)/.test(text))
    return 'home_services';

  if (
    vertical.includes('healthcare') ||
    vertical.includes('hospital') ||
    vertical.includes('clinic')
  )
    return 'healthcare';

  return 'business_b2b';
}
