"""Touch / mobile checks T1–T10 (specs/003-mobile-touch/quickstart.md), driven over the DevTools
Protocol with trusted touches (see cdp.py). Each check gets a fresh Chrome and returns
{name: {"pass": bool, "note": str}}. Run through drive.py (`--only touch`).
"""
import json
import time

PHONE = (390, 844)
GAME = "__uptimeSurvivors"


# ---------------------------------------------------------------- helpers
def load(c, base, query="seed=5", size=PHONE, mobile=True, touch=True):
    c.set_device(size[0], size[1], mobile=mobile, dpr=2 if mobile else 1, touch=touch)
    c.navigate(f"{base}/index.html?{query}")
    c.wait_for(f"!!(window.{GAME} && {GAME}.data && document.querySelector('#overlay button'))", 15)


def center(c, selector):
    r = c.evaluate(f"""(() => {{ const el = document.querySelector({json.dumps(selector)});
      if (!el) return null; const b = el.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }})()""")
    if r is None:
        raise RuntimeError(f"no element {selector}")
    return r


def button_center(c, text):
    r = c.evaluate(f"""(() => {{ const el = [...document.querySelectorAll('#overlay button')]
      .find((b) => b.textContent.trim() === {json.dumps(text)});
      if (!el) return null; const b = el.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }})()""")
    if r is None:
        raise RuntimeError(f"no button {text!r}")
    return r


def phase(c):
    return c.evaluate(f"{GAME}.run ? {GAME}.run.phase : null")


def start_by_tap(c):
    x, y = center(c, "#overlay button")
    c.tap(x, y)
    c.wait_for(f"{GAME}.run && {GAME}.run.phase === 'playing'", 5)


def invincible(c):
    c.evaluate(f"(() => {{ const e = {GAME}.run.engineer; e.maxUptime = 1e12; e.uptime = 1e12; }})()")


def force_levelup(c):
    c.evaluate(f"""import('/engine/progression.js').then(({{ addTelemetry }}) => {{
      const r = {GAME}.run; addTelemetry(r, r.engineer.telemetryToNext - r.engineer.telemetry); }})""")
    c.wait_for(f"{GAME}.run.phase === 'levelup' && document.querySelectorAll('#overlay .choice').length > 0", 5)


def guard_ready(c):
    c.wait_for("!document.getElementById('overlay').classList.contains('guard-wait')", 5)


def result(passed, note):
    return {"pass": bool(passed), "note": note}


# ---------------------------------------------------------------- T1 touch mode
def check_touch_mode(c, base):
    notes, ok = [], True

    def expect(cond, text):
        nonlocal ok
        ok &= bool(cond)
        notes.append(("ok " if cond else "FAIL ") + text)

    load(c, base)
    expect(c.evaluate("document.body.classList.contains('touch')"), "phone: touch mode on at load")
    expect("Steer: touch and drag" in c.evaluate("document.querySelector('.controls').textContent"),
           "phone: title shows touch controls")
    start_by_tap(c)
    vis = c.evaluate("""[...document.querySelectorAll('.touch-btn')].map((b) => { const r = b.getBoundingClientRect();
      return { id: b.id, shown: r.width >= 44 && r.height >= 44 && r.right <= innerWidth && r.bottom <= innerHeight }; })""")
    expect(all(v["shown"] for v in vis) and len(vis) == 2, f"phone: Pause and Sound buttons shown, ≥ 44 px ({vis})")

    # Desktop, never touched: looks exactly like features 001–002.
    load(c, base, size=(1280, 800), mobile=False, touch=False)
    expect(not c.evaluate("document.body.classList.contains('touch')"), "desktop: touch mode off at load")
    expect("WASD" in c.evaluate("document.querySelector('.controls').textContent"), "desktop: keyboard controls on title")
    c.evaluate("document.querySelector('#overlay button').click()")
    c.wait_for(f"{GAME}.run && {GAME}.run.phase === 'playing'", 5)
    time.sleep(2)
    hidden = c.evaluate("[...document.querySelectorAll('.touch-btn')].every((b) => b.getBoundingClientRect().width === 0)")
    expect(hidden and not c.evaluate("document.body.classList.contains('touch')"),
           "desktop: no touch buttons during a run without a touch")
    # First touch switches touch mode on.
    c.send("Emulation.setTouchEmulationEnabled", {"enabled": True, "maxTouchPoints": 5})
    c.tap(640, 600)
    time.sleep(0.2)
    shown = c.evaluate("[...document.querySelectorAll('.touch-btn')].every((b) => b.getBoundingClientRect().width >= 44)")
    expect(c.evaluate("document.body.classList.contains('touch')") and shown, "desktop: first touch turns touch mode on")
    return {"T1": result(ok, "; ".join(notes))}


