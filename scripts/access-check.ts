/**
 * Access check (npm run access:check, part of npm run check): reads the source and fails when
 *   - a page (src/app/** /page.tsx) does not call requirePage / requireLogin (or render AreaOverview, which does),
 *   - a function exported by a 'use server' file does not START with authorize / requireSuperadmin / requireLogin /
 *     superadminRefusal, directly or through a helper of the same file (person-actions' guarded(), for one): nothing
 *     that was sent may be looked at before the check, only which page is meant (PAGE_LOOKUPS),
 *   - a route handler (src/app/api/** /route.ts) does not check who is calling (authorize / requireSuperadmin / getAccess),
 *   - anywhere in src/, an access check names a page by a literal link ('/presence/operators') instead of LINKS.*
 *     (src/config/navigation.ts), so that a page can move or be renamed in one place,
 *   - anywhere in src/, a list of a Zod schema (z.array, z.set, z.map) has no maximum: with one, a list that is too
 *     long is refused at once, without one every element of it is checked first (owner, 2026-11-11).
 * A re-export (`export const x = xImpl`) is checked where xImpl is defined.
 * Pages and files that need no check are listed in NO_CHECK_NEEDED, with the reason.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const APP = path.join(SRC, 'app');

/** Calls that take a page or function link: the link must come from LINKS / WORK_PROGRESS_FUNCTIONS */
const LINK_TAKERS = ['authorize', 'canOpen', 'canUse', 'useCanUse'];

/** Pages and files that are public or check access in their own way */
const NO_CHECK_NEEDED: Record<string, string> = {
    'src/app/login/page.tsx': 'the login itself',
    'src/app/blueprint/page.tsx': 'a window of the quote form, no data of its own (the login cookie is still required by src/proxy.ts)',
    'src/app/auth-actions.ts': 'login, logout and "Cambia PIN": they check the person themselves',
};

const PAGE_GUARDS = ['requirePage', 'requireLogin'];
const ACTION_GUARDS = ['authorize', 'requireSuperadmin', 'requireLogin', 'superadminRefusal'];
/** Guards that answer `{ success: false, error }` instead of failing: the action returns that answer on the next line */
const ANSWERING_GUARDS = ['superadminRefusal'];
/** What an action may call before its access check: only what tells which page the check is about */
const PAGE_LOOKUPS = ['editableTable'];
const ROUTE_GUARDS = [...ACTION_GUARDS, 'getAccess'];

/** The lists of a Zod schema, and the calls that say how long each may be */
const LIST_LIMITS: Record<string, string[]> = { array: ['max', 'length'], set: ['max', 'size'], map: ['max', 'size'] };
/** Files whose z.record (which cannot carry a maximum) is limited in another way */
const RECORD_LIMITED: Record<string, string> = {
    'src/app/admin-actions.ts': 'tooManyFields counts the fields before the schema looks at them',
};

const problems: string[] = [];
let checked = { pages: 0, actions: 0, routes: 0, links: 0, lists: 0 };

const rel = (file: string) => path.relative(ROOT, file).split(path.sep).join('/');

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
    return out;
}

const sources = new Map<string, ts.SourceFile>();
function source(file: string): ts.SourceFile {
    let sf = sources.get(file);
    if (!sf) {
        sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
        sources.set(file, sf);
    }
    return sf;
}

/** Names called anywhere inside the node (`authorize(...)`, `run(...)`) */
function calledNames(node: ts.Node, into = new Set<string>()): Set<string> {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) into.add(node.expression.text);
    ts.forEachChild(node, (child) => {
        calledNames(child, into);
    });
    return into;
}

/** JSX elements rendered anywhere inside the node (`<AreaOverview … />`) */
function renderedNames(node: ts.Node, into = new Set<string>()): Set<string> {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ts.isIdentifier(node.tagName)) into.add(node.tagName.text);
    ts.forEachChild(node, (child) => {
        renderedNames(child, into);
    });
    return into;
}

const isUseServer = (sf: ts.SourceFile) => {
    const first = sf.statements[0];
    return !!first && ts.isExpressionStatement(first) && ts.isStringLiteral(first.expression) && first.expression.text === 'use server';
};

const hasExport = (node: ts.Node) => ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

/** Every function of the file by name: declarations and `const f = async () => …` */
function functionsOf(sf: ts.SourceFile): Map<string, { body: ts.Node; exported: boolean }> {
    const found = new Map<string, { body: ts.Node; exported: boolean }>();
    for (const statement of sf.statements) {
        if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) {
            found.set(statement.name.text, { body: statement.body, exported: hasExport(statement) });
        } else if (ts.isVariableStatement(statement)) {
            for (const declaration of statement.declarationList.declarations) {
                const init = declaration.initializer;
                if (ts.isIdentifier(declaration.name) && init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
                    found.set(declaration.name.text, { body: init.body, exported: hasExport(statement) });
                }
            }
        }
    }
    return found;
}

