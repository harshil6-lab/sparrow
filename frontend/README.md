# Sparrow — The Indian Energy Saver (frontend)

Vite + React + TypeScript + Tailwind. Design system and illustrations are
reused from the Figma Make export; this app is the Run A foundation only
(splash, welcome, login, story gate, setup, ready, and an app-shell stub).

## Commands

```bash
npm install          # install dependencies
npm run dev          # dev server on http://localhost:5173
npm run build        # type-check + production build
npm run preview      # preview the production build
npm run lint         # eslint
npm run test         # vitest (unit tests)
npm run test:contrast # WCAG AA contrast audit of the design tokens
```

Copy `.env.example` to `.env` to configure `VITE_USE_MOCK` and `VITE_STORY_URL`.

## Routes

| Route        | Screen                                            |
| ------------ | ------------------------------------------------- |
| `/`          | Splash (language pill lives here)                 |
| `/welcome`   | Welcome landing                                   |
| `/login`     | Login (email + simulated Google)                  |
| `/story`     | Story gate (first run)                            |
| `/setup`     | Setup, 5 steps                                    |
| `/ready`     | "Your Nest is ready"                              |
| `/app`       | App shell stub (Home/Missions/Learn/Solar/Me)     |
| `/app/story` | Story player in "Watch again" mode                |

## Structure

- `src/styles/tokens.css` — design tokens (colours, radii, type scale, spacing)
- `src/styles/sparrow.css` — vendored design stylesheet from the Figma export
- `src/styles/app.css` — additive styles for the new primitives (no restyling)
- `src/components/ui/*` — Button, Sheet (focus trap), ProgressBar, OptionCard, LanguageList
- `src/components/SparrowMascot.tsx` — 4 poses (curious, hop, ruffled, celebrate)
- `src/components/scenes/*` — illustrations (neighbourhood, editorial, setup, leaves)
- `src/lib/api/*` — auth + profile interfaces, mock implementations, Cognito stub
- `src/data/cities.json` — ~130 Indian cities grouped by state

## Notes

- Every non-user figure is labelled `SAMPLE`; new users see zeros.
- No phone/OTP. Auth and API sit behind interfaces; mock is selected by `VITE_USE_MOCK=true`.
- Fonts are self-hosted via `@fontsource`; per-script Noto fonts load only for the active language.
