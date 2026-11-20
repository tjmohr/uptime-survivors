# Feature Specification: Drum & Bass Soundtrack

**Feature Branch**: `007-drum-and-bass-music`

**Created**: 2026-11-19

**Status**: Implemented — automated and scripted checks pass (180 unit tests; full browser suite 56/56, 2026-11-19); listening checks M-H1–M-H6 not run; not committed or pushed (local branch, awaiting the owner's listening test)

**Input**: User description: "Replace the procedural music with drum & bass at a fixed 174 BPM: five songs built in the browser, one per sub-style (Liquid, Jump-up, Neurofunk, Jungle, Dancefloor). The song changes every 4 difficulty levels (at the start of difficulty 1, 5, 9, 13, 17). Song order is a shuffle drawn from the run's seed with no repeats, so a full run hears each song once and Replay Seed gives the same soundtrack. Within each 4-level block a song builds up: drums and bass at its first level, more layers each level, its full arrangement at its fourth. Song changes crossfade over 2 bars on the shared 174 BPM beat grid. Existing music volume, mute, and pause behavior stay the same."

## Overview

Today a run has one generated minimal-techno track whose tempo climbs from 118 to 156 BPM and which
gains layers at the enemy debut levels (feature 002). This feature replaces that track with a drum &
bass soundtrack: five original songs, all at a steady 174 BPM, each in a different drum & bass
sub-style. A run is split into five 4-level blocks (difficulty 1–4, 5–8, 9–12, 13–16, 17–20); each
block plays one song, chosen in a shuffled order that comes from the run's seed. Each song builds
from a stripped-back groove at its block's first level to its full arrangement at the block's
fourth, then the next song fades in over two bars. Like the current track, every song is generated
in the browser with no audio files, and everything else about sound (effects, mute, volumes,
ducking, start/stop rules) stays as it is.

**Pre-agreed decisions** (asked before this spec was written, 2026-11-19):

- Five songs, one per sub-style: Liquid, Jump-up, Neurofunk, Jungle, Dancefloor.
- Song order: drawn from the run's seed, no repeats within a run (a full run hears all five once);
  Replay Seed gives the same order.
- Build-up happens within each song's 4-level block (not across the whole run).
- Song changes use a 2-bar crossfade on the shared beat grid.

## Clarifications

### Session 2026-11-19

- Q: Besides adding parts level by level, should each song have a phrase structure (drum fills,
  breakdowns) or be one steady groove? → A: Fills plus breakdowns — a short drum fill on the last bar
  of every 8-bar phrase, and a 4-bar breakdown (drums drop out, the song's other active parts stay)
  every 32 bars, then the drums drop back in.
- Q: During the 2-bar song change, should both songs' bass lines play at once or be swapped like a
  DJ mix? → A: Bass swap — drums and other parts crossfade over both bars, but the outgoing bass
  plays only in bar 1 and the incoming bass enters at bar 2, so only one bass line sounds at a time.
- Q: Should every song's bass stay audible on phone and laptop speakers, or may it disappear there?
  → A: Headphones first, mostly — songs may differ. Some upper (mid-range) bass layered on the sub
  must exist in at least some of the music; a song, or parts of songs, may be headphones-first
  (sub-led).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A drum & bass groove at a steady 174 BPM (Priority: P1)

A player starts a run and hears drum & bass instead of the old techno pulse: a fast breakbeat with
the snare on beats 2 and 4, a deep bass line underneath, at 174 BPM from the first second to the
last. The tempo never speeds up or slows down; the energy rises through the arrangement instead.

**Why this priority**: This is the core of the request. One good drum & bass song at the fixed tempo,
with the existing sound controls still working, is already a complete improvement over today's
music.

**Independent Test**: Start a run with any seed; the music that starts is recognizably drum & bass
at 174 BPM; it stays at 174 BPM across difficulty changes (shortened-timer test setting); mute,
music volume, ducking on pause and level-up, and stop at run end behave as before.

**Acceptance Scenarios**:

1. **Given** the title screen, **When** it is shown, **Then** no music plays (unchanged from
   feature 002).
2. **Given** a run starts, **When** gameplay begins, **Then** a drum & bass song starts within one
   bar and loops seamlessly for as long as its block lasts.
3. **Given** any point in a run, **When** the music's tempo is measured, **Then** it is 174 BPM,
   including after every difficulty change and every song change.
4. **Given** the game is paused or the level-up screen is open, **When** that screen is shown,
   **Then** the music is ducked to about half volume and returns to normal when play resumes
   (unchanged).
5. **Given** the player mutes with M or sets Music volume, **When** the music plays, **Then** it
   follows mute and the Music volume exactly as the old track did (unchanged).
6. **Given** the run ends (win or loss), **When** the end screen appears, **Then** the music stops
   and the win or loss sound plays (unchanged).

---

### User Story 2 - A different song every 4 levels, in a seeded order (Priority: P1)

As the run goes on, the soundtrack changes: a new song begins when difficulty 5, 9, 13 and 17
start. The songs come in a shuffled order that depends on the run's seed, no song repeats in a run,
and a player who reaches the end hears all five. The old song fades out while the new one fades in
over two bars, both locked to the same beat, so the change never stumbles or skips a beat.

**Why this priority**: Variety across a 20-minute run was the reason for the request; without it the
single song would loop for 20 minutes.

**Independent Test**: With the shortened-timer test setting and a fixed seed, play through to
difficulty 17 and record which song plays in each block; all five songs appear once; the same
seed gives the same order on Replay Seed; a different seed generally gives a different order; each
change is a 2-bar crossfade that stays on the beat.

**Acceptance Scenarios**:

1. **Given** a run, **When** difficulty 1, 5, 9, 13 and 17 begin, **Then** blocks 1–5 each play a
   different one of the five songs.
2. **Given** a seed, **When** the run is replayed with Replay Seed or started again with the same
   seed, **Then** the song order is identical.
3. **Given** the 30 seeds 1–30, **When** their song orders are listed, **Then** at least 10
   different orders appear and every song is the first song for at least one seed.
4. **Given** difficulty 5 (or 9, 13, 17) begins, **When** the song changes, **Then** the new song
   starts on a bar line and the two songs crossfade over exactly 2 bars (about 2.8 seconds at 174
   BPM), with their beats aligned for the whole crossfade; the old song's bass plays only in the
   first crossfade bar and the new song's bass enters on the second, so only one bass line is heard
   at a time.
5. **Given** a song change, **When** it finishes, **Then** only the new song is heard; the old song
   is silent and no longer uses any processing.
6. **Given** the music choice, **When** a seeded simulation of a run is compared with and without
   sound, **Then** the simulation outcome is identical (music never draws from the game's random
   numbers).

---

### User Story 3 - Each song builds through its block (Priority: P2)

Inside each 4-level block the song grows: at the block's first level it plays a stripped-back
groove of drums and bass, each following level adds more parts, and at the block's fourth level it
plays its full arrangement. The next song then starts stripped back again, so every 4 minutes feels
like a fresh intro building to a drop. A Major Incident still adds the incident layer on top of
whatever song is playing.

**Why this priority**: It keeps the "music builds with the danger" feel from feature 002 now that
the tempo no longer rises. The songs are still usable without it, so it comes after Stories 1–2.

**Independent Test**: With the shortened-timer test setting, listen to (or inspect the active parts
of) one block: parts are added at each of its four levels and never removed until the block ends;
during a Major Incident the incident layer is heard on top.

**Acceptance Scenarios**:

1. **Given** the first level of any block, **When** the song plays, **Then** only its drums and bass
   are heard.
2. **Given** the second, third and fourth level of a block, **When** each begins, **Then** the song
   adds at least one part on the next bar line, and no part heard earlier in the block drops out.
3. **Given** the fourth level of a block, **When** the song plays, **Then** its full arrangement is
   heard.
4. **Given** a Major Incident is active, **When** the music plays, **Then** an incident layer in the
   current song's key and on its beat grid is added, and it leaves when the last active incident is
   resolved (feature 004 behavior, now per song).
5. **Given** a run that starts above difficulty 1 through a test setting, **When** the music starts,
   **Then** the song is the one for that block and the build-up stage matches the level's position
   in the block.

---

### User Story 4 - Five songs that sound clearly different (Priority: P2)

Each of the five songs is a recognizable take on its sub-style, so a listener can tell them apart and
the soundtrack does not feel like one loop with new names:

- **Liquid**: smooth, rolling breakbeat; warm sustained chords; a round, melodic sub bass; calm and
  uplifting.
- **Jump-up**: bouncy two-step beat; a loud, wobbling, "talking" mid-range bass riff that answers
  itself; playful and punchy.
- **Neurofunk**: tight, precise drums; a dark, gritty, constantly shifting (modulated) bass; cold,
  technical feel with sparse dark atmosphere.
- **Jungle**: busy, chopped breakbeat with ghost notes and rolls (in the spirit of classic jungle
  breaks, played from original patterns); a deep, long sub bass under it; a touch of reggae-style
  off-beat stabs.
- **Dancefloor**: driving two-step with big, bright synth stabs and a catchy lead hook over a heavy
  bass; the highest-energy song.

**Why this priority**: Five songs that sound the same would defeat the purpose of variety, but the
mechanics in Stories 1–3 can be built and tested with placeholder variety first.

**Independent Test**: A listening check: play each song's full arrangement for 30 seconds; a listener
matches each to its sub-style description and can tell all five apart.

**Acceptance Scenarios**:

1. **Given** each song at full arrangement, **When** a listener hears 30 seconds of it, **Then** they
   can identify it as drum & bass and tell it apart from the other four.
2. **Given** the five songs, **When** their parts are compared, **Then** no two songs share the same
   drum pattern and bass line.
3. **Given** a whole song block (4 minutes), **When** it plays, **Then** its loop is at least 8 bars
   long before repeating exactly (so it does not feel like a 1-bar loop).
4. **Given** a song playing, **When** bars 8, 16 and 24 of its 32-bar cycle play, **Then** a drum
   fill is heard; **when** bars 29–32 play, **Then** the drums drop out for a breakdown and return
   on the next bar 1 (the drop).

### Edge Cases

- **Block shorter than the crossfade** (shortened-timer test setting, e.g. 2-second levels): if a
  new song change arrives while a crossfade is still running, the outgoing song is cut and the
  newest song continues fading in; at most two songs are ever heard at once.
- **Level shorter than a bar**: a part added for a level still joins on the next bar line; if two
  levels pass within one bar, both levels' parts join together on that bar line.
- **Paused or level-up open during a song change**: game time is stopped, so no new block starts
  while paused; if a crossfade is already running, it continues ducked and finishes normally.
- **Tab hidden mid-crossfade**: all sound is silenced (existing behavior); on return the music
  resumes with whichever song the block calls for, without replaying the crossfade.
- **Muted or Music at 0%**: songs still advance and change silently, so unmuting later plays the
  correct song at the correct build-up stage.
- **Run won at the end of difficulty 20**: the music stops and the win sound plays; no sixth song is
  started.
- **Replay Seed / New Run**: music restarts from the beginning of the new run's first song at its
  stripped-back stage; nothing from the previous run continues.
- **Audio unavailable** (existing audio-failure path): the game plays silently as before.
- **Slow phone**: the music must keep time; if the device falls behind, notes may be skipped but the
  beat grid is never shifted and the tempo never drifts.

## Requirements *(mandatory)*

### Functional Requirements

**Tempo and style**

- **FR-001**: The game MUST play drum & bass music at a fixed 174 BPM (4/4, 16th-note grid) for the
  whole run; the tempo MUST NOT change with difficulty, song changes or any other event.
- **FR-002**: Every song MUST use a drum & bass groove: snare (or clap) on beats 2 and 4 of each bar,
  kick placed so the bar reads as a two-step or breakbeat pattern, hats or shakers on the 8th or
  16th notes, and a bass line that is the loudest pitched part.
- **FR-002a**: The music is mixed headphones-first: deep sub bass is expected to be felt on
  headphones and good speakers. In addition, at least 3 of the 5 songs MUST layer an upper
  (mid-range) bass part over their sub at every build-up stage, so their bass line can be followed
  on phone and laptop speakers. The other songs, and individual sections such as breakdowns, MAY be
  sub-led and headphones-first. Each song's data MUST state which of the two it is.
- **FR-003**: The game MUST include exactly five songs, one per sub-style — Liquid, Jump-up,
  Neurofunk, Jungle, Dancefloor — each matching its description in User Story 4.
- **FR-004**: All music MUST be generated in the browser with no audio files, as in feature 002, and
  MUST be original to this project (no sampled recordings; breakbeats are played from original
  patterns).

**Song order and changes**

- **FR-005**: A run MUST be divided into five song blocks by difficulty level: 1–4, 5–8, 9–12, 13–16,
  17–20. Each block plays one song.
- **FR-006**: The order of the five songs MUST be a shuffle derived from the run's seed, with each
  song appearing exactly once per run. The same seed MUST always give the same order.
- **FR-007**: Choosing or playing music MUST NOT draw from or change the game's own random number
  sequence; a seeded run MUST have the same simulation outcome whether sound is on, muted, or
  unavailable.
- **FR-008**: When a new block's first level begins, the new song MUST start on the next bar line
  of the shared 174 BPM grid and the two songs MUST crossfade over exactly 2 bars, staying beat
  aligned; after the crossfade the old song MUST be fully stopped.
- **FR-008a**: During the crossfade the bass MUST be swapped, not blended: the outgoing song's bass
  parts play only in crossfade bar 1, the incoming song's bass parts are silent in bar 1 and enter at
  full level at bar 2. At no moment are bass parts from both songs heard together. All other parts
  (drums, pads, stabs, leads, incident layer) crossfade over both bars.
- **FR-009**: At most two songs MAY sound at once; a song change that arrives during a crossfade
  MUST cut the outgoing song and continue with the newest one.

**Build-up within a song**

- **FR-010**: Each song MUST define four build-up stages that match the four levels of its block:
  stage 1 is drums and bass only; stages 2, 3 and 4 each add at least one part; stage 4 is the full
  arrangement. Parts MUST NOT drop out as the stage rises within a block.
- **FR-011**: A stage change MUST take effect on the next bar line after its level begins.
- **FR-012**: Each song MUST have an incident layer, in its own key and on the shared grid, that
  plays while at least one Major Incident is active (replaces feature 004's single incident layer).
- **FR-013**: Each song's repeating pattern MUST be at least 8 bars long before it repeats exactly.
- **FR-013a**: Each song MUST follow a 32-bar phrase cycle counted from the bar the song starts:
  bars 1–28 play the groove, with a short drum fill on the last bar of each 8-bar phrase (bars 8,
  16 and 24); bars 29–32 are a breakdown in which the drums drop out while the song's other active
  parts (bass, and pads/stabs/leads if the build-up stage has them) keep playing, with bar 32
  carrying a fill or riser into the drop; the drums return on bar 1 of the next cycle. At build-up
  stage 1 the breakdown is the bass alone.
- **FR-013b**: The phrase cycle and the build-up stage are independent: a stage change during a
  breakdown adds its parts on the next bar line, and its drum parts are first heard at the drop.
  The incident layer keeps playing through breakdowns.

**Unchanged behavior** (kept from features 002–004)

- **FR-014**: No music on the title screen; music starts when a run starts and stops when it ends;
  Replay Seed and New Run restart the music from the new run's first song at stage 1.
- **FR-015**: Mute (M key and touch Sound button), Music and Effects volume, ducking on pause and
  level-up, silence while the tab is hidden, and the audio-failure path MUST work as before. Sound
  effects are unchanged.
- **FR-016**: All song content (patterns, pitches, sounds, stage contents, levels, tempo, crossfade
  length) MUST live in the validated audio data, and invalid music data MUST be reported by naming
  the offending song or part, like the rest of the audio data.

**Supersedes**

- **FR-017**: This feature replaces feature 002's FR-005 (minimal-techno style), FR-006 (tempo rises
  with difficulty) and FR-007 (intensity rises at levels 4, 8, 12, 16), and feature 004's single
  incident music layer. Those specs MUST be annotated to point here.

### Key Entities

- **Song**: one of the five; has a name, a sub-style, a key/root, whether its bass is
  speaker-audible (upper bass layered) or headphones-first, its parts, its four build-up stages
  and its incident layer.
- **Part**: one instrument line within a song (e.g. kick, snare, break, sub bass, mid bass, pad,
  stab, lead, atmosphere); has a sound and a pattern of at least 8 bars or a pattern that repeats
  within that length.
- **Build-up stage**: the set of parts a song plays at a given position (1–4) in its block.
- **Phrase cycle**: the song's repeating 32-bar structure — groove with fills at bars 8, 16, 24, and
  a breakdown at bars 29–32 — counted from the bar the song started.
- **Song block**: one 4-level stretch of difficulty (1–4, 5–8, 9–12, 13–16, 17–20) and the song
  assigned to it for this run.
- **Soundtrack order**: the run's seed-derived shuffle of the five songs, one per block.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The music measures 174 BPM (±0.5) at every difficulty level of a full run, including
  during and after every song change.
- **SC-002**: In a full run, all five songs play exactly once, in the order derived from the seed, and
  the order is identical across 3 replays of the same seed.
- **SC-003**: Across seeds 1–30, at least 10 different song orders occur and each song opens the run
  for at least one seed.
- **SC-004**: Every song change completes as a 2-bar crossfade (2.76 ± 0.1 seconds) that starts on a
  bar line, with no audible gap, click, or beat slip in a listening check.
- **SC-005**: Within every block, the number of playing parts never decreases from one level to the
  next, and stage 1 is drums and bass only.
- **SC-006**: A seeded simulation produces identical results with sound on, muted, and unavailable.
- **SC-007**: In a listening check, a listener can tell all five songs apart and matches at least 4 of
  the 5 to their sub-style descriptions.
- **SC-007a**: In a listening check on a phone's built-in speaker, the bass line is clearly
  followable in at least 3 of the 5 songs.
- **SC-008**: With the new music playing, the desktop frame-rate check's average frame time is within
  1 ms of the old music's baseline, and the desktop and throttled-phone frame-rate checks still meet
  their existing limits (desktop average < 20 ms and p95 < 34 ms; phone ≥ 50 fps at ~150 enemies and
  ≥ 30 fps at ~300).
- **SC-009**: All existing sound checks for effects, mute, volumes, ducking, pause/hidden and audio
  failure still pass.

## Assumptions

- The five songs are original compositions written for this project in each sub-style; "Jungle"
  uses original chopped-break patterns inspired by the genre, not a recording of any famous break.
- The run has 20 difficulty levels of about one minute each (unchanged), so each song block lasts
  about four minutes; the shortened-timer test setting shortens blocks proportionally.
- Song names and sub-styles are not shown on screen; the soundtrack is heard, not displayed. (A
  "now playing" display could be a later feature.)
- The listening checks (SC-004, SC-007) are human checks, recorded as pass/fail/not run like
  feature 002's listening tests.
- Ducking amount, default volumes and the effects mix stay at their current values; only the music
  content changes.
- The music is not part of the game simulation, so the seed-derived song order uses its own random
  sequence seeded from the run seed rather than the game's generator (consistent with constitution
  C5).
