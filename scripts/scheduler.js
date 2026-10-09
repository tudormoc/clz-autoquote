/**
 * Scheduler for auto-exit logic.
 * Runs as a standalone PM2 process alongside the main Next.js app.
 * Calls GET /api/auto-exit every day at TRIGGER_HOUR (Mon–Sat).
 * Sunday is skipped by the server action itself.
 * The route only accepts the scheduler: it sends a key derived from AUTH_SECRET in .env.local
 * (the same derivation as schedulerKey() in src/lib/auth/secrets.ts).
 *
 * Requires: npm install node-cron
 */

const cron = require('node-cron');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');

// Read trigger hour from env or fall back to 19
const TRIGGER_HOUR = process.env.AUTO_EXIT_TRIGGER_HOUR || '19';
const PORT = process.env.PORT || 3000;

/** AUTH_SECRET from the environment or the app's .env.local */
function authSecret() {
    if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
    try {
        const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
        const line = env.split(/\r?\n/).find((l) => l.trim().startsWith('AUTH_SECRET='));
        return line ? line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : '';
    } catch {
        return '';
    }
}

/** HMAC-SHA256("auto-exit") with the key HKDF(AUTH_SECRET, "clz-scheduler"), base64url */
function schedulerKey() {
    const key = Buffer.from(crypto.hkdfSync('sha256', authSecret(), '', 'clz-scheduler', 32));
    return crypto.createHmac('sha256', key).update('auto-exit').digest('base64url');
}

// Cron expression: minute=0, hour=TRIGGER_HOUR, every day Mon–Sat (1–6)
const cronExpression = `0 ${TRIGGER_HOUR} * * 1-6`;

console.log(`[Scheduler] Starting — auto-exit will run at ${TRIGGER_HOUR}:00 Mon–Sat`);
if (!authSecret()) console.error('[Scheduler] AUTH_SECRET not found: /api/auto-exit will refuse the call');

cron.schedule(cronExpression, () => {
    const now = new Date().toISOString();
    console.log(`[Scheduler] ${now} — triggering auto-exit...`);

    const req = http.get(`http://localhost:${PORT}/api/auto-exit`, { headers: { 'x-scheduler-key': schedulerKey() } }, (res) => {
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
