"""Scripted browser checks for Uptime Survivors (quickstart.md M2–M9, F2–F7, F9).

Runs each smoke page in a fresh headless Chrome profile against a local static server it starts
itself. Each page reports its results by requesting /__result?d=<json>, which this script reads
from the server log. Exits 0 only if every reported check passed.

usage (from the repository root):
    python3 tests/browser/drive.py                 # milestone + roster + perf + motion checks
    python3 tests/browser/drive.py --full-run      # also the real-time 20-minute run (F4)
    python3 tests/browser/drive.py --only smoke2    # just one page
    python3 tests/browser/drive.py --chrome "/path/to/chrome"

These checks drive the game with synthetic key presses and, for long checks, make the engineer
invincible through a read-only debug handle. They complement, not replace, a human playthrough.
"""
import argparse
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT_CHROME = {
    "darwin": "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "linux": "google-chrome",
    "win32": r"C:\Program Files\Google\Chrome\Application\chrome.exe",
}.get(sys.platform, "google-chrome")

CHECKS = [
    ("tests/browser/smoke.html", [], 300),
    ("tests/browser/smoke2.html", [], 120),
    ("tests/browser/smoke3.html?mode=roster", [], 240),
    ("tests/browser/smoke3.html?mode=perf", [], 120),
    ("tests/browser/smoke3.html?mode=motion", [], 60),
    ("tests/browser/smoke3.html?mode=motion", ["--force-prefers-reduced-motion"], 60),
]
FULL_RUN = ("tests/browser/smoke3.html?mode=full", [], 1500)


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def run_page(chrome, base, log_path, page, extra, timeout):
    profile = tempfile.mkdtemp(prefix="uptime-chrome-")
    start = os.path.getsize(log_path)
    proc = subprocess.Popen(
        [chrome, "--headless=new", "--disable-gpu", f"--user-data-dir={profile}", "--window-size=1400,1000",
         "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
         "--disable-backgrounding-occluded-windows", *extra, f"{base}/{page}"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    deadline = time.time() + timeout
    try:
        while time.time() < deadline:
            time.sleep(1)
            with open(log_path, encoding="utf-8", errors="replace") as f:
                f.seek(start)
                text = f.read()
            marker = text.rfind("GET /__result?d=")
            if marker != -1:
                raw = text[marker + len("GET /__result?d="):].split(" HTTP/")[0]
                return json.loads(urllib.parse.unquote(raw))
        return {"error": f"no result within {timeout} s"}
    finally:
        proc.kill()
        proc.wait()
        shutil.rmtree(profile, ignore_errors=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chrome", default=DEFAULT_CHROME)
    ap.add_argument("--full-run", action="store_true", help="also run the real-time 20-minute check (F4)")
    ap.add_argument("--only", help="run only pages whose path contains this text, e.g. smoke2")
    args = ap.parse_args()

    port = free_port()
    log = tempfile.NamedTemporaryFile(prefix="uptime-server-", suffix=".log", delete=False)
    server = subprocess.Popen([sys.executable, "-u", "-m", "http.server", str(port), "--bind", "127.0.0.1"],
                              cwd=ROOT, stdout=log, stderr=log)
    time.sleep(1)
    ok = True
    try:
        checks = CHECKS + ([FULL_RUN] if args.full_run else [])
        if args.only:
            checks = [c for c in checks if args.only in c[0]]
        for page, extra, timeout in checks:
            label = page + (" " + " ".join(extra) if extra else "")
            result = run_page(args.chrome, f"http://127.0.0.1:{port}", log.name, page, extra, timeout)
            print(f"\n== {label}")
            for name, value in result.items():
                if isinstance(value, dict) and "pass" in value:
                    ok &= bool(value["pass"])
                    print(f"  {'PASS' if value['pass'] else 'FAIL'} {name}: {value['note']}")
                elif name == "error":
                    ok = False
                    print(f"  ERROR: {value}")
                elif name == "F9":
                    expect_reduced = "--force-prefers-reduced-motion" in extra
                    passed = value["reducedMotion"] == expect_reduced and (
                        (value["maxParticles"] == 0 and value["maxFlash"] == 0) if expect_reduced
                        else (value["maxParticles"] > 0 and value["maxFlash"] > 0))
                    ok &= passed
                    print(f"  {'PASS' if passed else 'FAIL'} F9 (reduced motion {'on' if expect_reduced else 'off'}): {value}")
                elif name != "mode":
                    print(f"  {name}: {value}")
    finally:
        server.kill()
        server.wait()
        os.unlink(log.name)
    print("\nRESULT:", "PASS" if ok else "FAIL")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
