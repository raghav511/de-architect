/* Every page script shares one global scope (classic scripts, no modules), so two files that declare the same top-level
   const, let or class stop the second file from loading at all, and the page fails without a test noticing.
   Usage: node tools/dup_globals.js   (exit code 1 when a name is declared in more than one script of index.html) */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const files = [...fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/<script[^>]*\bsrc="(js\/[\w.-]+\.js)/g)].map(m => m[1]);
const seen = {};
for (const f of files) for (const m of fs.readFileSync(path.join(root, f), 'utf8').matchAll(/^(?:const|let|var|function|async function|class)\s+([A-Za-z_$][\w$]*)/gm)) (seen[m[1]] = seen[m[1]] || new Set()).add(f);
const dup = Object.entries(seen).filter(([, s]) => s.size > 1);
dup.forEach(([k, s]) => console.log('DUPLICATE', k, [...s].join(', ')));
console.log(files.length + ' scripts, ' + Object.keys(seen).length + ' top-level names, ' + dup.length + ' declared twice');
process.exit(dup.length ? 1 : 0);
