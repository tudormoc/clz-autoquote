/**
 * Regression check for what a screen says when something fails (src/lib/utils.ts → errorMessage, faultKind): an error
 * the app raised itself keeps its text, a technical failure (database, network, file, a fault in the code) becomes a
 * plain sentence of it.ts and never shows the driver's own text. The errors are made up as their makers shape them.
 *
 *   npm run errors:examples
 */
import { queryErrorMessage } from '@/app/analytics/queries/shared/query-utils';
import { APP_CONFIG } from '@/config/constants';
import { AppFault, errorMessage, faultKind, technicalMessage } from '@/lib/utils';
import { APP_COPY, fmt } from '@/locales';

const faults = APP_COPY.errors.faults;

/** An error as a library makes it: its own class name, a code, a cause */
const made = (name: string, message: string, extra: Record<string, unknown> = {}) => Object.assign(new Error(message), { name, ...extra });

const sqlError = made('RequestError', "Invalid column name 'tb_descope'.", { code: 'EREQUEST', number: 207 });
const sqlTimeout = made('RequestError', 'Timeout: Request failed to complete in 15000ms', { code: 'ETIMEOUT' });
const sqlDown = made('ConnectionError', 'Failed to connect to 192.168.1.10:1433 - connect ECONNREFUSED', { code: 'ESOCKET' });
const sqlLogin = made('ConnectionError', "Login failed for user 'sa'.", { code: 'ELOGIN' });
const fileOpen = made('Error', "EBUSY: resource busy or locked, open '\\\\SERVER2019\\Office\\10 Produzione.xlsx'", { code: 'EBUSY', syscall: 'open' });
const fileGone = made('Error', 'ENOENT: no such file or directory', { code: 'ENOENT' });
const fetchFailed = Object.assign(new TypeError('fetch failed'), { cause: made('Error', 'connect ECONNREFUSED 192.168.1.20:80', { code: 'ECONNREFUSED' }) });
const actionBroke = Object.assign(new Error('An error occurred in the Server Components render.'), { digest: '1234567890' });

// The log is not what is checked here: the examples run quietly
console.error = () => undefined;

const EXAMPLES: { name: string; expected: unknown; actual: () => unknown }[] = [
    // The app's own refusals say their text
    { name: 'a text of the app is shown as it is', expected: APP_COPY.auth.notAllowed, actual: () => errorMessage(new Error(APP_COPY.auth.notAllowed)) },
    { name: 'something thrown that is no Error is shown as text', expected: 'testo', actual: () => errorMessage('testo') },
    { name: 'and is no technical failure', expected: null, actual: () => faultKind(new Error(APP_COPY.auth.sessionExpired)) },

    // The database
    { name: 'a statement SQL Server refused', expected: faults.database, actual: () => errorMessage(sqlError) },
    { name: 'a statement that took too long', expected: faults.timeout, actual: () => errorMessage(sqlTimeout) },
    { name: 'a server that does not answer', expected: faults.connection, actual: () => errorMessage(sqlDown) },
    { name: 'a login the server refused', expected: faults.connection, actual: () => errorMessage(sqlLogin) },
    { name: 'the driver\'s own text never reaches the screen', expected: false, actual: () => [sqlError, sqlTimeout, sqlDown, sqlLogin].some((error) => errorMessage(error).includes(error.message)) },

    // Files and the network
    { name: 'a file open in Excel', expected: faults.fileBusy, actual: () => errorMessage(fileOpen) },
    { name: 'a file that is not there', expected: faults.fileMissing, actual: () => errorMessage(fileGone) },
    { name: 'a server that refuses the connection (the cause carries the code)', expected: faults.connection, actual: () => errorMessage(fetchFailed) },

    // Faults in the code or the setup: the person is told whom to tell
    { name: 'a fault in the code', expected: fmt(faults.app, { name: APP_CONFIG.OWNER_NAME }), actual: () => errorMessage(new TypeError("Cannot read properties of undefined (reading 'x')")) },
    { name: 'a fault of the setup', expected: 'app', actual: () => faultKind(new AppFault('AUTH_SECRET missing or too short in .env.local')) },
    { name: 'a server action that broke (the browser gets no text, only a digest)', expected: 'app', actual: () => faultKind(actionBroke) },

    // Logs keep the cause
    { name: 'the log, the Registro and the scheduler get the text as it is', expected: sqlError.message, actual: () => technicalMessage(sqlError) },

    // Reports: a timeout keeps the advice of the report pages
    { name: 'a report that took too long says how to make it shorter', expected: APP_COPY.analytics.common.queryTimeout, actual: () => queryErrorMessage(sqlTimeout) },
    { name: 'a report that failed otherwise says what any screen says', expected: faults.database, actual: () => queryErrorMessage(sqlError) },
];

let failed = 0;
for (const { name, expected, actual } of EXAMPLES) {
    const want = JSON.stringify(expected);
    const got = JSON.stringify(actual());
    const pass = want === got;
    if (!pass) failed++;
    console.log(`${pass ? 'OK  ' : 'FAIL'} ${name}`);
    if (!pass) {
        console.log(`     expected ${want}`);
        console.log(`     actual   ${got}`);
    }
}
console.log(`\n${EXAMPLES.length - failed}/${EXAMPLES.length} examples pass`);
process.exit(failed > 0 ? 1 : 0);
