// Uniform spatial grid for collision queries (research.md R5).
// Entities are bucketed by their centre; callers pass a query radius that already
// includes the largest entity radius they care about, then do an exact distance check.

const OFFSET = 1 << 20;

export function createGrid(cellSize = 64) {
  const cells = new Map();
  const keyOf = (cx, cy) => (cx + OFFSET) * 2097152 + (cy + OFFSET);

  return {
    cellSize,
    clear() {
      cells.clear();
    },
    insert(entity) {
      const key = keyOf(Math.floor(entity.x / cellSize), Math.floor(entity.y / cellSize));
      let bucket = cells.get(key);
      if (!bucket) cells.set(key, (bucket = []));
      bucket.push(entity);
    },
    // Returns entities whose centre lies in any cell overlapping the circle's bounding box.
    queryCircle(x, y, r, out = []) {
      const x0 = Math.floor((x - r) / cellSize);
      const x1 = Math.floor((x + r) / cellSize);
      const y0 = Math.floor((y - r) / cellSize);
      const y1 = Math.floor((y + r) / cellSize);
      for (let cx = x0; cx <= x1; cx++) {
        for (let cy = y0; cy <= y1; cy++) {
          const bucket = cells.get(keyOf(cx, cy));
          if (bucket) for (const e of bucket) out.push(e);
        }
      }
      return out;
    },
  };
}
