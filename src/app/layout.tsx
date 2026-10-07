import './globals.css';
import './datepicker.css';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ConfirmHost } from '@/components/ui/ConfirmHost';
import { Notices } from '@/components/ui/Notices';
import { APP_COPY } from '@/locales';

// Fonts are downloaded when the app is built and served from our own server (no request to Google at runtime).
// The names tailwind uses are the CSS variables below, see FONT_FAMILY in src/styles/theme.js.
const sans = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-sans', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin', 'latin-ext'], variable: '--font-mono', display: 'swap' });

export const metadata = {
    title: APP_COPY.header.title,
    description: APP_COPY.header.subtitle,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="it" className={`${sans.variable} ${mono.variable}`}>
            <body className="antialiased">
                {children}
                <Notices />
                <ConfirmHost />
            </body>
        </html>
    );
}