# ---------------------------------------------------------------- T2 steering
STEER_PROBE = """window.__probe = { move: 0, up: 0, down: false };
addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') { __probe.down = true; __probe.move = 0; } }, true);
addEventListener('pointermove', (e) => { if (e.pointerType === 'touch' && __probe.down && !__probe.move) __probe.move = performance.now(); }, true);
addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') __probe.up = performance.now(); }, true);"""

# Frame log: every animation frame records [time, engineer x, engineer y] for 3 s, so latency is measured
# inside the page, not across protocol round-trips.
FRAME_LOG = f"""window.__frames = []; (() => {{ const t0 = performance.now(); const tick = (t) => {{
  __frames.push([performance.now(), {GAME}.run.engineer.x, {GAME}.run.engineer.y]);
  if (performance.now() - t0 < 3000) requestAnimationFrame(tick); }}; requestAnimationFrame(tick); }})()"""
# ms from the first drag movement to the first frame where the engineer has moved.
MOVE_LATENCY = """(() => { const f = __frames, t = __probe.move; for (let i = 1; i < f.length; i++) {
  if (f[i][0] >= t && (f[i][1] !== f[i - 1][1] || f[i][2] !== f[i - 1][2])) return f[i][0] - t; } return -1; })()"""

WAIT_STOPPED = f"""new Promise((resolve) => {{
  const e = {GAME}.run.engineer; let last = [e.x, e.y]; let still = 0; const t0 = performance.now();
  const tick = () => {{
    const now = [e.x, e.y]; still = (now[0] === last[0] && now[1] === last[1]) ? still + 1 : 0; last = now;
    if (still >= 2) return resolve(performance.now() - __probe.up);
    if (performance.now() - t0 > 2000) return resolve(-1);
    requestAnimationFrame(tick);
  }}; requestAnimationFrame(tick); }})"""


def check_steering(c, base):
    notes, ok = [], True

    def expect(cond, text):
        nonlocal ok
        ok &= bool(cond)
        notes.append(("ok " if cond else "FAIL ") + text)

    load(c, base)
    start_by_tap(c)
    invincible(c)
    c.evaluate(STEER_PROBE)
    c.evaluate(FRAME_LOG)
    x0, y0 = 195, 600
    c.touch("touchStart", [(x0, y0, 1)])
    time.sleep(0.15)
    expect(c.evaluate("document.getElementById('joystick').classList.contains('active')"), "joystick shown at touch")
    still = c.evaluate(f"[{GAME}.run.engineer.x, {GAME}.run.engineer.y]")
    time.sleep(0.1)
    expect(still == c.evaluate(f"[{GAME}.run.engineer.x, {GAME}.run.engineer.y]"), "no movement before dragging")
    # Drag to 30° (screen y grows downward, so +30° is down-right), 60 px.
    import math
    a = math.radians(30)
    for i in range(1, 7):
        c.touch("touchMove", [(x0 + math.cos(a) * 10 * i, y0 + math.sin(a) * 10 * i, 1)])
    time.sleep(0.3)
    latency = c.evaluate(MOVE_LATENCY)
    time.sleep(0.3)
    t0 = c.evaluate(f"[{GAME}.run.tick, {GAME}.run.engineer.x, {GAME}.run.engineer.y]")
    time.sleep(0.5)
    t1 = c.evaluate(f"[{GAME}.run.tick, {GAME}.run.engineer.x, {GAME}.run.engineer.y, {GAME}.run.engineer.facing, {GAME}.run.engineer.moveSpeed]")
    ticks = t1[0] - t0[0]
    speed = math.hypot(t1[1] - t0[1], t1[2] - t0[2]) / (ticks / 60) if ticks else 0
    facing = math.degrees(t1[3])
    expect(0 <= latency <= 100, f"moving {latency:.0f} ms after the drag (≤ 100)")
    expect(abs(facing - 30) <= 2, f"heading {facing:.1f}° (30 ± 2)")
    expect(abs(speed - t1[4]) <= 0.01 * t1[4], f"speed {speed:.1f} u/s = moveSpeed {t1[4]}")
    # Second finger anywhere changes nothing.
    end = (x0 + math.cos(a) * 60, y0 + math.sin(a) * 60)
    c.touch("touchMove", [(end[0], end[1], 1), (80, 200, 2)])
    for i in range(5):
        c.touch("touchMove", [(end[0], end[1], 1), (80 - i * 10, 200 + i * 60, 2)])
    time.sleep(0.2)
    facing2 = math.degrees(c.evaluate(f"{GAME}.run.engineer.facing"))
    expect(abs(facing2 - 30) <= 2, f"second finger ignored (heading {facing2:.1f}°)")
    c.touch("touchEnd", [(40, 440, 2)])  # lift finger 2 only (touchEnd lists the lifted points)
    # Lift → stops, joystick hidden.
    c.touch("touchEnd", [])
    stop = c.evaluate(WAIT_STOPPED)
    expect(0 <= stop <= 100, f"stopped {stop:.0f} ms after lifting (≤ 100)")
    expect(not c.evaluate("document.getElementById('joystick').classList.contains('active')"), "joystick hidden after lift")
    # A touch that starts on HUD text steers.
    hx, hy = center(c, "#hud-difficulty")
    c.touch("touchStart", [(hx, hy, 3)])
    c.touch("touchMove", [(hx + 40, hy + 40, 3)])
    time.sleep(0.15)
    expect(c.evaluate(f"{GAME}.joystick !== null"), "touch starting on HUD text steers")
    c.touch("touchEnd", [])
    time.sleep(0.1)
    # A touch on the Pause button pauses and does not steer.
    px, py = center(c, "#touch-pause")
    c.evaluate("window.__steered = false; const iv = setInterval(() => { if (__uptimeSurvivors.joystick) __steered = true; }, 5); setTimeout(() => clearInterval(iv), 1000);")
    c.tap(px, py)
    time.sleep(0.3)
    expect(phase(c) == "paused" and not c.evaluate("__steered"), f"Pause button pauses ({phase(c)}) without steering")
    return {"T2": result(ok, "; ".join(notes))}


