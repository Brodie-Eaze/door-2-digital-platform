/*
 * CreativeStudio — "their about the marketing department, creative studio". D2D
 * is operator-first, so the client gets D2D's in-house marketing department +
 * creative studio: real ad creative generated, brand-safety-checked, and run to
 * warm the territory before the field team arrives. Uses real imagery (Esri is
 * for maps; these are Unsplash photos) styled as the studio's ad output.
 * Server component.
 */
import { Sparkles, ShieldCheck, Megaphone, Wand2 } from 'lucide-react';

const U = (id: string): string =>
  `https://images.unsplash.com/photo-${id}?w=600&q=70&auto=format&fit=crop`;

const CREATIVES: { vertical: string; headline: string; img: string }[] = [
  { vertical: 'Solar', headline: 'Lower bills, $0 down', img: U('1509391366360-2e959784a276') },
  {
    vertical: 'Charity',
    headline: 'Give monthly, change a life',
    img: U('1532629345422-7515f3d16bb6'),
  },
  { vertical: 'Home services', headline: 'Your home, handled', img: U('1560518883-ce09059eeffa') },
  { vertical: 'Energy', headline: 'Switch and save', img: U('1473341304170-971dccb5ac1e') },
  {
    vertical: 'Fundraising',
    headline: 'Be the reason today',
    img: U('1593113598332-cd288d649433'),
  },
  { vertical: 'Broadband', headline: 'Fibre on your street', img: U('1570129477492-45c003edd2be') },
];

const POINTS: { icon: React.ReactNode; title: string; body: string }[] = [
  {
    icon: <Wand2 size={15} />,
    title: 'Creative studio',
    body: 'Copy, image and video generated on-brand for each vertical and audience — dozens of variants in minutes.',
  },
  {
    icon: <ShieldCheck size={15} />,
    title: 'Brand-safety + provenance',
    body: 'Every asset runs the legal-hold and brand-safety gates; C2PA provenance is stamped before anything ships.',
  },
  {
    icon: <Megaphone size={15} />,
    title: 'Run across the networks',
    body: 'Delivered to Meta, Google and TikTok as geo + lookalike audiences — warming the territory before the knock.',
  },
];

export function CreativeStudio(): JSX.Element {
  return (
    <div className="grid items-start gap-10 lg:grid-cols-[0.85fr_1.15fr]">
      {/* Copy */}
      <div>
        <span className="inline-flex items-center gap-2 rounded-full bg-accentSoft px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-accent">
          <Sparkles size={12} /> Marketing department, included
        </span>
        <h3 className="mt-4 text-[24px] font-semibold leading-tight tracking-tight text-ink sm:text-[30px]">
          You don&apos;t just get software. You get a creative studio.
        </h3>
        <p className="mt-3 max-w-md text-[14px] leading-relaxed text-muted">
          Because we run campaigns operator-first, D2D&apos;s own marketing department and creative
          studio come with the platform. We design the ads, clear them through brand-safety, and run
          them to the exact blocks your field team is about to work — so every door is a warm one.
        </p>
        <ul className="mt-6 space-y-4">
          {POINTS.map((p) => (
            <li key={p.title} className="flex gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accentSoft text-accent">
                {p.icon}
              </span>
              <div>
                <div className="text-[14px] font-semibold tracking-tight text-ink">{p.title}</div>
                <div className="mt-0.5 text-[13px] leading-relaxed text-muted">{p.body}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Creative gallery — real imagery */}
      <div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {CREATIVES.map((c) => (
            <figure
              key={c.headline}
              className="group overflow-hidden rounded-xl border border-line bg-surface"
            >
              <div className="relative aspect-[4/5]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.img}
                  alt={`${c.vertical} ad creative`}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(180deg, rgba(15,23,42,0.05), rgba(15,23,42,0.78))',
                  }}
                />
                <span className="absolute left-2 top-2 rounded bg-black/45 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.10em] text-white/90 backdrop-blur-sm">
                  {c.vertical}
                </span>
                <figcaption className="absolute inset-x-2.5 bottom-2 text-[12px] font-semibold leading-tight text-white">
                  {c.headline}
                </figcaption>
              </div>
              <div className="flex items-center justify-between px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.08em] text-soft">
                <span className="inline-flex items-center gap-1 text-accent">
                  <Sparkles size={8} /> AI
                </span>
                <span>C2PA · brand-safe</span>
              </div>
            </figure>
          ))}
        </div>
        <p className="mt-3 text-center font-mono text-[10px] text-soft">
          Illustrative studio output · generated + brand-safety-checked in the Marketing Studio
        </p>
      </div>
    </div>
  );
}
