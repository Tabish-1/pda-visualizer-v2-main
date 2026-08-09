# PDA Visualiser

An interactive web application for visualising and simulating Pushdown Automata,
supporting both **deterministic (DPDA)** and **nondeterministic (NPDA)** execution.
Built with Next.js and TypeScript.

## Features

- **Dual execution modes.** DPDA follows a single path; NPDA explores every branch
  in parallel, each with its own stack.
- **Static determinism checking.** Reports which transitions compete and whether the
  conflict is resolvable in DPDA mode.
- **Full playback control.** Step forward, step backward, play, pause, jump to end,
  reset, adjustable speed, and a scrubber over the whole run.
- Layered state diagram with active-state highlighting and `read, pop → push` labels.
- Per-branch stack visualisation with a branch selector in NPDA mode.
- Input tape with read-head tracking, and a step log derived from the selected branch.
- Validation for unknown states, unreachable states, and off-alphabet symbols.
- Save and load machines as JSON.
- Dark and light themes, keyboard shortcuts.

## Tech Stack

- Next.js 16 (App Router), React 19, TypeScript
- HTML5 Canvas for the state diagram
- Hand-written CSS design system — no CSS framework and no PostCSS plugins

Runtime dependencies are just `next`, `react`, `react-dom`, and `lucide-react`.
Both test suites are built on tooling already present (`tsc`, Node's test runner,
and the system Chrome), so no test framework or browser driver is installed.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm test` | Engine test suite (71 tests) |
| `npm run test:browser` | Browser test suite (64 checks) |
| `npm run typecheck` | TypeScript with no emit |
| `npm run lint` | ESLint |

`npm test` compiles the engine with `tsconfig.test.json` into `.test-build/` and runs
Node's built-in test runner. The engine is pure TypeScript with no React or DOM
dependency, which is what makes this possible without a test framework.

`npm run test:browser` needs a dev server already running (`npm run dev` in another
terminal). It drives the system Chrome or Edge over the DevTools Protocol via
`scripts/cdp.mjs`, covering what the engine tests cannot: canvas painting, click
handling, playback timing, theme repaint, keyboard shortcuts and hydration.

## DPDA vs NPDA

**DPDA mode** follows exactly one path. When both an input-consuming move and an
ε-move apply, it takes the consuming move and saves the ε-move for end of input.
This is the standard convention that lets a machine use an ε-move as its accept step
without being nondeterministic.

**NPDA mode** follows every applicable move, so a single input produces a tree of
configurations. Each live branch keeps its own stack, and the string is accepted as
soon as any branch reaches an accepting configuration.

The determinism checker distinguishes two kinds of conflict:

- **Hard** — two consuming moves on the same `(state, read, pop)`, or two ε-moves on
  the same stack top. Nothing can choose between them, so DPDA mode cannot run the
  machine faithfully.
- **Soft** — an ε-move competing with a consuming move, resolved by the priority rule
  above. Legal for a DPDA, but be aware it can accept a *smaller* language than NPDA
  mode would. The `wwᴿ` example demonstrates exactly this: DPDA rejects `abba`,
  NPDA accepts it.

## Defining a PDA

Transitions follow the usual notation:

```
δ(from_state, read_symbol, pop_symbol) → (to_state, push_symbols)
```

- Use `ε` (or leave the field blank) to read nothing, pop nothing, or push nothing.
- **The first state you list is the start state.** Mark accept states with `*`,
  e.g. `q0, q1, q2*`.
- Pushes are written top-symbol-first: pushing `AZ0` leaves `Z0` at the bottom of the
  stack and `A` on top.
- The bottom marker defaults to `Z0`. Clear the field for a machine that starts with
  a genuinely empty stack.

### Acceptance modes

| Mode | Accepts when |
|---|---|
| Final state (default) | In an accept state with all input consumed |
| Empty stack | Stack empty with all input consumed |
| Both | Both conditions hold |

Under empty-stack acceptance, a stack holding only the bottom marker counts as empty.

## Keyboard Shortcuts

| Key | Action |
|---|---|
| Space | Play / pause |
| → | Step forward |
| ← | Step backward |
| R | Reset |

## Project Structure

```
scripts/            # cdp.mjs (CDP client) + browser-test.mjs
src/
├── app/            # Next.js route, layout, global CSS
├── components/     # Presentational components
├── engine/         # Simulation: symbols, analysis, simulate, examples
│   └── __tests__/  # Engine test suite
├── hooks/          # Playback, theme, keyboard
├── lib/            # Graph layout, canvas renderer, draft/file parsing
└── types/          # Shared domain types
```

`simulate()` returns the entire execution tree up front as an immutable trace, so
playback is just an index into it. That is what makes step-backward, pause and
live speed changes work without any risk of desynchronising the view.

## License

MIT — see [LICENSE](LICENSE).

## Known Limitations

- The start state is always the first state listed; there is no separate picker.
- Very large NPDA searches stop at configurable bounds and report `incomplete` rather
  than guessing a verdict.
