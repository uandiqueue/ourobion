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
  description: 'How Ourobion connects personal reflection with authorized research context.',
  // Both icons are pinned explicitly and both are served from public/brand/,
  // so src/app/ deliberately contains NO icon.* files at all.
  //
  // That is not a style preference. Next 15's metadata resolver
  // (lib/metadata/resolve-metadata.js) auto-wires file-convention icons
  // (src/app/icon.* / apple-icon.*) ONLY when `metadata.icons` is unset
  // entirely — any explicit `icons` entry short-circuits that discovery for
  // the whole `icons` object, `icon` and `apple` alike. Verified two ways:
  // by reading accumulateMetadata/mergeMetadata + resolve-icons.js, and by
  // building and inspecting the emitted <head> (with only `icons.icon` set,
  // the file-convention apple-touch-icon link vanished even though the file
  // still built its own route). Mixing the two mechanisms therefore lets a
  // file in src/app/ contribute nothing while looking load-bearing — which
  // is exactly how a stale mark survives a rebrand. One mechanism, one
  // place, no precedence rule to remember.
  //
  // The apple slot is a raster PNG because Apple's home-screen icon has no
  // SVG support; the vector glyph covers every other surface.
  icons: {
    icon: [{ url: '/brand/nao-favicon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/brand/nao-apple-touch-icon-180.png', sizes: '180x180', type: 'image/png' }],
  },
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
