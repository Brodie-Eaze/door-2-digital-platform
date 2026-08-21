import '@d2d/ui-tokens/globals.css';
import type { Metadata } from 'next';
import { SessionKeeper } from '@/components/SessionKeeper';
import { Inter, JetBrains_Mono } from 'next/font/google';

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
  // Multi-tenant surface — never a specific client's name. Per-org branding
  // comes from the org's BrandKit at render time.
  title: 'D2D Org Console',
  description: 'Field operations command centre for your door-to-door campaigns.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen font-sans">
        <SessionKeeper />
        {children}
      </body>
    </html>
  );
}
