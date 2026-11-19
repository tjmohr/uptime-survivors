---
# ARCADE SUBMISSION — fill this file in, commit it to the ROOT of your game repository as ARCADE.md,
# then send John your GitHub URL. Everything between the two --- lines is machine-read.
#
# INSTRUCTIONS FOR THE BUILD AGENT (the coding agent that built this game):
#  1. You were there. Fill every field from your own session, your files and your tool list.
#  2. Do NOT invent. If something was not recorded or you do not know it, write "unknown".
#     A truthful "unknown" is better than a confident guess. Never estimate tokens or cost.
#  3. Ask the human ONLY for the fields marked (HUMAN): name, location, links, consent, first-project.
#  4. Keep strings on one line, quote any value containing a colon. Lists use [a, b, c] or "- item".
#  5. Do not put secrets, API keys, tokens, private URLs or file paths from the human's machine here.
#  6. Run the game once yourself and confirm the Runtime section is correct before you finish.
#  7. Then fill in the three short prose sections below the frontmatter. Plain language, no hype.
arcade_version: 1

game:
  title: "Uptime Survivors"
  slug: "uptime-survivors"
  tagline: "Survive 20 levels of network problems with auto-firing network tools"
  summary: "You are the network engineer: steer while your tools (Ping, Firewall Rules, Ansible Playbooks, Load Balancers, Traceroute, Rate Limiters, Null Routes) fire on their own at network problems such as packet loss, BGP route flaps, broadcast storms and DDoS botnets, plus three Major Incidents. Every enemy, tool and upgrade is tied to a real networking concept, and an in-game Field Guide explains each one."
  topics: [packet loss, BGP, broadcast storms, DDoS, QoS, network automation]
  category: "network-fundamentals"
  skill_level: "beginner"
  play_minutes: 20
  levels: 20
  card_image: ""
  card_image_alt: ""
  repo: "https://github.com/tjmohr/uptime-survivors"
  repo_path: ""
  license: "LicenseRef-All-Rights-Reserved"

creator:                     # (HUMAN) ask the human for every field here
  name: "TJ Mohr"
  github: "tjmohr"
  location: "United States"
  organization: ""
  links: []
  first_spec_project: true
  workshop: "NAF AC6"
  consent_to_publish: true

build:                       # the BUILD environment — what made the game
  started: "unknown"
  finished: "2026-11-19T16:44:11-07:00"
  wall_time: "unknown"
  spec_driven:
    framework: "GitHub Spec Kit"
    framework_version: "1.4.2.dev0 (speckit_version in .specify/init-options.json; `specify version` not run)"
    artifacts: [constitution, spec, clarify, plan, research, data-model, contracts, quickstart, tasks, checklists]
    task_count: 292
    loops_or_phases: 6
  model: "claude-opus-5-5"
  helper_models: []
  harness: "Claude Code"
  harness_version: "2.1.327 (updated to 2.1.328 after the build)"
  mcp_servers: []
  rag_and_sources: [".specify/memory/constitution.md (project constitution)", "Spec Kit templates in .specify/"]
  skills_and_plugins: [speckit-constitution, speckit-specify, speckit-clarify, speckit-plan, speckit-tasks, speckit-analyze, "ralph-loop plugin (/ralph-loop:ralph-loop and its stop hook)"]
  other_tools: ["JavaScriptCore jsc (macOS) test runner", "Python 3 (http.server, browser test driver)", "headless Google Chrome 157 via the DevTools Protocol", git, GitHub, GitHub Pages]
  human_prompts: 0
  usage:                     # ONLY if measured by the harness. Otherwise leave "unknown"
    input_tokens: unknown
    output_tokens: unknown
    cost_note: "unknown"
  ai_generated_assets: ["visuals: code-drawn Canvas 2D shapes and inline SVG icons written by the agent", "audio: synthesized in the browser (Web Audio) from data written by the agent", "images: none", "audio files: none"]

runtime:                     # what someone needs to PLAY the finished game
  kind: "static-web"
  stack: [HTML, CSS, JavaScript ES modules, Canvas 2D, Web Audio API]
  start: "python3 -m http.server 8000 --bind 127.0.0.1"
  url_after_start: "http://127.0.0.1:8000/"
  hosted_url: "https://tjmohr.github.io/uptime-survivors/"
  static_root: "."
  requires_install: false
  requires_network: false
  requires_api_key: false
  uses_ai_at_runtime: false
  browsers: ["Chrome 157 (headless, scripted checks incl. emulated phones)"]
  accessibility: "Tested by scripted checks only: full keyboard play, touch play on emulated phones, reduced motion (no flashes, shake or pulsing), screen-reader live-region announcements and ARIA roles/labels in the Field Guide. Not tested with a real screen reader or on real phones."
  save_state: "none"

verification:
  tests: "node tests/run.mjs (or on macOS: /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m tests/run.mjs); browser checks: python3 tests/browser/drive.py"
  tests_passing: 165
  facts_sourced_from: ["none recorded: the networking concepts were written from the model's own knowledge; the planned human review of the descriptions has not been done"]
  known_limits:
    - "No human has played it end to end; all verification is unit tests, seeded balance simulations and scripted headless-Chrome checks."
    - "Only Chrome was tested; Firefox, Safari and Edge are untested, as are real phones."
    - "Balance was tuned with scripted bots; the Major Incident difficulty check I-S2 still fails and needs a human playtest."
    - "Networking concepts are simplified to one-line descriptions; enemies and tools are metaphors, not simulations of real protocols."
    - "node tests/run.mjs was never run (no Node on the build machine); the same tests pass in JavaScriptCore and in the browser."
---

## In one paragraph

Uptime Survivors is a browser survivors-like with a network-engineering theme. You play the network
engineer: you only steer, your tools fire on their own, and you keep the network's Uptime above zero
through 20 one-minute difficulty levels while dropped packets, latency spikes, broadcast storms, route
flaps, DDoS botnets and three Major Incidents close in. Each enemy, tool and upgrade carries a real
networking concept, which the pause-menu Field Guide explains. It suits beginners curious about
networking and anyone who likes short arcade runs; it plays with a keyboard or by touch.

## How it was built

The project used GitHub Spec Kit with a ratified constitution (C1 fun and networking theme, C5
deterministic and self-contained, C6 content as validated data, C7 done is demonstrated) and six
feature specs. The first playable (001) predates this agent's record, so how it was built and which
model built it are unknown. Features 002–006 (procedural audio, mobile and touch, Major Incidents,
Field Guide, late-game upgrades) each went through specify, clarify, plan, tasks and analyze; the top
analysis findings were fixed before an implementation loop (the ralph-loop plugin, three iterations at
most). The human changed
direction several times: widening the platform to phones (a constitution amendment), asking for
Major Incidents to be made easier, and, after balance simulations showed passive-heavy builds dying
early, choosing a tool floor at difficulty 5/10/15 and stronger early passives. Things that broke and
were fixed: a stat formatter that misread an index passed by `.map()`, an incident alert that
overlapped touch buttons on small phones, announcements overwritten by a same-step banner, and test
helpers that shared random state. Every check is recorded as pass, fail or not run in the README.

## What we'd tell the next builder

- Put every number in validated data and have one function compute what both the rules and the screens show; it caught display bugs early.
- Run seeded balance simulations with more than one bot policy (tools-first, random, first choice); one bot hid a real balance problem.
- Run the full browser suite after every change and record failures honestly; several real bugs only showed up there.
