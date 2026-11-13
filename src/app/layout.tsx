import './globals.css';
import './datepicker.css';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { cookies } from 'next/headers';
import { AccessProvider } from '@/components/auth/AccessProvider';
import { AppShell } from '@/components/layout/AppShell';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import { ConfirmHost } from '@/components/ui/ConfirmHost';
import { Notices } from '@/components/ui/Notices';
import { getAccess } from '@/lib/auth/access';
import { SIDEBAR_BOOT_SCRIPT } from '@/lib/sidebar';
import { THEME_COOKIE, parseTheme } from '@/lib/theme';
import { APP_COPY } from '@/locales';
import { cn } from '@/lib/utils';

// Fonts are downloaded when the app is built and served from our own server (no request to Google at runtime).
// The names tailwind uses are the CSS variables below, see FONT_FAMILY in src/styles/theme.js.
const sans = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-sans', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin', 'latin-ext'], variable: '--font-mono', display: 'swap' });

export const metadata = {
    // A page's own title reads "Report Produzione · CLZ TM"
    title: { default: APP_COPY.header.title, template: `%s · ${APP_COPY.header.title}` },
    description: APP_COPY.header.subtitle,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    // Who is logged in decides the menu; the pages check access themselves. Database down: no menu, the page shows the error.
    const access = await getAccess().catch(() => null);
    // Light or dark, as this browser chose (src/lib/theme.ts): decided here, so the first paint is already right
    const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

    return (
        // The boot script may mark <html> before React starts (folded sidebar), hence suppressHydrationWarning
        <html lang="it" data-theme={theme} className={cn(sans.variable, mono.variable)} suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: SIDEBAR_BOOT_SCRIPT }} />
            </head>
            <body className="antialiased">
                <ThemeProvider theme={theme}>
                    <AccessProvider access={access}>
                        <AppShell>{children}</AppShell>
                    </AccessProvider>
                    <Notices />
                    <ConfirmHost />
                </ThemeProvider>
            </body>
        </html>
    );
}
