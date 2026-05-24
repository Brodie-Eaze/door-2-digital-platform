/**
 * Curated Unsplash photo bank for Marketing Studio creative previews.
 *
 * Each theme maps to 3-8 stable Unsplash photo IDs. The picker is
 * deterministic — same creative id → same image, so HMR + reloads don't
 * reshuffle. Themes line up with the campaign vertical + copy intent.
 *
 * Photo URL shape: https://images.unsplash.com/photo-{id}?w=W&h=H&fit=crop&q=80&auto=format
 * Already allowed in CSP img-src (apps/web-operator/next.config.mjs).
 *
 * Every photo ID in PHOTO_BANK was validated with HEAD requests against
 * images.unsplash.com before shipping — no 404s in production. To add
 * more, validate first: curl returns 200, then add the id (the slug
 * between "photo-" and "?" in the CDN URL).
 */

export type CreativeTheme =
  | 'charity_food' // hunger relief, soup kitchens, family meals
  | 'charity_water' // clean water wells, kids drinking, water programs
  | 'charity_children' // sponsored child portraits, classrooms, learning
  | 'charity_medical' // clinics, vaccinations, medical aid
  | 'charity_disaster' // disaster relief, refugees, recovery
  | 'charity_environment' // tree planting, ocean cleanup, climate
  | 'charity_animals' // animal rescue, wildlife conservation
  | 'solar' // residential rooftop solar, panels, sun
  | 'pest_control' // home exteriors, technicians, pest control
  | 'energy_telco' // power infrastructure, smart meters, internet
  | 'healthcare' // hospitals, nurses, medical staff, equipment
  | 'security' // home security, smart locks, doorbell cams
  | 'home_services' // generic home services — lawn, cleaning, paint
  | 'business_b2b'; // office, handshake, corporate

const PHOTO_BANK: Record<CreativeTheme, string[]> = {
  charity_food: [
    '1488521787991-ed7bbaae773c',
    '1567014543648-e4391c989aab',
    '1547592180-85f173990554',
    '1546554137-f86b9593a222',
    '1593113598332-cd288d649433',
    '1542838132-92c53300491e',
    '1505740106531-4243f3831c78',
    '1607013251379-e6eecfffe234',
  ],
  charity_water: [
    '1582719471384-894fbb16e074',
    '1559825481-12a05cc00344',
    '1488646953014-85cb44e25828',
    '1518002171953-a080ee817e1f',
    '1497436072909-60f360e1d4b1',
  ],
  charity_children: [
    '1503454537195-1dcabb73ffb9',
    '1517486808906-6ca8b3f04846',
    '1518384401463-d3876163c195',
    '1497486751825-1233686d5d80',
  ],
  charity_medical: [
    '1631815589968-fdb09a223b1e',
    '1559757148-5c350d0d3c56',
    '1576091160550-2173dba999ef',
    '1559757175-5700dde675bc',
    '1532938911079-1b06ac7ceec7',
    '1611689342806-0863700ce1e4',
  ],
  charity_disaster: [
    '1469571486292-0ba58a3f068b',
    '1518837695005-2083093ee35b',
    '1572947650440-e8a97ef053b2',
    '1521295121783-8a321d551ad2',
    '1551836022-d5d88e9218df',
    '1547471080-7cc2caa01a7e',
    '1518186285589-2f7649de83e0',
  ],
  charity_environment: [
    '1542601906990-b4d3fb778b09',
    '1502082553048-f009c37129b9',
    '1473773508845-188df298d2d1',
    '1530021232320-687d8e3dba54',
    '1505740420928-5e560c06d30e',
  ],
  charity_animals: [
    '1601758125946-6ec2ef64daf8',
    '1581888227599-779811939961',
    '1517423568366-8b83523034fd',
    '1546238232-20216dec9f72',
    '1583337130417-3346a1be7dee',
    '1517022812141-23620dba5c23',
  ],
  solar: [
    '1509391366360-2e959784a276',
    '1497440001374-f26997328c1b',
    '1521618755572-156ae0cdd74d',
    '1605980776566-0486c3ac7617',
    '1559302504-64aae6ca6b6d',
    '1508514177221-188b1cf16e9d',
    '1581094288338-2314dddb7ece',
    '1593941707882-a5bba14938c7',
  ],
  pest_control: [
    '1564013799919-ab600027ffc6',
    '1583847268964-b28dc8f51f92',
    '1576941089067-2de3c901e126',
    '1480074568708-e7b720bb3f09',
    '1503174971373-b1f69850bded',
    '1568605114967-8130f3a36994',
    '1493663284031-b7e3aefcae8e',
  ],
  energy_telco: [
    '1474440692490-2e83ae13ba29',
    '1497435334941-8c899ee9e8e9',
    '1605379399843-5870eea9b74e',
    '1606761568499-6d2451b23c66',
    '1500382017468-9049fed747ef',
    '1485827404703-89b55fcc595e',
  ],
  healthcare: [
    '1538108149393-fbbd81895907',
    '1530497610245-94d3c16cda28',
    '1559757148-5c350d0d3c56',
    '1576091160399-112ba8d25d1d',
    '1551601651-2a8555f1a136',
    '1631815589968-fdb09a223b1e',
    '1599045118108-bf9954418b76',
  ],
  security: [
    '1558002038-1055907df827',
    '1518733057094-95b53143d2a7',
    '1605379399843-5870eea9b74e',
    '1556909114-f6e7ad7d3136',
    '1583847268964-b28dc8f51f92',
  ],
  home_services: [
    '1592595896616-c37162298647',
    '1581578731548-c64695cc6952',
    '1572177812156-58036aae439c',
    '1558618666-fcd25c85cd64',
    '1564013799919-ab600027ffc6',
    '1556909114-f6e7ad7d3136',
  ],
  business_b2b: [
    '1556761175-5973dc0f32e7',
    '1521737711867-e3b97375f902',
    '1497366216548-37526070297c',
    '1554232456-8727aae0cfa4',
    '1556761175-4b46a572b786',
  ],
};

