/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Development badge away from the sidebar's fold button
    devIndicators: { position: 'bottom-right' },
    // Pages that moved into the Settings area: old links and bookmarks keep working
    async redirects() {
        return [
            { source: '/db-test', destination: '/settings/database', permanent: false },
            { source: '/presence/settings', destination: '/settings/presence', permanent: false },
        ];
    },
};

export default nextConfig;
