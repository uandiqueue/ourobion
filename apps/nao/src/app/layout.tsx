// ourobion nao — root layout. Applies the dark "bio-neo-mythical" theme and loads
// the brand fonts via next/font/google: Manrope (UI/body) + Outfit (display/headers).
// Each font exposes a CSS variable consumed by src/lib/theme.css (--font-ui / --font-display).
import type { Metadata } from 'next';
import { Manrope, Outfit } from 'next/font/google';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-manrope',
});

const outfit = Outfit({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-outfit',
});

export const metadata: Metadata = {
  title: 'ourobion nao',
  description: 'A window into the brain — the ourobion corpus dashboard.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${manrope.variable} ${outfit.variable}`}>
      <body>{children}</body>
    </html>
  );
}
