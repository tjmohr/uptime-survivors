# Contract: Field Guide screen

**Feature**: [../spec.md](../spec.md) | Model: [../data-model.md](../data-model.md)

## Pause screen (`screens.showPause`)

- Signature becomes `showPause(onResume, onQuit, sound, { onGuide, focusGuide = false })`.
- Button row: **Resume**, **Field Guide** (`id="open-guide"`), **Quit to Title**.
- `focusGuide: true` focuses the Field Guide button instead of Resume (used when returning from the guide).

## Guide screen (`screens.showGuide(model, { onBack })`)

Opened as overlay screen `guide` (`screens.current === 'guide'`); tap-guarded like `levelup` and `paused`.

```text
.panel.guide
  header.guide-header
    button#guide-back            "Back"
    h2                           "Field Guide"
    div[role=tablist][aria-label="Field Guide sections"]
      button[role=tab]#tab-problems  "Network problems"   aria-selected, aria-controls=guide-list
      button[role=tab]#tab-loadout   "Tools & passives"
  div#guide-list[role=tabpanel][tabindex=0]   scrolls; aria-labelledby = selected tab
    (Network problems)  h3 "Network problems" · entries… · h3 "Major Incidents" · entries…
    (Tools & passives)  entries…
```

Opens on "Network problems" with focus on the selected tab. Left/Right (and Home/End) on a tab move the
selection; clicking or tapping a tab selects it; switching resets the list's scroll to the top.

### Entry (`article.guide-entry[tabindex=0]`, `aria-labelledby` its name)

| Entry | Content |
|-------|---------|
| Enemy, unlocked | icon · **name** · concept · description |
| Enemy, locked | silhouette icon · **"???"** · "Not yet encountered" |
| Incident, unlocked | icon · **name** · "Major Incident · arrives at difficulty N" · concept · description |
| Incident, locked | silhouette icon · **"???"** · "Major Incident · arrives at difficulty N" · "Not yet encountered" |
| Tool/passive, owned | icon · **name** · "Rank r / 5" (+ " · OFFLINE" when offline) · concept · description · stats line · "Next rank: …" line when r < 5 |
| Tool/passive, not owned | icon · **name** · "Not owned" · concept · description · rank-1 stats line |

Stats and next-rank text: `describeStatChange` items joined with " · " (level-up wording). Locked
entries contain no name, concept, or description text anywhere in the DOM (including `aria-*`).

## Closing

| Input | Result |
|-------|--------|
| Back button | `onBack()` |
| Esc or P while `screens.current === 'guide'` | `onBack()` (never resumes) |
| `onBack` (main.js) | `screens.showPause(…, { onGuide, focusGuide: true })`; run stays `paused` |

M (mute) works as everywhere. Focus loss while the guide is open changes nothing (the run is already
paused). Level-up, title, and end screens have no Field Guide control (FR-003).

## Layout

- Panel fits the overlay inside the safe area (`--sat`, `--sar`, `--sab`, `--sal`), at most 720 px wide
  on desktop; header stays put, `#guide-list` scrolls (`overflow-y: auto; overscroll-behavior: contain;
  touch-action: pan-y`).
- Entries are a two-column grid (icon 40 px | text); text wraps, nothing is clipped.
- On touch (`body.touch`), Back and the tabs are at least 44 × 44 CSS px.
- No animation or transitions in the guide.