# ---------------------------------------------------------------- T3 every action by tap
def check_tap_everything(c, base):
    notes, ok = [], True

    def expect(cond, text):
        nonlocal ok
        ok &= bool(cond)
        notes.append(("ok " if cond else "FAIL ") + text)

    load(c, base, query="seed=77")
    x, y = center(c, "#overlay button")
    c.evaluate("window.__tapAt = 0; addEventListener('pointerdown', () => { __tapAt = performance.now(); }, true)")
    c.tap(x, y)
    ms = c.evaluate(f"""new Promise((resolve) => {{ const t = () => {GAME}.audio && {GAME}.audio.status === 'running'
      ? resolve(performance.now() - __tapAt) : (performance.now() - __tapAt > 2000 ? resolve(-1) : setTimeout(t, 5)); t(); }})""")
    expect(0 <= ms <= 500, f"sound running {ms:.0f} ms after the Start tap (FR-019)")
    expect(c.evaluate("document.getElementById('hud-sound').textContent") == "♪ Sound on (M)", "HUD says sound on")
    invincible(c)
    sx, sy = center(c, "#touch-sound")
    c.tap(sx, sy)
    time.sleep(0.25)
    a = c.evaluate(f"{GAME}.audio")
    expect(a["muted"] and a["gains"]["master"] < 0.01, f"Sound button mutes (master {a['gains']['master']:.3f})")
    c.tap(sx, sy)
    time.sleep(0.25)
    a = c.evaluate(f"{GAME}.audio")
    expect(not a["muted"] and a["gains"]["master"] > 0.7, "Sound button unmutes")
    # Three upgrades by tap.
    lvl0 = c.evaluate(f"{GAME}.run.engineer.level")
    for i in range(3):
        force_levelup(c)
        if i == 0:
            hover = c.evaluate("""[...document.querySelectorAll('#overlay button, #hud button, #overlay input')].filter((el) =>
              !(el.textContent.trim() || el.getAttribute('aria-label') || (el.labels && el.labels.length))).length""")
            expect(hover == 0, "level-up: every control has visible text or a label (FR-021)")
        guard_ready(c)
        cx, cy = center(c, "#overlay .choice")
        c.tap(cx, cy)
        c.wait_for(f"{GAME}.run.phase === 'playing'", 3)
        invincible(c)
    expect(c.evaluate(f"{GAME}.run.engineer.level") == lvl0 + 3, "3 upgrades chosen by tap")
    # Pause, sliders, sound toggle, resume.
    px, py = center(c, "#touch-pause")
    c.tap(px, py)
    c.wait_for(f"{GAME}.run.phase === 'paused'", 3)
    guard_ready(c)
    hover = c.evaluate("""[...document.querySelectorAll('#overlay button, #hud button, #overlay input')].filter((el) =>
      !(el.textContent.trim() || el.getAttribute('aria-label') || (el.labels && el.labels.length))).length
      + document.querySelectorAll('[title]').length""")
    expect(hover == 0, "pause: every control has visible text or a label; no title-only tooltips (FR-021)")
    for sel, key, frac in (("#music-volume", "musicVolume", 0.3), ("#effects-volume", "effectsVolume", 0.5)):
        r = c.evaluate(f"(() => {{ const b = document.querySelector('{sel}').getBoundingClientRect(); return [b.x, b.y + b.height / 2, b.width]; }})()")
        tx = r[0] + r[2] * frac
        c.touch("touchStart", [(r[0] + r[2] * 0.95, r[1], 5)])
        for k in range(1, 9):
            c.touch("touchMove", [(r[0] + r[2] * 0.95 - (r[0] + r[2] * 0.95 - tx) * k / 8, r[1], 5)])
        c.touch("touchEnd", [])
        time.sleep(0.15)
        v = c.evaluate(f"{GAME}.audio.{key}")
        expect(abs(v - frac * 100) <= 10, f"{key} set to {v}% by touch (target ~{int(frac * 100)}%)")
    tx, ty = center(c, "#sound-toggle")
    c.tap(tx, ty)
    time.sleep(0.15)
    expect(c.evaluate(f"{GAME}.audio.muted"), "pause screen Sound toggle mutes by tap")
    c.tap(tx, ty)
    time.sleep(0.15)
    expect(not c.evaluate(f"{GAME}.audio.muted"), "…and unmutes")
    rx, ry = button_center(c, "Resume")
    c.tap(rx, ry)
    c.wait_for(f"{GAME}.run.phase === 'playing'", 3)
    notes.append("ok Resume by tap")
    # Quit to title, start again, lose, New Run, lose, Replay Seed.
    c.tap(px, py)
    c.wait_for(f"{GAME}.run.phase === 'paused'", 3)
    guard_ready(c)
    qx, qy = button_center(c, "Quit to Title")
    c.tap(qx, qy)
    c.wait_for("!!document.querySelector('#overlay h1')", 3)
    notes.append("ok Quit to Title by tap")
    start_by_tap(c)
    for label in ("New Run", "Replay Seed"):
        seed_before = c.evaluate(f"{GAME}.run.seed")
        c.evaluate(f"(() => {{ const e = {GAME}.run.engineer; e.uptime = 0; }})()")
        c.wait_for(f"{GAME}.run.phase === 'ended' && [...document.querySelectorAll('#overlay button')].length >= 2", 10)
        bx, by = button_center(c, label)
        c.tap(bx, by)
        c.wait_for(f"{GAME}.run.phase === 'playing'", 3)
        seed_after = c.evaluate(f"{GAME}.run.seed")
        if label == "Replay Seed":
            expect(seed_after == seed_before, f"Replay Seed by tap keeps seed {seed_before}")
        else:
            notes.append(f"ok New Run by tap (seed {seed_before} → {seed_after})")
    return {"T3": result(ok, "; ".join(notes))}


