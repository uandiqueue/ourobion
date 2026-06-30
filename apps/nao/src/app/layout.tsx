// ourobion nao — root layout. Applies the dark "bio-neo-mythical" theme and loads
// the brand fonts via next/font/google to match the approved design:
//   Outfit         → UI + display (body, headings, the wordmark)
//   JetBrains Mono → eyebrows, labels, numbers, identifiers
// Each font exposes a CSS variable consumed by src/lib/theme.css
// (--font-outfit / --font-jetbrains).
import type { Metadata } from 'next';
import { Outfit, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  display: 'swap',
  weight: ['200', '300', '400', '500', '600', '700'],
  variable: '--font-outfit',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains',
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
    <html lang="en" className={`${outfit.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
