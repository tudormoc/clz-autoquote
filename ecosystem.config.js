module.exports = {
    apps: [
        {
            name: 'clz-autoquote',
            script: 'node',
            args: 'node_modules/next/dist/bin/next start',
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
    ],
};
