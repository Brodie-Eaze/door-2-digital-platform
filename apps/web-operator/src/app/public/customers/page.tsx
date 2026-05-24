import Link from 'next/link';
import { ArrowRight, Heart, Building2, Stethoscope } from 'lucide-react';
import { PublicShell } from '@/components/PublicShell';

export const metadata = {
  title: 'Customers — Door 2 Digital',
  description:
    'Charity, commercial and healthcare operators running door-to-door on D2D. Case studies with anonymised metrics.',
};

interface CaseStudy {
  id: string;
  icon: typeof Heart;
  industry: string;
  org: string;
  region: string;
  size: string;
  problem: string;
  solution: string;
  results: { metric: string; label: string }[];
  quote: string;
  quoteAttribution: string;
}

const CASE_STUDIES: CaseStudy[] = [
  {
    id: 'hope-forward',
    icon: Heart,
    industry: 'Charity & Non-profit',
    org: 'Hope Forward (anonymised)',
    region: 'US Southeast',
    size: '85 knockers · 4 territories',
    problem:
      'Hope Forward ran face-to-face donor acquisition with 9 separate tools — a paper clipboard for the door, a Google Sheet for nightly recon, a Mailchimp for follow-up, a Stripe sub for processing, and a binder for state clearance. Every Saturday morning was a manual reconciliation. Donor lapse rates were 38% inside 90 days because nobody saw the data fast enough.',
    solution:
      'Migrated to D2D Enterprise across all 4 US Southeast territories. Knocker iOS replaced paper. Operator console replaced the Saturday reconciliation. Marketing Studio replaced the Mailchimp queue. State clearance went from a binder to a live status dashboard.',
    results: [
      { metric: '+34%', label: 'Conversion velocity' },
      { metric: '-71%', label: 'Reconciliation hours' },
      { metric: '24h', label: 'Donor follow-up SLA' },
      { metric: '0', label: 'State clearance lapses' },
    ],
    quote:
      'D2D collapsed nine tools into one screen. Our field directors got their Saturdays back, and donor lapse dropped from 38% to 22% in the first quarter.',
    quoteAttribution: 'VP Field Operations, Hope Forward',
  },
  {
    id: 'pestmax',
    icon: Building2,
    industry: 'Commercial · Home services',
    org: 'PestMax (anonymised)',
    region: 'US + AU (Brisbane pilot)',
    size: '62 knockers · 11 territories',
    problem:
      'PestMax expanded into door-to-door acquisition after years of inbound. Their existing CRM had no concept of a territory, no knock log, and no commission engine — every payout was hand-calculated in Excel. When they tried to scale a Brisbane pilot, the time-zone gap killed their ops cadence and the AU vs US compliance rules made the spreadsheet untenable.',
    solution:
      'Adopted D2D Enterprise with multi-region (US + AU). Each region runs its own processors (MiCamp US, Stripe AU), residency, and compliance rules — but every knocker shows up on the same live map. Commission engine handles per-bucket rake so closers, knockers, and brand-ambassadors split correctly without manual spreadsheets.',
    results: [
      { metric: '$1.6M', label: 'AU pilot ARR in 90 days' },
      { metric: '4×', label: 'Knocker productivity vs paper' },
      { metric: '11→27', label: 'Territories without ops hire' },
      { metric: '99.4%', label: 'Commission accuracy' },
    ],
    quote:
      'We tried to run AU on the US toolchain — it broke in a week. D2D multi-region let us launch Brisbane in the same console as Texas, with the right processors and rules baked in.',
    quoteAttribution: 'COO, PestMax',
  },
  {
    id: 'gch',
    icon: Stethoscope,
    industry: 'Healthcare outreach',
    org: 'Gold Coast Health (anonymised)',
    region: 'AU · QLD',
    size: '34 community outreach staff · 6 zones',
    problem:
      'Gold Coast Health runs community outreach for chronic-condition awareness — knocking the right doors with the right script in a regulated environment. Privacy Act 1988 compliance meant every conversation note had to be auditable. Their previous tool stored notes in S3 with no lineage; one subject access request would have taken weeks to fulfil.',
    solution:
      'Deployed D2D Enterprise on AU residency with the hash-chained audit log and S3 Object Lock 7-yr retention. Every conversation note carries lineage from collection to retention. Privacy Act subject access requests now run as a single console query.',
    results: [
      { metric: '< 4hrs', label: 'SAR fulfilment time' },
      { metric: '100%', label: 'Audit lineage coverage' },
      { metric: '7yr', label: 'Object Lock retention' },
      { metric: '+18%', label: 'Outreach completion rate' },
    ],
    quote:
      'When the OAIC asked, we ran one query and exported a signed packet. That alone justified the platform.',
    quoteAttribution: 'Director of Compliance, Gold Coast Health',
  },
];

const LOGO_ROW = [
  'Hope Forward',
  'PestMax',
  'Gold Coast Health',
  'Cascade Energy',
  'Bright Solar',
  'Mosaic Charity',
  'CareReach',
  'NorthStar Telco',
];

