// Terminal test runner.
//   Node 18+:            node tests/run.mjs
//   macOS JavaScriptCore: jsc -m tests/run.mjs   (run from the repository root)
// Exits 0 only if at least one test ran and every test passed.
import { runAll } from './harness.js';
import { testFiles } from './files.js';

const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
const out = (line) => (typeof print === 'function' && !isNode ? print(line) : console.log(line));
const exit = (code) => {
  if (isNode) process.exit(code);
  else if (typeof quit === 'function') quit(code);
};

for (const file of testFiles) {
  await import(file);
}

const result = await runAll();
for (const f of result.failures) out(`FAIL  ${f.name}\n      ${f.message}`);
out(`\n${result.passed} passed, ${result.failed} failed, ${result.total} total`);
if (result.total === 0) out('No tests were found — counted as failure.');
out(result.ok ? 'RESULT: PASS' : 'RESULT: FAIL');
exit(result.ok ? 0 : 1);
