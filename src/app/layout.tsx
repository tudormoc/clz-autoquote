import './globals.css';
import './datepicker.css';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { AppShell } from '@/components/layout/AppShell';
import { ConfirmHost } from '@/components/ui/ConfirmHost';
import { Notices } from '@/components/ui/Notices';
import { SIDEBAR_BOOT_SCRIPT } from '@/lib/sidebar';
import { APP_COPY } from '@/locales';

// Fonts are downloaded when the app is built and served from our own server (no request to Google at runtime).
// The names tailwind uses are the CSS variables below, see FONT_FAMILY in src/styles/theme.js.
const sans = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-sans', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin', 'latin-ext'], variable: '--font-mono', display: 'swap' });

export const metadata = {
    // A page's own title reads "Report Produzione · CLZ TM"
    title: { default: APP_COPY.header.title, template: `%s · ${APP_COPY.header.title}` },
    description: APP_COPY.header.subtitle,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        // The boot script may mark <html> before React starts (folded sidebar), hence suppressHydrationWarning
        <html lang="it" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: SIDEBAR_BOOT_SCRIPT }} />
            </head>
            <body className="antialiased">
                <AppShell>{children}</AppShell>
                <Notices />
                <ConfirmHost />
            </body>
        </html>
    );
}