/** `export const x = y`: y and the file it is imported from (undefined when y is declared here) */
function reExports(sf: ts.SourceFile): { name: string; from: string; file?: string }[] {
    const imports = new Map<string, { file: string; name: string }>();
    for (const statement of sf.statements) {
        if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
        const bindings = statement.importClause?.namedBindings;
        if (!bindings || !ts.isNamedImports(bindings)) continue;
        const spec = statement.moduleSpecifier.text;
        const base = spec.startsWith('@/') ? path.join(ROOT, 'src', spec.slice(2)) : path.resolve(path.dirname(sf.fileName), spec);
        const file = ['.ts', '.tsx'].map((ext) => base + ext).find((candidate) => fs.existsSync(candidate));
        if (!file) continue;
        for (const element of bindings.elements) imports.set(element.name.text, { file, name: (element.propertyName ?? element.name).text });
    }
    const found: { name: string; from: string; file?: string }[] = [];
    for (const statement of sf.statements) {
        if (!ts.isVariableStatement(statement) || !hasExport(statement)) continue;
        for (const declaration of statement.declarationList.declarations) {
            const init = declaration.initializer;
            if (ts.isIdentifier(declaration.name) && init && ts.isIdentifier(init)) {
                const imported = imports.get(init.text);
                found.push({ name: declaration.name.text, from: imported?.name ?? init.text, file: imported?.file });
            }
        }
    }
    return found;
}

const lineOf = (node: ts.Node) => node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1;

/** The statements of a function body in the order they run; a `try { … }` counts as the statements inside it */
function statementsOf(body: ts.Node): ts.Node[] {
    if (!ts.isBlock(body)) return [body]; // `async () => run(…)`: the expression itself
    return body.statements.flatMap((statement) => (ts.isTryStatement(statement) ? statementsOf(statement.tryBlock) : [statement]));
}

/** The function a statement calls first: `await x(…)`, `const a = await x(…)`, `return x(…)`, `x(…)`; null for anything else */
function leadingCall(node: ts.Node): string | null {
    let expr: ts.Node | undefined = node;
    if (ts.isExpressionStatement(node) || ts.isReturnStatement(node)) expr = node.expression;
    else if (ts.isVariableStatement(node)) expr = node.declarationList.declarations.length === 1 ? node.declarationList.declarations[0].initializer : undefined;
    while (expr && (ts.isAwaitExpression(expr) || ts.isParenthesizedExpression(expr))) expr = expr.expression;
    return expr && ts.isCallExpression(expr) && ts.isIdentifier(expr.expression) ? expr.expression.text : null;
}

/** Whether the node does more than name a page: any call, `new` or `await` other than a PAGE_LOOKUPS call */
function doesWork(node: ts.Node): boolean {
    if (ts.isCallExpression(node) && !(ts.isIdentifier(node.expression) && PAGE_LOOKUPS.includes(node.expression.text))) return true;
    if (ts.isNewExpression(node) || ts.isAwaitExpression(node)) return true;
    return ts.forEachChild(node, doesWork) ?? false;
}

/** `const refusal = await superadminRefusal();` followed by `if (refusal) return refusal;` */
function returnsAnswer(statement: ts.Node, next: ts.Node | undefined): boolean {
    if (!ts.isVariableStatement(statement) || !next || !ts.isIfStatement(next)) return false;
    const name = statement.declarationList.declarations[0].name;
    const then = ts.isBlock(next.thenStatement) ? next.thenStatement.statements[0] : next.thenStatement;
    const isName = (node: ts.Node | undefined) => !!node && ts.isIdentifier(node) && ts.isIdentifier(name) && node.text === name.text;
    return isName(next.expression) && !!then && ts.isReturnStatement(then) && isName(then.expression);
}

/**
 * What is wrong with where a server action checks access, null when the check is the first thing it does: directly,
 * or through a helper of its file that starts with it. Before the check only a page lookup may happen.
 */
function accessProblem(body: ts.Node, functions: Map<string, { body: ts.Node }>, seen = new Set<ts.Node>()): string | null {
    if (seen.has(body)) return 'does not check access';
    seen.add(body);
    const statements = statementsOf(body);
    for (const [index, statement] of statements.entries()) {
        const call = leadingCall(statement);
        if (call && ANSWERING_GUARDS.includes(call)) return returnsAnswer(statement, statements[index + 1]) ? null : `does not return the answer of ${call} on the next line (line ${lineOf(statement)})`;
        if (call && ACTION_GUARDS.includes(call)) return null;
        const helper = call ? functions.get(call) : undefined;
        if (helper && accessProblem(helper.body, functions, seen) === null) return null;
        if (doesWork(statement)) return `looks at what was sent before its access check (line ${lineOf(statement)}): start with authorize / requireSuperadmin / superadminRefusal`;
    }
    return 'does not check access (authorize / requireSuperadmin)';
}

