/**
 * Server-side NetPro web session (QualitasWebClient / SFCClient on the NetPro host).
 *
 * The NetPro report service (SFCClient getPDFReport) redirects to the login page when there is no
 * session. This helper logs in with a stored service account (NETPRO_WEB_USER / NETPRO_WEB_PASSWORD
 * in .env.local), keeps the session cookies in memory and logs in again automatically when they expire.
 */
import { APP_CONFIG } from '@/config/constants';

let cookieJar = new Map<string, string>();
let loginInFlight: Promise<void> | null = null;

const reportUrl = new URL(APP_CONFIG.REPORTS.NETPRO_PDF_ENDPOINT);
const LOGIN_URL = `${reportUrl.origin}/QualitasWebClient/Account/Login`;

const cookieHeader = () => Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');

function storeCookies(res: Response) {
    const setCookies = typeof res.headers.getSetCookie === 'function'
        ? res.headers.getSetCookie()
        : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie') as string] : []);
    for (const sc of setCookies) {
        const [pair] = sc.split(';');
        const eq = pair.indexOf('=');
        if (eq > 0) cookieJar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
}

/** True when NetPro answered with its login page instead of the requested resource */
export const isNetproLoginPage = (text: string) => /Account\/Login/i.test(text);

/** Fetch with the session cookies, following redirects manually so every Set-Cookie is kept */
async function fetchWithJar(url: string, init: RequestInit = {}, hops = 5): Promise<Response> {
    let current = url;
    let options: RequestInit = init;
    for (let i = 0; i <= hops; i++) {
        const res = await fetch(current, {
            ...options,
            redirect: 'manual',
            cache: 'no-store',
            headers: { ...(options.headers || {}), ...(cookieJar.size ? { Cookie: cookieHeader() } : {}) },
        });
        storeCookies(res);
        const location = res.headers.get('location');
        if (res.status >= 300 && res.status < 400 && location) {
            current = new URL(location, current).toString();
            options = { method: 'GET' }; // redirects after a POST continue as GET
            continue;
        }
        return res;
    }
    throw new Error('NetPro: troppi redirect');
}

async function login() {
    const user = process.env.NETPRO_WEB_USER;
    // An empty password is allowed (NetPro users can have none): the line just has to exist
    const password = process.env.NETPRO_WEB_PASSWORD;
    if (!user || password === undefined) {
        throw new Error('Credenziali NetPro non configurate: impostare NETPRO_WEB_USER e NETPRO_WEB_PASSWORD in .env.local');
    }
    cookieJar = new Map();
    // Load the login page first (session cookie), then post the form like the browser does
    await fetchWithJar(LOGIN_URL);
    const body = new URLSearchParams({
        UserName: user,
        Password: password,
        keyboard: 'false',
        lang_list: 'it-IT',
        Language: 'it-IT',
        RedirectTo: '',
    });
    const res = await fetchWithJar(LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });
    const html = await res.text();
    // Still on the login form → wrong credentials / login refused
    if (/id="signupform"/i.test(html)) {
        cookieJar = new Map();
        throw new Error('Login NetPro non riuscito: verificare NETPRO_WEB_USER / NETPRO_WEB_PASSWORD');
    }
}

async function ensureLogin(force = false) {
    if (!force && cookieJar.size > 0) return;
    if (!loginInFlight) {
        loginInFlight = login().finally(() => { loginInFlight = null; });
    }
    await loginInFlight;
}

/**
 * GET a NetPro web resource with the service session.
 * Re-logs in once if NetPro answers with its login page (expired session).
 */
export async function netproAuthenticatedGet(url: string): Promise<ArrayBuffer> {
    for (let attempt = 0; attempt < 2; attempt++) {
        await ensureLogin(attempt > 0);
        const res = await fetchWithJar(url, { headers: { Accept: 'application/pdf, text/html, */*' } });
        if (!res.ok) throw new Error(`NetPro report service responded with status ${res.status}`);
        const buffer = await res.arrayBuffer();
        const head = new TextDecoder().decode(buffer.slice(0, 600));
        if (!isNetproLoginPage(head)) return buffer;
        cookieJar = new Map(); // session expired → log in again and retry once
    }
    throw new Error('Il servizio report di NetPro richiede il login e il login automatico non è riuscito.');
}