# ---------------------------------------------------------------- T4 tap guard
OPEN_PROBE = """window.__opened = 0; window.__downAt = 0;
new MutationObserver(() => { const o = document.getElementById('overlay');
  if (o.classList.contains('open') && !__opened) __opened = performance.now(); })
  .observe(document.getElementById('overlay'), { attributes: true, childList: true });
addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') __downAt = performance.now(); }, true);"""


def check_tap_guard(c, base):
    notes, ok = [], True

    def expect(cond, text):
        nonlocal ok
        ok &= bool(cond)
        notes.append(("ok " if cond else "FAIL ") + text)

    load(c, base, query="seed=9")
    start_by_tap(c)
    invincible(c)
    # 1) Finger held while level-up opens → lifting over a choice selects nothing.
    c.touch("touchStart", [(195, 700, 1)])
    c.touch("touchMove", [(215, 690, 1)])
    level = c.evaluate(f"{GAME}.run.engineer.level")
    force_levelup(c)
    cx, cy = center(c, "#overlay .choice")
    for k in range(1, 9):
        c.touch("touchMove", [(215 + (cx - 215) * k / 8, 690 + (cy - 690) * k / 8, 1)])
    time.sleep(0.8)
    c.touch("touchEnd", [])
    time.sleep(0.3)
    expect(phase(c) == "levelup" and c.evaluate(f"{GAME}.run.engineer.level") == level + 1,
           f"held finger lifted over a choice selects nothing (phase {phase(c)})")
    # Then a fresh tap works.
    guard_ready(c)
    c.tap(cx, cy)
    c.wait_for(f"{GAME}.run.phase === 'playing'", 3)
    expect(True, "a new tap after lifting chooses")
    # 2) Tap within 500 ms of opening is ignored; one after 500 ms works and play resumes at once.
    invincible(c)
    c.evaluate("window.__opened = 0;" + OPEN_PROBE)
    c.evaluate(f"""import('/engine/progression.js').then(({{ addTelemetry }}) => {{
      const r = {GAME}.run; addTelemetry(r, r.engineer.telemetryToNext - r.engineer.telemetry); }})""")
    c.wait_for(f"{GAME}.run.phase === 'levelup' && document.querySelectorAll('#overlay .choice').length > 0", 5)
    cx, cy = center(c, "#overlay .choice")
    c.tap(cx, cy)
    early = c.evaluate("__downAt - __opened")
    time.sleep(0.2)
    expect(early < 500 and phase(c) == "levelup", f"tap {early:.0f} ms after opening ignored")
    time.sleep(0.5)
    c.tap(cx, cy)
    late = c.evaluate("__downAt - __opened")
    resumed = c.evaluate(f"""new Promise((resolve) => {{ const t = () => {GAME}.run.phase === 'playing'
      ? resolve(performance.now() - __downAt) : setTimeout(t, 5); t(); setTimeout(() => resolve(-1), 2000); }})""")
    expect(late >= 500 and 0 <= resumed <= 300, f"tap {late:.0f} ms after opening chose; play resumed after {resumed:.0f} ms")
    # 3) Pause screen: finger 1 steering, finger 2 taps Pause; Resume ignored while finger 1 is down;
    #    finger 1 dragged across the Music slider changes nothing.
    invincible(c)
    c.touch("touchStart", [(195, 700, 1)])
    c.touch("touchMove", [(215, 690, 1)])
    px, py = center(c, "#touch-pause")
    c.touch("touchStart", [(215, 690, 1), (px, py, 2)])
    c.touch("touchEnd", [(px, py, 2)])  # lift finger 2 only → tap on Pause
    c.wait_for(f"{GAME}.run.phase === 'paused'", 3)
    vol = c.evaluate(f"{GAME}.audio.musicVolume")
    slider = c.evaluate("(() => { const b = document.querySelector('#music-volume').getBoundingClientRect(); return [b.x, b.y + b.height / 2, b.width]; })()")
    for k in range(0, 9):
        c.touch("touchMove", [(slider[0] + slider[2] * k / 8, slider[1], 1)])
    time.sleep(0.7)
    rx, ry = button_center(c, "Resume")
    c.touch("touchStart", [(slider[0] + slider[2], slider[1], 1), (rx, ry, 3)])
    c.touch("touchEnd", [(rx, ry, 3)])
    time.sleep(0.3)
    expect(phase(c) == "paused", "Resume tapped while the held finger is still down: ignored")
    vol2 = c.evaluate(f"{GAME}.audio.musicVolume")
    sval = c.evaluate("document.querySelector('#music-volume').value")
    expect(vol2 == vol and str(sval) == str(vol), f"held finger dragged across Music slider: volume {vol} → {vol2}, slider {sval}")
    c.touch("touchEnd", [])
    time.sleep(0.1)
    guard_ready(c)
    c.tap(rx, ry)
    c.wait_for(f"{GAME}.run.phase === 'playing'", 3)
    expect(True, "after lifting, Resume by tap works")
    # 4) Keyboard is never delayed.
    invincible(c)
    c.evaluate(f"""import('/engine/progression.js').then(({{ addTelemetry }}) => {{
      const r = {GAME}.run; addTelemetry(r, r.engineer.telemetryToNext - r.engineer.telemetry); }})""")
    c.wait_for(f"{GAME}.run.phase === 'levelup'", 5)
    for t in ("keyDown", "keyUp"):
        c.send("Input.dispatchKeyEvent", {"type": t, "code": "Digit1", "key": "1", "windowsVirtualKeyCode": 49})
    time.sleep(0.15)
    expect(phase(c) == "playing", "keyboard 1 chooses immediately (no delay)")
    return {"T4": result(ok, "; ".join(notes))}


