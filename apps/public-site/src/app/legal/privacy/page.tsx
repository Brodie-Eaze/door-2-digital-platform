import type { Metadata } from 'next';
import { SiteContainer, Eyebrow } from '@/components/site';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description:
    'How Door 2 Digital collects, uses, protects and retains personal information — for site visitors and for the donors and customers our platform processes.',
};

const UPDATED = '31 May 2026';

export default function PrivacyPage(): JSX.Element {
  return (
    <>
      <section className="bg-hero">
        <SiteContainer className="py-12 sm:py-14">
          <Eyebrow tone="surface">Legal</Eyebrow>
          <h1 className="mt-3 text-[30px] font-semibold tracking-tight text-surface sm:text-[38px]">
            Privacy policy
          </h1>
          <p className="mt-3 font-mono text-[12px] uppercase tracking-[0.14em] text-surface/55">
            Last updated · {UPDATED}
          </p>
        </SiteContainer>
      </section>

      <section className="bg-paper py-12 sm:py-16">
        <SiteContainer className="max-w-3xl">
          <div className="card card-pad">
            <Lead>
              This policy explains how Door 2 Digital handles personal information — both for people
              who visit this website and for the donors and customers whose data our platform
              processes on behalf of the organisations that use it. We hold a deliberately high bar
              here: the platform is built so that personal data is encrypted, region-pinned and
              access-audited by default.
            </Lead>

            <Section title="1. Who we are">
              <P>
                Door 2 Digital (&quot;D2D&quot;, &quot;we&quot;, &quot;us&quot;) provides an
                operating system for door-to-door charity fundraising and commercial field sales.
                For data we process on behalf of a client organisation, that organisation is the
                controller and we act as the processor under their instructions and our agreement.
              </P>
            </Section>

            <Section title="2. Information we collect">
              <P>From visitors to this website:</P>
              <List
                items={[
                  'Details you submit through the contact form — your name, email, organisation and message.',
                  'Limited technical data needed to serve the site securely (such as IP address and request metadata).',
                ]}
              />
              <P>
                Through the platform, on behalf of client organisations, we may process donor and
                customer contact details, consent records, signatures, and transaction information.
                That processing is governed by the client agreement, not by this website policy.
              </P>
            </Section>

            <Section title="3. How we use it">
              <List
                items={[
                  'To respond to your enquiry and, if relevant, discuss working together.',
                  'To operate, secure and improve the website and the platform.',
                  'To meet legal, regulatory and audit obligations — including the fundraising, consent and record-keeping rules that govern door-to-door activity.',
                ]}
              />
              <P>
                We do not sell personal information, and we do not share contact-form submissions
                with third parties for their own marketing.
              </P>
            </Section>

            <Section title="4. How we protect it">
              <P>
                Sensitive fields are encrypted at rest using envelope encryption with region-pinned
                keys. Access to plaintext personal data uses just-in-time, dual-control unmasking,
                and every reveal is written to an immutable audit trail. Tenant and region isolation
                are enforced at multiple independent layers. You can read more on our{' '}
                <a href="/security" className="font-medium text-accent hover:underline">
                  security page
                </a>
                .
              </P>
            </Section>

            <Section title="5. Where it lives">
              <P>
                Data is pinned to a region — United States, Australia or Singapore — at the time an
                organisation is created, and is not replicated across regions. Australian personal
                information stays in Australia; United States data stays in the United States. This
                is enforced in the database, not just by policy.
              </P>
            </Section>

            <Section title="6. How long we keep it">
              <P>
                We keep contact enquiries only as long as needed to follow up and to maintain
                reasonable business records. Platform data is retained per the client agreement and
                the applicable fundraising and financial record-keeping laws, which can require
                multi- year retention. Audit records are retained for seven years.
              </P>
            </Section>

            <Section title="7. Your rights">
              <P>
                Depending on where you live, you may have rights to access, correct, delete, or
                limit the use of your personal information, and to object to certain processing. We
                support deletion (right-to-be-forgotten) workflows in the platform. To exercise a
                right, or if you are a donor or customer of an organisation that uses D2D, contact
                us at the address below and we will route the request appropriately.
              </P>
            </Section>

            <Section title="8. Sub-processors">
              <P>
                We use a small set of vetted infrastructure and communications providers (such as
                cloud hosting, email delivery and payment processing) under data-processing terms. A
                current list is available to clients on request.
              </P>
            </Section>

            <Section title="9. Changes">
              <P>
                We may update this policy as the product and our obligations evolve. We will revise
                the date above when we do, and we will not weaken our commitments quietly.
              </P>
            </Section>

            <Section title="10. Contact">
              <P>
                Questions about privacy, or to make a request, email{' '}
                <a
                  href="mailto:privacy@door2digital.io"
                  className="font-medium text-accent hover:underline"
                >
                  privacy@door2digital.io
                </a>
                .
              </P>
            </Section>
          </div>
        </SiteContainer>
      </section>
    </>
  );
}

function Lead({ children }: { children: React.ReactNode }): JSX.Element {
  return <p className="text-[15px] leading-relaxed text-ink2">{children}</p>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="mt-8 border-t border-line2 pt-6 first:border-t-0">
      <h2 className="text-[16px] font-semibold tracking-tight text-ink">{title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </div>
  );
}

function P({ children }: { children: React.ReactNode }): JSX.Element {
  return <p className="text-[13.5px] leading-relaxed text-muted">{children}</p>;
}

function List({ items }: { items: string[] }): JSX.Element {
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={it} className="flex gap-2.5 text-[13.5px] leading-relaxed text-muted">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
          {it}
        </li>
      ))}
    </ul>
  );
}
