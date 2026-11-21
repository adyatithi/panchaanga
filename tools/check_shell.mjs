// node tools/check_shell.mjs [app-dir]: every module the app loads is in the service worker's
// SHELL (so the app opens offline), and everything in SHELL exists. Run before publishing.
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2] || path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const sw = fs.readFileSync(path.join(dir, 'sw.js'), 'utf8');
const shell = new Set([...sw.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]));

// The modules reachable from js/app.js by static imports.
const seen = new Set();
const walk = (file) => {
  if (seen.has(file)) return;
  seen.add(file);
  const src = fs.readFileSync(path.join(dir, file), 'utf8');
  for (const m of src.matchAll(/(?:^|\n)\s*import\s[^;]*?from\s+'(\.[^']+)'/g)) walk(path.posix.join(path.posix.dirname(file), m[1]));
};
walk('js/app.js');

const problems = [];
for (const f of seen) if (!shell.has(f)) problems.push(`not in SHELL: ${f}`);
for (const f of fs.readdirSync(path.join(dir, 'js'))) if (f.endsWith('.js') && !shell.has(`js/${f}`)) problems.push(`not in SHELL: js/${f}`);
for (const f of shell) if (f !== './' && !fs.existsSync(path.join(dir, f))) problems.push(`in SHELL but missing: ${f}`);
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`shell: ${shell.size} entries, ${seen.size} modules, all present`);