# ---------------------------------------------------------------- T5 page lock
def check_page_lock(c, base):
    notes, ok = [], True

    def expect(cond, text):
        nonlocal ok
        ok &= bool(cond)
        notes.append(("ok " if cond else "FAIL ") + text)

    load(c, base)
    origin = c.evaluate("performance.timeOrigin")
    start_by_tap(c)
    invincible(c)
    c.evaluate("window.__ctx = []; addEventListener('contextmenu', (e) => setTimeout(() => __ctx.push(e.defaultPrevented)), true)")
    for i in range(4):  # vigorous drags in all directions
        c.touch("touchStart", [(200, 500, 1)])
        for k in range(12):
            c.touch("touchMove", [(200 + (k * 25 if i % 2 else -k * 15), 500 + (k * 30 if i < 2 else -k * 30), 1)])
        c.touch("touchEnd", [])
    for _ in range(2):  # double tap
        c.tap(200, 400, hold=0.03)
        time.sleep(0.08)
    c.touch("touchStart", [(150, 450, 1)])  # long press
    time.sleep(1.2)
    c.touch("touchEnd", [])
    c.touch("touchStart", [(195, 4, 1)])  # pull down from the top
    for k in range(1, 15):
        c.touch("touchMove", [(195, 4 + k * 30, 1)])
    c.touch("touchEnd", [])
    c.touch("touchStart", [(150, 400, 1), (250, 500, 2)])  # pinch out
    for k in range(1, 8):
        c.touch("touchMove", [(150 - k * 12, 400 - k * 12, 1), (250 + k * 12, 500 + k * 12, 2)])
    c.touch("touchEnd", [])
    time.sleep(0.4)
    st = c.evaluate("""({ scrollY, top: document.scrollingElement.scrollTop, scale: visualViewport.scale,
      origin: performance.timeOrigin, sel: getSelection().toString(), ctx: __ctx })""")
    expect(st["scrollY"] == 0 and st["top"] == 0, f"no scroll (scrollY {st['scrollY']})")
    expect(abs(st["scale"] - 1) < 1e-6, f"no zoom (visual viewport scale {st['scale']})")
    expect(st["origin"] == origin, "no reload")
    expect(st["sel"] == "", "no text selected")
    expect(all(st["ctx"]), f"no context menu ({len(st['ctx'])} contextmenu events, all prevented)")
    # Desktop without touch keeps text selection (FR-020).
    load(c, base, size=(1280, 800), mobile=False, touch=False)
    sel = c.evaluate("""(() => { const r = document.createRange(); r.selectNodeContents(document.querySelector('#overlay h1'));
      getSelection().removeAllRanges(); getSelection().addRange(r);
      return [getComputedStyle(document.body).userSelect, getSelection().toString()]; })()""")
    expect(sel[0] != "none" and sel[1] == "UPTIME SURVIVORS", f"desktop: text still selectable (user-select {sel[0]})")
    return {"T5": result(ok, "; ".join(notes))}


