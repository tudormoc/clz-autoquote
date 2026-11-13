/**
 * Lints the one file a Claude Code session has just edited, and hands the errors straight back to it.
 * Run by the hook in .claude/settings.json after every Edit or Write (the edit is described as JSON on standard input).
 * A file with errors ends with code 2: Claude Code then shows the session what is written here, so it fixes the file
 * at once instead of at the next full check. Only errors count (the rules of eslint.config.mjs); warnings wait for
 * the lint of the whole project. A file outside src, or not .ts / .tsx, is left alone.
 *
 *   echo {"tool_input":{"file_path":"src/app/page.tsx"}} | node scripts/lint-edited.js     to try it by hand
 */
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function readInput() {
    return new Promise((resolve) => {
        let text = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (chunk) => (text += chunk));
        process.stdin.on('end', () => resolve(text));
    });
}

async function main() {
    let edit;
    try {
        edit = JSON.parse(await readInput());
    } catch {
        return 0;
    }
    const given = edit?.tool_response?.filePath ?? edit?.tool_input?.file_path;
    if (typeof given !== 'string') return 0;

    const file = path.resolve(ROOT, given);
    const relative = path.relative(ROOT, file).split(path.sep).join('/');
    if (!relative.startsWith('src/') || !/\.tsx?$/.test(relative)) return 0;

    const { ESLint } = require('eslint');
    const eslint = new ESLint({ cwd: ROOT, errorOnUnmatchedPattern: false });
    if (await eslint.isPathIgnored(file)) return 0;
    const [result] = await eslint.lintFiles([file]);
    const errors = (result?.messages ?? []).filter((message) => message.severity === 2);
    if (errors.length === 0) return 0;

    const lines = errors.map((message) => `  ${relative}:${message.line}:${message.column}  ${message.message}`);
    process.stderr.write(
        `The lint refuses ${errors.length === 1 ? 'one thing' : `${errors.length} things`} in the file just edited (rules: eslint.config.mjs, the parts to use: README.md → Design system):\n` +
            `${lines.join('\n')}\n` +
            'Fix the file now, with the shared part each line names. Do not switch a rule off.\n'
    );
    return 2;
}

main().then(
    (code) => process.exit(code),
    (error) => {
        // A fault of this check must never stop a session from working
        process.stderr.write(`lint-edited could not run: ${error?.message ?? error}\n`);
        process.exit(0);
    }
);