export default function PublicCustomersPage(): JSX.Element {
  return (
    <PublicShell activeNav="customers">
      {/* HERO */}
      <section className="border-b border-line2 bg-gradient-to-b from-surface to-paper">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accentSoft text-accent text-[11px] uppercase tracking-[0.12em] font-medium mb-6">
              Customers
            </div>
            <h1 className="text-4xl sm:text-5xl font-semibold text-ink tracking-tight leading-[1.05]">
              Operators running door-to-door on D2D today.
            </h1>
            <p className="mt-5 text-lg text-muted max-w-2xl leading-relaxed">
              Charity, commercial home services, and healthcare outreach — three archetypes, three
              regions, one operating system. Customer names anonymised at customer request.
            </p>
          </div>
        </div>
      </section>

      {/* LOGO WALL */}
      <section className="border-b border-line2 bg-surface">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12">
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted font-medium text-center mb-8">
            Trusted by operators across three regions
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-x-6 gap-y-5">
            {LOGO_ROW.map((logo) => (
              <div
                key={logo}
                className="flex items-center justify-center text-[12.5px] text-muted font-medium tracking-tight px-4 py-3 rounded-md border border-line2 bg-paper text-center"
              >
                {logo}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CASE STUDIES */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-16 lg:py-20">
        <div className="max-w-2xl mb-12">
          <h2 className="text-[11px] uppercase tracking-[0.12em] text-muted font-medium mb-3">
            Case studies
          </h2>
          <h3 className="text-3xl sm:text-4xl font-semibold text-ink tracking-tight">
            Three archetypes. Three outcomes.
          </h3>
        </div>

        <div className="space-y-8 lg:space-y-10">
          {CASE_STUDIES.map((cs) => {
            const Icon = cs.icon;
            return (
              <article key={cs.id} className="card card-pad p-8 lg:p-10">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">
                  {/* Left col — meta */}
                  <div>
                    <div className="inline-flex items-center justify-center h-10 w-10 rounded-md bg-accentSoft text-accent mb-4">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="text-[11px] uppercase tracking-[0.12em] text-muted font-medium mb-1.5">
                      {cs.industry}
                    </div>
                    <h4 className="text-[18px] font-semibold text-ink tracking-tight">{cs.org}</h4>
                    <div className="mt-3 text-[12.5px] text-muted space-y-1">
                      <div>
                        <span className="text-ink font-medium">Region:</span> {cs.region}
                      </div>
                      <div>
                        <span className="text-ink font-medium">Size:</span> {cs.size}
                      </div>
                    </div>
                  </div>

                  {/* Middle col — problem & solution */}
                  <div className="lg:col-span-2 space-y-6">
                    <div>
                      <h5 className="text-[11px] uppercase tracking-[0.10em] text-muted font-semibold mb-2">
                        Problem
                      </h5>
                      <p className="text-[14px] text-ink leading-relaxed">{cs.problem}</p>
                    </div>
                    <div>
                      <h5 className="text-[11px] uppercase tracking-[0.10em] text-muted font-semibold mb-2">
                        Solution
                      </h5>
                      <p className="text-[14px] text-ink leading-relaxed">{cs.solution}</p>
                    </div>
                  </div>
                </div>

                {/* Results strip */}
                <div className="mt-8 pt-8 border-t border-line2">
                  <h5 className="text-[11px] uppercase tracking-[0.10em] text-muted font-semibold mb-4">
                    Results
                  </h5>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    {cs.results.map((r) => (
                      <div key={r.label}>
                        <div className="text-2xl font-semibold text-ink tracking-tight numeric">
                          {r.metric}
                        </div>
                        <div className="text-[11.5px] uppercase tracking-[0.08em] text-muted font-medium mt-1">
                          {r.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quote */}
                <blockquote className="mt-8 pt-8 border-t border-line2 text-[15px] text-ink leading-relaxed italic">
                  &ldquo;{cs.quote}&rdquo;
                  <footer className="mt-3 not-italic text-[12.5px] text-muted">
                    — {cs.quoteAttribution}
                  </footer>
                </blockquote>
              </article>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-line2 bg-paper">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
          <div className="card card-pad p-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-semibold text-ink tracking-tight">
              Your archetype isn&apos;t listed. Let&apos;s talk anyway.
            </h2>
            <p className="mt-4 text-[14.5px] text-muted max-w-xl mx-auto">
              Solar, telco, energy, advocacy, religious — if knockers hit doors and money moves, D2D
              fits.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/public/signup?intent=demo"
                className="inline-flex items-center justify-center gap-2 bg-ink text-surface text-[14px] font-semibold px-6 py-3.5 rounded-md hover:bg-ink2 transition tracking-tight"
              >
                Book demo <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/public/pricing"
                className="inline-flex items-center justify-center gap-2 bg-surface text-ink text-[14px] font-semibold px-6 py-3.5 rounded-md border border-line hover:bg-paper transition tracking-tight"
              >
                See pricing
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
