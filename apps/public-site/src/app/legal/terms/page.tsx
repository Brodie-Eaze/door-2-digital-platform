import type { Metadata } from 'next';
import { SiteContainer, Eyebrow } from '@/components/site';

export const metadata: Metadata = {
  title: 'Terms of use',
  description:
    'The terms that govern use of the Door 2 Digital website. Platform use is governed by a separate master services agreement.',
};

const UPDATED = '31 May 2026';

export default function TermsPage(): JSX.Element {
  return (
    <>
      <section className="bg-hero">
        <SiteContainer className="py-12 sm:py-14">
          <Eyebrow tone="surface">Legal</Eyebrow>
          <h1 className="mt-3 text-[30px] font-semibold tracking-tight text-surface sm:text-[38px]">
            Terms of use
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
              These terms govern your use of the Door 2 Digital website. Access to and use of the
              Door 2 Digital platform itself is governed by a separate master services agreement
              between Door 2 Digital and the contracting organisation — nothing on this website
              grants a right to use the platform.
            </Lead>

            <Section title="1. Acceptance">
              <P>
                By accessing this website you agree to these terms. If you do not agree, please do
                not use the site. We may update these terms from time to time; continued use after a
                change means you accept the updated terms.
              </P>
            </Section>

            <Section title="2. The website is informational">
              <P>
                The content here describes our product and company. It is provided for general
                information and does not constitute a binding offer, a warranty, legal advice, or a
                commitment to deliver any specific feature on any specific timeline. Where we
                describe the stage of the product, we aim to be accurate — including being clear
                about what is live versus in progress.
              </P>
            </Section>

            <Section title="3. Acceptable use">
              <List
                items={[
                  'Do not attempt to disrupt, probe or gain unauthorised access to the site or its infrastructure outside our published responsible-disclosure channel.',
                  'Do not scrape, copy or reuse site content for a competing commercial purpose without permission.',
                  'Do not submit false, unlawful, or another person’s information through our forms.',
                ]}
              />
              <P>
                Security researchers are welcome — see our{' '}
                <a
                  href="/.well-known/security.txt"
                  className="font-medium text-accent hover:underline"
                >
                  security.txt
                </a>{' '}
                for how to report a vulnerability responsibly.
              </P>
            </Section>

            <Section title="4. Intellectual property">
              <P>
                The Door 2 Digital name, logo, site design, copy and underlying software are owned
                by Door 2 Digital and protected by applicable intellectual-property laws. We grant
                you a limited, revocable licence to view the site for your own evaluation only.
              </P>
            </Section>

            <Section title="5. Third-party links">
              <P>
                The site may link to third-party resources we do not control. We are not responsible
                for their content or practices, and a link is not an endorsement.
              </P>
            </Section>

            <Section title="6. Disclaimers">
              <P>
                The site is provided &quot;as is&quot; and &quot;as available&quot; without
                warranties of any kind, to the fullest extent permitted by law. We do not warrant
                that the site will be uninterrupted, error-free, or free of harmful components,
                though we work hard to keep it secure and available.
              </P>
            </Section>

            <Section title="7. Limitation of liability">
              <P>
                To the fullest extent permitted by law, Door 2 Digital is not liable for any
                indirect, incidental, special or consequential damages arising from your use of the
                website. Nothing in these terms limits liability that cannot be limited under
                applicable law.
              </P>
            </Section>

            <Section title="8. Governing terms for the platform">
              <P>
                If your organisation uses the Door 2 Digital platform, that relationship — including
                data processing, service levels, fees and liability — is governed by your master
                services agreement and data-processing agreement, which take precedence over these
                site terms for all platform matters.
              </P>
            </Section>

            <Section title="9. Contact">
              <P>
                Questions about these terms? Email{' '}
                <a
                  href="mailto:legal@door2digital.io"
                  className="font-medium text-accent hover:underline"
                >
                  legal@door2digital.io
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
