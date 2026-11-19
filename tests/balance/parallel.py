"""Runs a balance simulation's seeds in parallel and prints the verdict (feature 006).

usage (from the repository root):
    python3 tests/balance/parallel.py upgrades s1      # or s2, s3, s4
"""
import concurrent.futures as cf
import json
import os
import subprocess
import sys

JSC = "/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc"
SEEDS10 = [11, 23, 37, 41, 53, 67, 79, 83, 97, 101]
SEEDS20 = SEEDS10 + [113, 127, 131, 139, 149, 151, 157, 163, 167, 173]


def main():
    script, mode = sys.argv[1], sys.argv[2]
    path = f"tests/balance/{script}.mjs"
    seeds = SEEDS20 if mode == "s3" else SEEDS10

    def one(seed):
        r = subprocess.run([JSC, "-m", path, "--", mode, str(seed)], capture_output=True, text=True)
        rows = [l[4:] for l in r.stdout.splitlines() if l.startswith("ROW ")]
        if not rows:
            raise RuntimeError(f"seed {seed}: {r.stdout}{r.stderr}")
        return json.loads(rows[0])

    with cf.ThreadPoolExecutor(os.cpu_count() or 4) as ex:
        rows = list(ex.map(one, seeds))
    r = subprocess.run([JSC, "-m", path, "--", "verdict", mode, json.dumps(rows)], capture_output=True, text=True)
    print(r.stdout + r.stderr, end="")
    sys.exit(0 if "RESULT: PASS" in r.stdout else 1)


if __name__ == "__main__":
    main()