const FALLBACK_THEME: CreativeTheme = 'business_b2b';

/**
 * Pick a deterministic image URL for a creative given its theme + id.
 * Same (theme, id) always returns the same photo so HMR doesn't reshuffle.
 */
export function pickCreativeImage(
  theme: CreativeTheme,
  id: string,
  opts: { w?: number; h?: number } = {},
): string {
  const pool = PHOTO_BANK[theme] ?? PHOTO_BANK[FALLBACK_THEME];
  // Deterministic index from id (djb2 hash).
  let h = 5381;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) + h + id.charCodeAt(i)) >>> 0;
  }
  const photoId = pool[h % pool.length];
  const w = opts.w ?? 600;
  const ht = opts.h ?? 600;
  return `https://images.unsplash.com/photo-${photoId}?w=${w}&h=${ht}&fit=crop&q=80&auto=format`;
}

/**
 * Infer a theme from a creative's vertical + headline. Used when the
 * fixture data doesn't already carry an explicit theme.
 */
export function inferTheme(input: {
  vertical?: string;
  headline?: string;
  copy?: string;
  name?: string;
  brief?: string;
  account?: string;
}): CreativeTheme {
  const text =
    `${input.headline ?? ''} ${input.copy ?? ''} ${input.name ?? ''} ${input.brief ?? ''} ${input.account ?? ''}`.toLowerCase();
  const vertical = (input.vertical ?? '').toLowerCase();

  // Charity sub-themes
  if (
    vertical.includes('charity') ||
    /\b(world\svision|hope\sforward|scs|tampines\sfsc|sponsor|donat|appeal|fundrais)\b/.test(text)
  ) {
    if (
      /\b(feed|hungr|food|meal|families\sfed|kitchen|cuppa|breakfast|dinner|lunch)\b/.test(text)
    ) {
      return 'charity_food';
    }
    if (/\b(water|well|drink|thirst|clean\swater|tap)\b/.test(text)) return 'charity_water';
    if (
      /\b(child|kid|sponsor\sa|school|learn|education|classroom|orphan|grandkid|cebu)\b/.test(text)
    ) {
      return 'charity_children';
    }
    if (
      /\b(clinic|vaccin|medical|nurse|doctor|treatment|cancer|oncology|hospital|recovery)\b/.test(
        text,
      )
    ) {
      return 'charity_medical';
    }
    if (/\b(disaster|refug|relief|crisis|earthquake|flood|hurricane|evac)\b/.test(text)) {
      return 'charity_disaster';
    }
    if (
      /\b(forest|tree|ocean|environment|climate|reef|coral|wildlife|conserv|sustainab|guardian|planet|green)\b/.test(
        text,
      )
    ) {
      return 'charity_environment';
    }
    if (/\b(dog|cat|puppy|kitten|pet|rescue\sanimal|shelter|paw|animal|wildlife)\b/.test(text)) {
      return 'charity_animals';
    }
    return 'charity_children'; // safe default for charity
  }

  // Commercial sub-themes
  if (/\b(solar|panel|kilowatt|kwh\sbill|sun|rooftop|sunlink|sundown)\b/.test(text)) return 'solar';
  if (/\b(pest|roach|termite|rodent|spray|exterminat|bug|pestmax)\b/.test(text))
    return 'pest_control';
  if (
    /\b(wifi|fibre|fiber|broadband|electric|kwh|gas|telco|carrier|network|power|grid|meter|nextgen)\b/.test(
      text,
    )
  ) {
    return 'energy_telco';
  }
  if (/\b(camera|doorbell|alarm|security|burglar|monitor|lock|smart\shome)\b/.test(text)) {
    return 'security';
  }
  if (/\b(lawn|garden|paint|clean|maid|handyman|handyperson|tradie|landscap)\b/.test(text)) {
    return 'home_services';
  }

  // Healthcare vertical
  if (vertical.includes('healthcare') || vertical.includes('hospital')) return 'healthcare';

  return 'business_b2b';
}