# ---------------------------------------------------------------- T6 fit, T8 view distance
SIZES = [(360, 640), (390, 844), (844, 390), (768, 1024), (1024, 768)]

FIT_PROBE = """((insets) => {
  const vw = innerWidth, vh = innerHeight, bad = [];
  const inside = (el, inset) => { const r = el.getBoundingClientRect(); if (!r.width && !r.height) return true;
    return r.left >= inset.left - 0.5 && r.top >= inset.top - 0.5 && r.right <= vw - inset.right + 0.5 && r.bottom <= vh - inset.bottom + 0.5; };
  const zero = { top: 0, right: 0, bottom: 0, left: 0 };
  const overlay = document.getElementById('overlay');
  if (overlay.classList.contains('open')) {
    const panel = overlay.querySelector('.panel');
    if (!inside(panel, insets)) bad.push('panel outside safe area');
    if (panel.scrollHeight > panel.clientHeight + 1) bad.push(`panel scrolls (${panel.scrollHeight} > ${panel.clientHeight})`);
    for (const el of panel.querySelectorAll('button, input')) if (!inside(el, insets)) bad.push(`control outside: ${el.textContent || el.id}`);
  } else {
    for (const el of document.querySelectorAll('#hud .hud-row > *, #hud-loadout, .touch-btn')) if (!inside(el, insets)) bad.push(`HUD outside: ${el.id || el.className}`);
  }
  if (document.documentElement.scrollWidth > vw + 1 || document.documentElement.scrollHeight > vh + 1) bad.push('page overflows');
  return bad;
})"""


