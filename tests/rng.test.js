import { test, assert, assertEqual } from './harness.js';
import { createRng } from '../engine/rng.js';

const seq = (rng, n) => Array.from({ length: n }, () => rng.next());

test('rng: same seed gives the same 1,000-value sequence', () => {
  assertEqual(seq(createRng(12345), 1000), seq(createRng(12345), 1000));
});

test('rng: different seeds give different sequences', () => {
  const a = seq(createRng(1), 20);
  const b = seq(createRng(2), 20);
  assert(a.some((v, i) => v !== b[i]), 'sequences should differ');
});

test('rng: next() stays in [0, 1)', () => {
  const rng = createRng(99);
  for (let i = 0; i < 5000; i++) {
    const v = rng.next();
    assert(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test('rng: int(n) stays in [0, n) and is an integer', () => {
  const rng = createRng(7);
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const v = rng.int(5);
    assert(Number.isInteger(v) && v >= 0 && v < 5, `bad int: ${v}`);
    seen.add(v);
  }
  assertEqual(seen.size, 5, 'all values 0..4 should appear');
});

test('rng: pick returns list items', () => {
  const rng = createRng(3);
  const list = ['a', 'b', 'c'];
  for (let i = 0; i < 100; i++) assert(list.includes(rng.pick(list)));
});

test('rng: state() lets a sequence be reproduced mid-stream', () => {
  const a = createRng(42);
  seq(a, 10);
  const b = createRng(a.state(), { raw: true });
  assertEqual(seq(a, 10), seq(b, 10));
});