/** The function checks who is calling somewhere: it calls a guard, or a helper of its file that calls one */
function guarded(body: ts.Node, guards: string[], helpers: Map<string, { body: ts.Node }>): boolean {
    const calls = calledNames(body);
    if (guards.some((guard) => calls.has(guard))) return true;
    return [...calls].some((name) => {
        const helper = helpers.get(name);
        return !!helper && guards.some((guard) => calledNames(helper.body).has(guard));
    });
}

function checkPage(file: string) {
    checked.pages++;
    const sf = source(file);
    const calls = calledNames(sf);
    if (PAGE_GUARDS.some((guard) => calls.has(guard)) || renderedNames(sf).has('AreaOverview')) return;
    problems.push(`${rel(file)}: the page does not call requirePage / requireLogin`);
}

function checkActionFile(file: string) {
    const sf = source(file);
    const functions = functionsOf(sf);
    for (const [name, fn] of functions) {
        if (!fn.exported) continue;
        checked.actions++;
        const problem = accessProblem(fn.body, functions);
        if (problem) problems.push(`${rel(file)}: ${name} ${problem}`);
    }
    for (const { name, from, file: sourceFile } of reExports(sf)) {
        checked.actions++;
        const target = sourceFile ? source(sourceFile) : sf;
        const targetFunctions = functionsOf(target);
        const fn = targetFunctions.get(from);
        const problem = fn ? accessProblem(fn.body, targetFunctions) : null;
        if (!fn) problems.push(`${rel(file)}: ${name} re-exports ${from}, which is not a function this check can read`);
        else if (problem) problems.push(`${rel(file)}: ${name} (${from} in ${rel(target.fileName)}) ${problem}`);
    }
}

function checkRoute(file: string) {
    const sf = source(file);
    const functions = functionsOf(sf);
    for (const [name, fn] of functions) {
        if (!fn.exported) continue;
        checked.routes++;
        if (!guarded(fn.body, ROUTE_GUARDS, functions)) problems.push(`${rel(file)}: ${name} does not check who is calling (authorize / requireSuperadmin / getAccess)`);
    }
}

/** Every access check of the file names its page through LINKS, never as a literal link */
function checkLinks(file: string) {
    const sf = source(file);
    const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && LINK_TAKERS.includes(node.expression.text)) {
            checked.links++;
            const literal = node.arguments.find((arg) => ts.isStringLiteral(arg) && arg.text.startsWith('/'));
            if (literal) {
                const { line } = sf.getLineAndCharacterOfPosition(literal.getStart(sf));
                problems.push(`${rel(file)}:${line + 1}: ${node.expression.text} names a page by its link ${literal.getText(sf)}: use LINKS from src/config/navigation.ts`);
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
}

/** The methods chained on a call: `z.array(x).min(1).max(7)` → ['min', 'max'] */
function chainedCalls(call: ts.Node): string[] {
    const names: string[] = [];
    let node = call;
    while (ts.isPropertyAccessExpression(node.parent) && node.parent.expression === node && ts.isCallExpression(node.parent.parent) && node.parent.parent.expression === node.parent) {
        names.push(node.parent.name.text);
        node = node.parent.parent;
    }
    return names;
}

/** Every list of a Zod schema in the file says how long it may be, where it is written */
function checkLists(file: string) {
    const sf = source(file);
    const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression) && node.expression.expression.text === 'z') {
            const kind = node.expression.name.text;
            const limits = LIST_LIMITS[kind];
            if (limits) {
                checked.lists++;
                if (!chainedCalls(node).some((name) => limits.includes(name))) problems.push(`${rel(file)}:${lineOf(node)}: z.${kind}(…) has no maximum: add .max(n) right on it, so a list that is too long is refused at once`);
            } else if (kind === 'record' && !RECORD_LIMITED[rel(file)]) {
                problems.push(`${rel(file)}:${lineOf(node)}: z.record(…) cannot carry a maximum: count its fields before the schema and list the file in RECORD_LIMITED`);
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);
}

for (const file of walk(APP)) {
    if (NO_CHECK_NEEDED[rel(file)]) continue;
    if (/[\\/]page\.tsx$/.test(file)) checkPage(file);
    else if (/[\\/]api[\\/].*route\.ts$/.test(file)) checkRoute(file);
    else if (isUseServer(source(file))) checkActionFile(file);
}
for (const file of walk(SRC)) {
    checkLinks(file);
    checkLists(file);
}

if (problems.length > 0) {
    console.error(`Access check: ${problems.length} problem(s)\n` + problems.map((p) => `  - ${p}`).join('\n'));
    process.exit(1);
}
console.log(
    `Access check ok: ${checked.pages} pages, ${checked.actions} server actions, ${checked.routes} route handlers all check access, the actions before anything else; ` +
        `${checked.links} checks name their page through LINKS; ${checked.lists} lists of the schemas have a maximum.`
);