def set_insets(c, size):
    portrait = size[1] >= size[0]
    insets = {"top": 47, "bottom": 34, "left": 0, "right": 0} if portrait else {"top": 0, "bottom": 21, "left": 47, "right": 47}
    try:
        c.send("Emulation.setSafeAreaInsetsOverride", {"insets": insets})
        return insets, "emulated"
    except Exception:  # noqa: BLE001 — older Chrome: fall back to checking without insets
        return {"top": 0, "bottom": 0, "left": 0, "right": 0}, "not supported (checked without insets)"


def check_fit(c, base):
    notes, ok = [], True
    view_notes, view_ok = [], True
    for size in SIZES:
        load(c, base, query="seed=3", size=size)
        insets, how = set_insets(c, size)
        time.sleep(0.3)
        problems = {}
        problems["title"] = c.evaluate(FIT_PROBE + f"({json.dumps(insets)})")
        start_by_tap(c)
        invincible(c)
        time.sleep(0.3)
        problems["hud"] = c.evaluate(FIT_PROBE + f"({json.dumps(insets)})")
        vhs = c.evaluate(f"{GAME}.render.viewHalfShort")
        view_ok &= vhs >= 330 - 1e-6
        view_notes.append(f"{size[0]}×{size[1]}: {vhs:.0f} units")
        force_levelup(c)
        time.sleep(0.2)
        problems["levelup"] = c.evaluate(FIT_PROBE + f"({json.dumps(insets)})")
        guard_ready(c)
        cx, cy = center(c, "#overlay .choice")
        c.tap(cx, cy)
        c.wait_for(f"{GAME}.run.phase === 'playing'", 3)
        px, py = center(c, "#touch-pause")
        c.tap(px, py)
        c.wait_for(f"{GAME}.run.phase === 'paused'", 3)
        time.sleep(0.2)
        problems["pause"] = c.evaluate(FIT_PROBE + f"({json.dumps(insets)})")
        guard_ready(c)
        rx, ry = button_center(c, "Resume")
        c.tap(rx, ry)
        c.wait_for(f"{GAME}.run.phase === 'playing'", 3)
        c.evaluate(f"(() => {{ const e = {GAME}.run.engineer; e.uptime = 0; }})()")
        c.wait_for(f"{GAME}.run.phase === 'ended'", 10)
        time.sleep(0.2)
        problems["end"] = c.evaluate(FIT_PROBE + f"({json.dumps(insets)})")
        bad = {k: v for k, v in problems.items() if v}
        ok &= not bad
        notes.append(f"{size[0]}×{size[1]} (safe-area {how}): " + ("all screens fit" if not bad else json.dumps(bad)))
    # Desktop view unchanged.
    load(c, base, size=(1400, 1000), mobile=False, touch=False)
    c.evaluate("document.querySelector('#overlay button').click()")
    c.wait_for(f"{GAME}.run && {GAME}.run.phase === 'playing'", 5)
    desk = c.evaluate(f"{GAME}.render.viewScale")
    view_ok &= abs(desk - 1.30339) < 1e-3
    view_notes.append(f"desktop 1400×1000 scale {desk:.4f} (feature 001: 1.3034)")
    return {"T6": result(ok, "; ".join(notes)), "T8": result(view_ok, "; ".join(view_notes))}


