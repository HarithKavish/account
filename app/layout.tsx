import type { Metadata, Viewport } from 'next';
import { themeInitScript } from '@/components/theme-toggle';
import { site } from '@/lib/config/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: site.fullName,
    template: `%s · ${site.fullName}`,
  },
  description: site.summary,
  applicationName: site.fullName,
  openGraph: {
    type: 'website',
    siteName: site.fullName,
    title: site.fullName,
    description: site.summary,
    url: site.url,
  },
  // An account platform has nothing to gain from being indexed, and signed-in
  // surfaces should never be crawled.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f9fb' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1014' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `suppressHydrationWarning` covers the `data-theme` attribute that the
    // script below writes onto this element before React exists.
    <html lang="en" suppressHydrationWarning>
      <body>
        {/*
         * Applies the stored theme before first paint to avoid a flash.
         *
         * This deliberately lives at the top of <body> rather than in a <head>
         * element of our own. In the App Router, Next.js owns <head> and
         * injects the metadata (title, meta, link, preloads) into it. Rendering
         * an explicit <head> here made the server HTML's head — Next's tags
         * plus this script — disagree with the client tree, which contained
         * only this script. React resolved that by tearing the whole head down
         * and rebuilding it, which is React error #418.
         *
         * As the first node in <body> the script still runs synchronously
         * before any page content is parsed or painted, so the theme is applied
         * just as early and there is still no flash.
         */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
      </body>
    </html>
  );
}
