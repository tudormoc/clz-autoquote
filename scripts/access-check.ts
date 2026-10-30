/**
 * Access check (npm run access:check, part of npm run check): reads the source and fails when
 *   - a page (src/app/** /page.tsx) does not call requirePage / requireLogin (or render AreaOverview, which does),
 *   - a function exported by a 'use server' file does not start with authorize / requireSuperadmin / requireLogin,
 *     directly or through a helper of the same file (access-actions' run(), for one),
 *   - a route handler (src/app/api/** /route.ts) does not check who is calling (authorize / requireSuperadmin / getAccess),
 *   - anywhere in src/, an access check names a page by a literal link ('/presence/operators') instead of LINKS.*
 *     (src/config/navigation.ts), so that a page can move or be renamed in one place.
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
const ACTION_GUARDS = ['authorize', 'requireSuperadmin', 'requireLogin'];
const ROUTE_GUARDS = [...ACTION_GUARDS, 'getAccess'];

const problems: string[] = [];
let checked = { pages: 0, actions: 0, routes: 0, links: 0 };

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

/** The function starts with a guard: it calls one, or calls a helper of its file that calls one */
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
        if (!guarded(fn.body, ACTION_GUARDS, functions)) problems.push(`${rel(file)}: ${name} does not start with authorize / requireSuperadmin`);
    }
    for (const { name, from, file: sourceFile } of reExports(sf)) {
        checked.actions++;
        const target = sourceFile ? source(sourceFile) : sf;
        const targetFunctions = functionsOf(target);
        const fn = targetFunctions.get(from);
        if (!fn) problems.push(`${rel(file)}: ${name} re-exports ${from}, which is not a function this check can read`);
        else if (!guarded(fn.body, ACTION_GUARDS, targetFunctions)) problems.push(`${rel(file)}: ${name} (${from} in ${rel(target.fileName)}) does not start with authorize / requireSuperadmin`);
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

for (const file of walk(APP)) {
    if (NO_CHECK_NEEDED[rel(file)]) continue;
    if (/[\\/]page\.tsx$/.test(file)) checkPage(file);
    else if (/[\\/]api[\\/].*route\.ts$/.test(file)) checkRoute(file);
    else if (isUseServer(source(file))) checkActionFile(file);
}
for (const file of walk(SRC)) checkLinks(file);

if (problems.length > 0) {
    console.error(`Access check: ${problems.length} problem(s)\n` + problems.map((p) => `  - ${p}`).join('\n'));
    process.exit(1);
}
console.log(
    `Access check ok: ${checked.pages} pages, ${checked.actions} server actions, ${checked.routes} route handlers all check access; ${checked.links} checks name their page through LINKS.`
);