# ---------------------------------------------------------------- T7 rotation
def check_rotation(c, base):
    load(c, base)
    start_by_tap(c)
    invincible(c)
    time.sleep(0.5)
    before = c.evaluate(f"[{GAME}.run.phase, {GAME}.run.tick, {GAME}.render.resizes, {GAME}.run.seed]")
    t0 = time.time()
    c.set_device(844, 390)
    c.wait_for(f"{GAME}.render.width === 844 && {GAME}.render.height === 390", 3)
    refit = time.time() - t0
    time.sleep(0.5)
    after = c.evaluate(f"[{GAME}.run.phase, {GAME}.run.tick, {GAME}.render.resizes, {GAME}.run.seed, {GAME}.render.viewHalfShort]")
    passed = refit <= 1 and after[0] == before[0] == "playing" and after[1] > before[1] and after[3] == before[3] and after[4] >= 330
    return {"T7": result(passed, f"re-fit to 844×390 in {refit * 1000:.0f} ms (includes protocol round-trips); phase {before[0]} → {after[0]}; "
                                 f"tick {before[1]} → {after[1]} (same run, seed {after[3]}); view {after[4]:.0f} units")}


# ---------------------------------------------------------------- T9 throttled performance
MEASURE = f"""new Promise((resolve) => {{ const frames = []; let last = null; const t0 = performance.now();
  const tick = (t) => {{ const e = {GAME}.run.engineer; e.maxUptime = 1e12; e.uptime = 1e12;
    if (last !== null) frames.push(t - last); last = t;
    if (t - t0 < 5000) requestAnimationFrame(tick); else {{
      const s = [...frames].sort((a, b) => a - b); const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
      resolve({{ fps: 1000 / avg, p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1], n: frames.length,
                 enemies: {GAME}.run.enemies.length, quality: {GAME}.render.quality }}); }} }};
  requestAnimationFrame(tick); }})"""

SPAWN = f"""(n) => import('/engine/spawner.js').then(({{ spawnEnemy }}) => import('/engine/difficulty.js').then(({{ rowFor }}) => {{
  const run = {GAME}.run; const row = rowFor(run.data, 20); const ids = run.data.enemies.map((e) => e.id);
  const start = run.enemies.length;
  for (let i = 0; i < n; i++) {{ const a = ((start + i) / 300) * Math.PI * 2 * 7; const r = 60 + ((start + i) % 30) * 10;
    const e = spawnEnemy(run, ids[i % ids.length], run.engineer.x + Math.cos(a) * r, run.engineer.y + Math.sin(a) * r, row);
    e.health = e.maxHealth = 1e9; }} return run.enemies.length; }}))"""


def check_throttled_perf(c, base):
    load(c, base, query="seed=99")
    start_by_tap(c)
    invincible(c)
    c.throttle(4)
    c.evaluate(f"({SPAWN})(150)")
    time.sleep(5)  # let the quality governor settle (it is part of the design)
    m150 = c.evaluate(MEASURE)
    c.evaluate(f"({SPAWN})(150)")
    time.sleep(5)
    m300 = c.evaluate(MEASURE)
    c.throttle(1)
    passed = m150["fps"] >= 50 and m300["fps"] >= 30 and m150["max"] <= 250 and m300["max"] <= 250
    fmt = lambda m: (f"{m['enemies']} enemies: avg {m['fps']:.0f} fps, p95 {m['p95']:.1f} ms, max {m['max']:.0f} ms, "
                     f"quality level {m['quality']}")
    return {"T9": result(passed, "390×844, CPU 4× slower — " + fmt(m150) + "; " + fmt(m300))}


# ---------------------------------------------------------------- T10 hidden page
def check_hidden(c, base):
    load(c, base)
    start_by_tap(c)
    invincible(c)
    time.sleep(0.4)
    c.evaluate("dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }))")
    time.sleep(0.4)
    st = c.evaluate(f"[{GAME}.run.phase, {GAME}.audio.status, {GAME}.audio.contextState]")
    passed = st[0] == "paused" and st[1] == "suspended"
    return {"T10": result(passed, f"pagehide → phase {st[0]}, sound {st[1]} (context {st[2]}). visibilitychange/blur use the "
                                  "same handler and are covered by feature 001 F6 / 002 B3")}


CHECKS = [
    ("touch: T1 touch mode", check_touch_mode, 90),
    ("touch: T2 steering", check_steering, 90),
    ("touch: T3 every action by tap", check_tap_everything, 120),
    ("touch: T4 tap guard", check_tap_guard, 120),
    ("touch: T5 page lock", check_page_lock, 90),
    ("touch: T6 fit + T8 view distance", check_fit, 300),
    ("touch: T7 rotation", check_rotation, 60),
    ("touch: T9 throttled performance", check_throttled_perf, 120),
    ("touch: T10 hidden page", check_hidden, 60),
]
