# Contract: Audio Controls and Screens (additions to feature 001)

## Keyboard

| Context | Key | Action |
|---------|-----|--------|
| Any (title, playing, paused, level-up, end) | **M** | Toggle mute for all sound (FR-012) |

M before the first Start only changes the setting; the run then starts muted.

## Screens

| Screen | Addition |
|--------|----------|
| Title | Controls reminder adds "Sound: M to mute" (FR-015) |
| HUD | Sound indicator: "♪ Sound on (M)", "Sound off (M)", or "Sound unavailable" |
| Paused | A **Sound** toggle button and two native sliders — **Music** and **Effects** — each 0–100% in 10% steps, labelled with the current value; arrow keys change them by 10% (FR-013) |

## Announcements

Mute changes and "Sound unavailable" are announced through the existing ARIA live region. No game
information is conveyed only by sound (FR-019).
