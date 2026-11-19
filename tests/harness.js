// Minimal dependency-free test harness shared by tests/index.html (browser)
// and tests/run.mjs (Node 18+ or the JavaScriptCore `jsc` shell).

const registry = [];

export function test(name, fn) {
  registry.push({ name, fn });
}

function fmt(v) {
  try { return JSON.stringify(v); } catch { return String(v); }
}

function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual(a[k], b[k]));
}

export function assert(cond, message = 'assertion failed') {
  if (!cond) throw new Error(message);
}

export function assertEqual(actual, expected, message = '') {
  if (!deepEqual(actual, expected)) {
    throw new Error(`${message ? message + ': ' : ''}expected ${fmt(expected)}, got ${fmt(actual)}`);
  }
}

export function assertApprox(actual, expected, tolerance = 1e-6, message = '') {
  if (typeof actual !== 'number' || Math.abs(actual - expected) > tolerance) {
    throw new Error(`${message ? message + ': ' : ''}expected ≈${expected} (±${tolerance}), got ${actual}`);
  }
}

export function assertThrows(fn, message = 'expected function to throw') {
  let threw = false;
  try { fn(); } catch { threw = true; }
  if (!threw) throw new Error(message);
}

// Reads a repository file (path relative to the repo root) in any supported runtime.
export async function readSource(path) {
  if (typeof readFile === 'function' && typeof URL === 'undefined') {
    // JavaScriptCore shell: no URL class; resolve against this file's location by hand.
    const here = decodeURIComponent(String(import.meta.url).replace(/^file:\/\//, ''));
    return readFile(here.replace(/tests\/harness\.js$/, '') + path);
  }
  const url = new URL('../' + path, import.meta.url);
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    const fs = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    return fs.readFileSync(fileURLToPath(url), 'utf8');
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`could not load ${path}: HTTP ${res.status}`);
  return res.text();
}

let cachedData = null;
export async function loadGameData() {
  if (!cachedData) cachedData = await readSource('data/game.json');
  return JSON.parse(cachedData); // fresh copy for every caller
}

export async function runAll() {
  const failedNames = [];
  const failures = [];
  let passed = 0;
  for (const { name, fn } of registry) {
    try {
      await fn();
      passed++;
    } catch (err) {
      failedNames.push(name);
      failures.push({ name, message: err && err.message ? err.message : String(err) });
    }
  }
  const total = registry.length;
  // Zero discovered tests is a failure, never a pass.
  const ok = total > 0 && failedNames.length === 0;
  return { ok, total, passed, failed: failedNames.length, failedNames, failures };
}
