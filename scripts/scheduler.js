/**
 * Scheduler of the daily automatic exit.
 * Runs as its own PM2 process next to the app (ecosystem.config.js) and calls GET /api/auto-exit every day at the
 * hour written in src/config/schedule.json (Mon–Sat; a day that is not worked is skipped by the app itself).
 * The route writes only for the scheduler: it sends a key derived from AUTH_SECRET in .env.local
 * (the same derivation as schedulerKey() in src/lib/auth/secrets.ts).
 *
 * It reads the app's answer. A run that did not happen (the app was restarting), broke off or left exits unwritten
 * is tried again: `autoExitRetries` more times, `autoExitRetryMinutes` apart (schedule.json). A second run is safe:
 * the app gives an exit only to who is still in. A refused call (403) is not tried again: the key stays wrong until
 * AUTH_SECRET is put right.
 *
 * Requires: npm install node-cron
 */

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const schedule = require('../src/config/schedule.json');

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

/** Operator codes as one text, "nobody" for none */
function list(operators) {
    return operators.length > 0 ? operators.join(', ') : 'nobody';
}

/**
 * What an answer of /api/auto-exit means: `ok` (the run ended well), `retry` (worth calling again) and the line for
 * the PM2 log. The app answers { success, skipped?, reason?, error?, exits: [{ operator, written, error? }] }.
 */
function readAnswer(status, body) {
    if (status === 403) {
        return { ok: false, retry: false, text: 'Refused (403): the AUTH_SECRET the scheduler reads is not the one of the app. Not tried again.' };
    }
    let result = null;
    try {
        result = JSON.parse(body);
    } catch {
        // Not JSON: an error page of the server
    }
    if (status !== 200 || result === null || typeof result !== 'object') {
        return { ok: false, retry: true, text: `Unexpected answer (HTTP ${status}): ${String(body).slice(0, 200)}` };
    }
    if (result.skipped) return { ok: true, retry: false, text: `Skipped: ${result.reason}` };

    const exits = Array.isArray(result.exits) ? result.exits : [];
    const written = exits.filter((exit) => exit.written).map((exit) => exit.operator);
    const failed = exits.filter((exit) => exit.error !== undefined).map((exit) => exit.operator);
    if (result.success !== true) {
        return { ok: false, retry: true, text: `Failed: ${result.error}. Exits written before that: ${list(written)}` };
    }
    if (failed.length > 0) {
        return { ok: false, retry: true, text: `${written.length} exit(s) written: ${list(written)}. NOT written, ${failed.length}: ${list(failed)}` };
    }
    return { ok: true, retry: false, text: `Done: ${written.length} exit(s) written: ${list(written)}` };
}

/** One call of /api/auto-exit. Resolves with what happened (see readAnswer), never rejects. */
function callAutoExit() {
    return new Promise((resolve) => {
        // A refused connection to "localhost" has a code and no message (both of its addresses were tried)
        const notAnswered = (err) => resolve({ ok: false, retry: true, text: `The app did not answer: ${err.message || err.code || err}` });
        const req = http.get(`http://localhost:${PORT}/api/auto-exit`, { headers: { 'x-scheduler-key': schedulerKey() } }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve(readAnswer(res.statusCode, data)));
            res.on('error', notAnswered);
        });
        req.on('error', notAnswered);
    });
}

/** Local date and time for a log line: "2026-11-12 19:00:00" */
function stamp() {
    return new Date().toLocaleString('sv-SE');
}

/**
 * The daily run: the call, and again after a wait for as long as the answer asks for it. Resolves true when a run
 * ended well. `call` and `waitMs` can be replaced to try it without the app and without waiting.
 */
async function runWithRetries({ call = callAutoExit, retries = schedule.autoExitRetries, waitMs = schedule.autoExitRetryMinutes * 60000 } = {}) {
    for (let attempt = 1; ; attempt++) {
        const answer = await call();
        (answer.ok ? console.log : console.error)(`[Scheduler] ${stamp()} ${answer.text}`);
        if (answer.ok || !answer.retry) return answer.ok;
        if (attempt > retries) {
            console.error(`[Scheduler] ${stamp()} Giving up for today after ${attempt} tries: who is still in has no automatic exit.`);
            return false;
        }
        console.log(`[Scheduler] Trying again in ${Math.round(waitMs / 60000)} min (try ${attempt + 1} of ${retries + 1})`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
}

module.exports = { readAnswer, runWithRetries };

// Started by PM2 (node scripts/scheduler.js); a script that only requires this file starts nothing
if (require.main === module) {
    const cron = require('node-cron');
    // minute 0 of the hour, every day Mon–Sat (1–6)
    const cronExpression = `0 ${schedule.autoExitHour} * * 1-6`;
    if (!Number.isInteger(schedule.autoExitHour) || !cron.validate(cronExpression)) {
        console.error(`[Scheduler] autoExitHour in src/config/schedule.json must be a whole hour from 0 to 23, it is ${JSON.stringify(schedule.autoExitHour)}: nothing is scheduled`);
        process.exit(1);
    }

    console.log(`[Scheduler] Starting — auto-exit will run at ${schedule.autoExitHour}:00 Mon–Sat`);
    if (!authSecret()) console.error('[Scheduler] AUTH_SECRET not found: /api/auto-exit will refuse the call');

    cron.schedule(cronExpression, () => {
        console.log(`[Scheduler] ${stamp()} triggering auto-exit...`);
        void runWithRetries();
    });
}
