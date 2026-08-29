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
        {/* The ecosystem's shared state, loaded before the theme script that
            reads from it. In <body> for the same reason that script is: the App
            Router owns <head>, and rendering one here caused React error #418.

            Synchronous on purpose. The theme script below reads window.HarithStore
            the moment it runs, and it runs before anything paints — deferring this
            would mean the first frame is drawn from no stored preference, which is
            the flash both scripts exist to prevent. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="https://harithkavish.com/design-system/v1.0.0/harith-store.js?v=20260829.3" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
      </body>
    </html>
  );
}
