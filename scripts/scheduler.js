/**
 * Scheduler for auto-exit logic.
 * Runs as a standalone PM2 process alongside the main Next.js app.
 * Calls GET /api/auto-exit every day at TRIGGER_HOUR (Mon–Sat).
 * Sunday is skipped by the server action itself.
 *
 * Requires: npm install node-cron
 */

const cron = require('node-cron');
const http = require('http');

// Read trigger hour from env or fall back to 19
const TRIGGER_HOUR = process.env.AUTO_EXIT_TRIGGER_HOUR || '19';
const PORT = process.env.PORT || 3000;

// Cron expression: minute=0, hour=TRIGGER_HOUR, every day Mon–Sat (1–6)
const cronExpression = `0 ${TRIGGER_HOUR} * * 1-6`;

console.log(`[Scheduler] Starting — auto-exit will run at ${TRIGGER_HOUR}:00 Mon–Sat`);

cron.schedule(cronExpression, () => {
    const now = new Date().toISOString();
    console.log(`[Scheduler] ${now} — triggering auto-exit...`);

    const req = http.get(`http://localhost:${PORT}/api/auto-exit`, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            try {
                const result = JSON.parse(data);
                if (result.skipped) {
                    console.log(`[Scheduler] Skipped: ${result.reason}`);
                } else {
                    console.log(`[Scheduler] Done — processed ${result.processed} operator(s):`, result.operators ?? []);
                }
            } catch {
                console.log(`[Scheduler] Response: ${data}`);
            }
        });
    });

    req.on('error', (err) => {
        console.error(`[Scheduler] Error calling auto-exit:`, err.message);
    });

    req.end();
});
