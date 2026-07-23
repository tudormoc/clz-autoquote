module.exports = {
    apps: [
        {
            // Main Next.js application
            name: 'clz-autoquote',
            script: 'node',
            args: './node_modules/next/dist/bin/next start',
            cwd: './',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            env: {
                NODE_ENV: 'production',
                PORT: 3000,
            },
        },
        {
            // Auto-exit scheduler — calls /api/auto-exit daily at TRIGGER_HOUR (Mon–Sat)
            name: 'clz-scheduler',
            script: 'node',
            args: 'scripts/scheduler.js',
            cwd: './',
            instances: 1,
            autorestart: true,
            watch: false,
            env: {
                PORT: 3000,
                AUTO_EXIT_TRIGGER_HOUR: 19,
            },
        },
    ],
};
