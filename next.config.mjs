/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Development badge away from the sidebar's fold button
    devIndicators: { position: 'bottom-right' },
    // In development Next prints every server action with what was sent to it: a login would put the name and the
    // PIN in the dev server's console, and dev uses the real users (README rule 7: a PIN is never logged)
    logging: { serverFunctions: false },
    // The SQL Server driver stays out of the bundle and is loaded from node_modules at run time. Its Azure login part
    // (never used here) pulls in helpers the bundler cannot pack: the build broke on `powershell-utils` once
    // @azure/identity moved to open@11 (2026-11-11, Next 16.4.6)
    serverExternalPackages: ['mssql', 'tedious'],
    // Pages that moved into the Settings area: old links and bookmarks keep working
    async redirects() {
        return [
            { source: '/db-test', destination: '/settings/database', permanent: false },
            { source: '/presence/settings', destination: '/settings/presence', permanent: false },
        ];
    },
};

export default nextConfig;
