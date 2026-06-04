import Link from 'next/link';
import { Wordmark } from './site';

const COLUMNS: { heading: string; links: { href: string; label: string; external?: boolean }[] }[] =
  [
    {
      heading: 'Product',
      links: [
        { href: '/platform', label: 'Platform' },
        { href: '/pricing', label: 'Pricing' },
        { href: '/platform#loop', label: 'The loop' },
        { href: '/platform#mobile', label: 'Knocker app' },
      ],
    },
    {
      heading: 'Trust',
      links: [
        { href: '/security', label: 'Security & compliance' },
        { href: '/legal/privacy', label: 'Privacy' },
        { href: '/legal/terms', label: 'Terms' },
        { href: '/.well-known/security.txt', label: 'security.txt', external: true },
      ],
    },
    {
      heading: 'Company',
      links: [
        { href: '/company', label: 'About' },
        { href: '/contact', label: 'Contact' },
        { href: '/contact', label: 'Request access' },
      ],
    },
  ];

export function SiteFooter(): JSX.Element {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <Wordmark />
            <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-muted">
              The operating system for door-to-door — charity fundraising and commercial field
              sales, from the knock to the converted donor or customer.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-soft">
                {col.heading}
              </div>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={`${col.heading}-${link.label}`}>
                    {link.external ? (
                      <a
                        href={link.href}
                        className="text-[13px] text-muted transition-colors hover:text-ink"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-[13px] text-muted transition-colors hover:text-ink"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-line2 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] text-soft">© {year} Door 2 Digital. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-2 text-[12px] text-muted">
              <span className="d2d-status-pulse inline-block h-1.5 w-1.5 rounded-full bg-success" />
              SOC 2 Type I in progress
            </span>
            <span className="font-mono text-[11px] text-soft">US · AU · SG data residency</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
