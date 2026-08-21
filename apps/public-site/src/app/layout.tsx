import '@d2d/ui-tokens/globals.css';
import './marketing.css';
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  weight: ['400', '500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://door2digital.io'),
  title: {
    default: 'Door 2 Digital — the operating system for door-to-door',
    template: '%s · Door 2 Digital',
  },
  description:
    'Door 2 Digital closes the loop from the knock to the converted donor or customer — field capture, CRM, AI retargeting, conversion attribution and commissions, with audit-grade compliance built in.',
  applicationName: 'Door 2 Digital',
  openGraph: {
    type: 'website',
    title: 'Door 2 Digital — the operating system for door-to-door',
    description:
      'Field capture → CRM → retargeting → conversion → commission. One auditable loop for charity fundraising and commercial door-to-door.',
    siteName: 'Door 2 Digital',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen font-sans bg-paper text-ink antialiased flex flex-col">
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
