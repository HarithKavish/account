import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/components/auth-provider';
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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the stored theme before first paint to avoid a flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
