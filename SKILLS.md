# Skills.md — task playbooks for Sparrow

Open only the section for your current task. Each is a short checklist, not a tutorial.

## S1. Add or change a visible string
1. Add the key to `i18n/en.json` first (short, plain sentences).
2. Add the Hindi value to `i18n/hi.json`. Other languages: leave missing; fallback = English.
3. Use `t('key')` in the component. Never hardcode UI text, including "STEP 1 OF 5" and labels.
4. Keys: `area.element` (e.g. `setup.step1.title`). No sentences as keys.

## S2. Build a screen from Premium Energy Saver App
1. Find the screen: `rg -n "ScreenName|route" Premium Energy Saver App/src`. Read only that file and its imports.
2. Copy reusable pieces (SVG scenes, tokens) into `frontend/src/components/`; keep names.
3. Replace inline text with i18n keys (S1) and mock data with the API interface (S6).
4. Match spacing, radius and type from tokens. Do not restyle.
5. Check at 360px and a laptop width. Run contrast script (S4) on the screen.

## S3. Add a bottom sheet
Use the shared `Sheet` component: focus trap, Esc closes, backdrop click closes, returns focus
to the trigger, `role="dialog"` with `aria-labelledby`. Content scrolls inside; footer buttons stay
visible; safe-area bottom padding. Never build a one-off modal.

## S4. Contrast check (run on every touched screen)
Create `frontend/scripts/contrast.mjs` once. It reads token pairs from `src/styles/tokens.css`
and prints ratio per allowed pairing (WCAG relative luminance). Fail the task if body text < 4.5
or large text < 3. Known risks: turmeric on cream (never for text), cream on terracotta (use
terracotta-deep). Report failures in the final report.

## S5. Story gate (critical logic)
- State: `profile.introSeen`, `profile.setupDone`.
- After login: not introSeen -> `/story`; introSeen and not setupDone -> `/setup`; else `/app`.
- `/story`: muted autoplay, `playsInline`, Skip pill visible from second 0, captions via `<track>`,
  "Tap for sound", large Play if autoplay blocked.
- On end, Skip or video error: `setIntroSeen(true)` then navigate onward.
- "Watch again" (from Profile): play without touching `introSeen`.
- If `VITE_STORY_URL` is unset or fails: show the 5 illustrated frames with Continue.
- Keep this logic in one pure function `nextRoute(profile)`; unit test every branch.

## S6. API and auth via interfaces
- `src/api/index.ts` exports an interface; `mock.ts` implements it with localStorage keyed by user id.
- Methods so far: `getProfile`, `saveSetup`, `setIntroSeen`, `getDashboard`, `addBill`, `getBills`,
  `completeMission`, `deleteMe`.
- Real implementation (`http.ts`) is added later and selected by `VITE_USE_MOCK=false`. Do not
  build it until told. Same for auth: `AuthProvider` interface, mock now, Cognito stub marked.

## S7. Add a language
1. Add to `i18n/languages.json` with `reviewed:false` (shows a "beta" tag).
2. Create the locale JSON (copy `en.json` keys; translate later).
3. Add the matching `@fontsource/noto-sans-<script>` and load it only when active.
4. Test with the longest strings: layouts must tolerate ~40% longer text (Tamil, Malayalam).
Marathi uses the Devanagari font. Punjabi uses Gurmukhi.

## S8. Scene and mascot components
- One component per illustration, named by screen (`SplashScene`, `StoryFrame1`, ...). No reuse
  of the same scene across screens (the design requires unique art per screen).
- Sparrow poses: `curious | hop | ruffled | celebrate`. Pose matches the line it speaks.
- Speech bubble sits in clear sky beside the sparrow, never over houses or the tree.
- Animation: `transform` and `opacity` only. Reduced motion = static.

## S9. Splash falling leaves
30-40 leaves, 3 shapes, greens + turmeric + terracotta. Depth by size, speed, blur (near = large,
fast; far = small, slow). CSS keyframes with randomised custom properties; no JS per frame.
Pause when the tab is hidden. Static fallback for reduced motion.

## S10. Tests
Vitest + testing-library. Required: `nextRoute` branches, i18n fallback to English, mock auth,
`SAMPLE` badge present on non-user numbers, zero state for new users. Test behaviour, not markup.

## S11. Commit and report
Commit per logical unit: `feat(setup): city search with free-text option`. Do not commit
`node_modules`, `dist`, `.env`. End with the report format from `AGENTS.md`.

## S12. When blocked
State the exact blocker, what you tried (max 2 attempts), and the smallest input you need.
Never fabricate design, data, sources or numbers to keep going.