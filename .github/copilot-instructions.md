# AGENTS.md — Sparrow (The Indian Energy Saver)

Read this first. Keep it in context; do not re-read other docs unless a task needs them.
Detailed how-tos live in `Skills.md`: open ONLY the section for your current task.

## What we are building
Mobile-first PWA that teaches Indian households to save electricity and proves it bill-to-bill.
Flow: splash -> welcome -> login -> story (skippable, plays once) -> setup (5 steps) -> app
(Home, Missions, Learn, Solar, Me). Hackathon build, solo builder, tight deadline.

## Repo map
- `frontend/`      React + Vite + TS + Tailwind (YOU build here)
- `backend/`       Python Lambdas + `impact.py` (do not touch unless asked)
- `infra/`         AWS SAM template (do not touch unless asked)
- `data/`          `facts.json`, `config.json`, `cities.json`
- `i18n/`          locale files (en, hi seeded)
- `Premium Energy Saver App/` exported Figma Make project. READ-ONLY. Never edit.
  `Premium Energy Saver App/reference/` = screenshots for visual checks.

## Stack and commands (Windows PowerShell; keep scripts cross-platform)
- Vite + React + TypeScript, Tailwind, react-router, react-i18next, vitest + testing-library.
- Fonts: Baloo 2 (display), Noto Sans + per-script Noto via @fontsource, load active script only.
- Run: `npm run dev` · `npm run lint` · `npm test` · `npm run build`
- Run lint + test + build ONCE at the end of a task, not after every edit.

## Hard product rules (never break)
1. Never invent numbers. Any figure that is not the user's own gets a `SAMPLE` badge.
   New users see zeros. No "equals N trees" claims. No user counts or testimonials.
2. Constants in `data/config.json` that are `null` stay hidden in the UI until sourced.
   Facts without a `source` link are hidden or shown as "source pending".
3. World state (hazy / fresh / thriving) changes ONLY from verified bills. A completed
   action may trigger a sparrow reaction, never a state change. New users = "Dawn".
4. Login = email + Google only. NO phone number or OTP.
5. No photographs. No government, utility or certification names/logos.
6. Language pill only on splash and Profile > Language. Every visible string is an i18n key.
7. Contrast: text >= 4.5:1 (large >= 3:1). Body 16px, captions >= 14px, touch targets >= 48px.
8. Safe-area padding on every screen. Nothing under the notch or behind the tab bar.
9. Use `:focus-visible` rings only. One radius system. `prefers-reduced-motion` honoured.
10. Auth and API sit behind interfaces with MOCK implementations (`VITE_USE_MOCK=true`).
    Do NOT wire AWS until told. Leave a marked stub for Cognito.
11. Reuse Premium Energy Saver App components, SVGs and tokens. Do not restyle. If something is
    missing from the design, say so in the report; do not invent it.

## Credit-saving rules
- Work only on the scope in the prompt. No speculative refactors, no extra features.
- Read only files you need. Use `rg`/`Select-String`, then open narrow line ranges.
  Never print whole large files or paste Premium Energy Saver App code into replies.
- Batch edits: write each file once. Do not rewrite a file to tweak it; patch it.
- No new dependency without listing it and why in the report.
- No screenshots or visual rendering unless the prompt asks.
- Do not re-explain this file, re-plan out loud, or narrate each step.
- If the same step fails twice, STOP and report the exact error. Do not loop.
- Ask a question only when blocked; otherwise state the assumption in the report.
- Small logical commits on the current branch; message format `type(scope): summary`.

## Definition of done (per task)
Lint, tests and build pass. Hard rules above hold. Contrast script run on touched screens.
Every new string in `en` and `hi`. Tests added for any new logic.

## Final report format (max 15 lines)
1. Done: screens/components built. 2. Not done / could not match design.
3. Assumptions. 4. Files changed (count + key paths). 5. Bundle size.
6. Contrast failures (if any). 7. Commands to run. 8. Next suggested task.