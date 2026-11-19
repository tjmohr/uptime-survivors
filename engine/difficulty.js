// Difficulty lookups (FR-016–FR-019). Pure functions over validated data.

export function levelDuration(data, level, levelSeconds) {
  return levelSeconds ?? data.difficulty[level - 1].durationSeconds;
}

// Time (seconds from run start) at which `level` ends.
export function levelEnd(data, level, levelSeconds) {
  let t = 0;
  for (let l = 1; l <= level; l++) t += levelDuration(data, l, levelSeconds);
  return t;
}

export function runLength(data, levelSeconds) {
  return levelEnd(data, data.difficulty.length, levelSeconds);
}

export function levelAt(data, elapsed, levelSeconds) {
  let t = 0;
  const count = data.difficulty.length;
  for (let l = 1; l <= count; l++) {
    t += levelDuration(data, l, levelSeconds);
    if (elapsed < t) return l;
  }
  return count;
}

export function rowFor(data, level) {
  return data.difficulty[level - 1];
}

export function debutsAt(data, level) {
  return data.enemies.filter((e) => e.debutLevel === level).map((e) => e.id);
}
