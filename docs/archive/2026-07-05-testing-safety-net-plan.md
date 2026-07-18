# Implementation Plan: Test Safety Net + Corrupt-Slot Bug Fix

> **Status: Completed 2026-07-05.** This document is retained for historical context only. Its implementation instructions, repository-state notes, and unchecked acceptance criteria are not current guidance; see the repository-root `AGENTS.md` for the canonical project guide.

**Audience:** a fresh Claude Code (Opus 4.8) session with no prior context.
**Read first:** `HANDOVER.md` and `AGENTS.md` in the repo root, then this plan.

---

## 1. Context

This repo is a browser-based drag-and-drop mockup tool for designing Eastern Health
PowerForm clinical forms (React 18 + Vite, plain JS/JSX, no TypeScript). Users design
forms on a canvas, save them to browser localStorage "slots" or export them as
`.powerform.json` files, and print them to PDF for handoff to a configuration team.

**There is currently no test runner, no linter, and zero automated tests.** The riskiest
code is pure logic where a silent regression corrupts users' saved designs:

- `src/storage.jsx` — save/load. Block ids are stripped on save and regenerated on
  load, so conditional-logic rules (`enableWhen.sourceId`) are remapped to array
  indexes (`sourceIndex`) on save and back to fresh ids on load. An off-by-one here
  silently mis-wires or drops rules in every saved design.
- `src/constants.js` — conditional-logic evaluation (`scoreOf`, `evaluateEnabled`,
  `describeRule`, `OPERATORS`): 6 operators × 4 source field types × fallback rules.
- `src/app.jsx` — `cloneForm` (undo/history deep-clone). A missed nested field here
  causes undo history entries to share state and corrupt each other.

There is also one confirmed bug to fix (section 4).

## 2. Objective and scope

1. Add **Vitest** with a minimal config and an `npm test` script.
2. Write focused unit tests (~20–30 assertions) for the pure logic listed above.
3. Fix the **corrupt-slot overwrite bug** in `src/app.jsx` (section 4).
4. Update `HANDOVER.md` and canonical `AGENTS.md` when done (section 8).

**Out of scope — do not do these:** no linter, no TypeScript, no component/DOM
rendering tests (no React Testing Library), no refactor of the print-preview
duplication (that is a separate planned task), no new app features, no dependency
upgrades beyond what this plan adds.

## 3. Process rules (important)

- Work on a feature branch (e.g. `test-safety-net`), then **merge to `main`
  directly**. Pull requests are disabled on the GitHub repo (`/pulls` 404s) — do not
  attempt to open one.
- Do **not** push to the remote unless the user asks; `main` is currently local-only.
- Match the existing code style: plain JS, semicolons, single quotes, no JSX in
  non-component helpers, comments only where behaviour is non-obvious.
- The user has minimal VSCode/coding experience — when reporting back, explain in
  plain language how to run the tests.

## 4. Bug fix: corrupt slot gets silently overwritten by the demo form

**Where:** `src/app.jsx`, the `initialStateRef` initializer near the top of `App()`
(currently around lines 53–71).

**Current behaviour:** on startup the app reads the "current slot" name from
localStorage and tries to load that slot. If `deserializeDesign(slot)` **throws**
(corrupt/truncated payload), the `catch` falls back to the demo form — but
`slotName` is still recorded (`slotName: slot ? slotName : null`, and `slot` is
truthy). So `currentSlot` state stays attached to the broken slot, the top-bar badge
claims that slot is active, and the user's next ⌘S / quick-save **overwrites the
possibly-recoverable saved design with the demo form**.

**Required behaviour:** when the slot payload exists but fails to deserialize:

1. Load the demo form (as now).
2. Detach from the slot: the initial state must carry `slotName: null` so
   `currentSlot` starts as `null` and quick-save opens the Save-As modal instead of
   writing to the broken slot.
3. Clear the persisted current-slot pointer (`setCurrentSlotName(null)` from
   `storage.jsx`) — but **not during render**; do it in a mount `useEffect` guarded
   by a flag recorded in `initialStateRef` (e.g. `loadFailed: true`). Leave the
   corrupt slot payload itself untouched in `powerform.slots.v1` so it is still
   recoverable by hand.
4. Make the failure visible: set the initial history description to something like
   `"Could not read saved slot '<name>' — loaded demo form instead"` so it shows in
   the history panel. (An `alert()` on mount is acceptable too but keep it simple.)

Note the same pattern for a *missing* slot (name points at a deleted slot) is already
handled correctly in `handleQuickSave` — only the *corrupt* path is broken.

## 5. Prerequisite refactor: make `cloneForm` testable

`cloneForm` is a module-level pure function defined inside `src/app.jsx` (not
exported). Move it to `src/constants.js`, export it, and import it in `app.jsx`.
Behaviour must be identical — it deep-copies `options`, `optionWeights`, and
`enableWhen` per block. Do not move anything else out of `app.jsx`.

## 6. Vitest setup

Current `package.json` devDependencies: `@vitejs/plugin-react`, `gh-pages`, `vite@^5`,
`vite-plugin-singlefile`. `vite.config.js` registers `react()` and `viteSingleFile()`.

1. `npm install -D vitest` (a Vitest 2.x version compatible with Vite 5).
2. Configure via a `test` block added to the existing `vite.config.js` (Vitest reads
   it automatically). Use `environment: 'node'` — the tests below only cover pure
   functions and a stubbed localStorage; do **not** add jsdom/happy-dom. If
   `viteSingleFile()` interferes with the test pipeline (it shouldn't, it's
   build-phase), fall back to a separate minimal `vitest.config.js` with only the
   react plugin.
3. Add scripts: `"test": "vitest run"` and `"test:watch": "vitest"`.
4. Put tests in `src/__tests__/` (e.g. `storage.test.js`, `conditional-logic.test.js`,
   `clone-form.test.js`).

Note: importing from `src/storage.jsx` pulls in React (it also exports components);
that is fine under the react plugin transform in node environment — the tests just
never render anything.

## 7. Test cases

Use small hand-built fixture forms (a few blocks incl. a radio group with
`optionWeights`, a checkbox group, a number field, and a field carrying `enableWhen`).
A helper that builds the fixture per test avoids shared-state bleed.

### 7.1 `storage.test.js` — serialize/deserialize round-trip

From `src/storage.jsx`: `serializeDesign`, `deserializeDesign`, and the slot helpers.

Round-trip (`deserializeDesign(serializeDesign(form, notes))`):
- preserves title, notes, and every block's type/geometry/labels/options/optionWeights/
  mandatory/selectedIndex.
- ids are stripped in the serialized payload (no block has `id`) and regenerated on
  load: every loaded block has an id, all ids unique.
- envelope fields present: `fileType: 'powerform-mockup'`, numeric `version`,
  ISO `savedAt` string.

Conditional-logic remapping (the critical cases):
- a rule whose source is at index *k* serializes to `enableWhen.sourceIndex === k`
  with `sourceId` removed; after loading, the target block's `enableWhen.sourceId`
  equals the **new** id of the block at index *k* (verify by matching on a unique
  label, not by id value). `op` and `value` survive unchanged.
- rule works regardless of whether the source block appears before or after the
  target in the blocks array.
- source block deleted before save (dangling `sourceId`) → serializes with
  `sourceIndex: -1` → rule is dropped (`enableWhen === undefined`) on load.
- hand-crafted payload with out-of-range `sourceIndex` (e.g. 99) → rule dropped on
  load, no throw.

Validation errors (`deserializeDesign` throws for each):
- `null` / non-object input; wrong or missing `fileType`; missing/non-numeric
  `version`; `version` greater than the current `SAVE_FILE_VERSION`; missing or
  non-array `blocks`.
- non-string `notes` in the payload → loads as `''` (no throw).

Slot helpers (`loadSlots`, `saveSlots`, `saveToSlot`, `getSlot`, `deleteSlot`) with a
stubbed localStorage (Map-backed object assigned via `vi.stubGlobal('localStorage', …)`,
reset in `beforeEach`):
- saveToSlot → getSlot round-trip; deleteSlot removes; loadSlots returns `{}` when
  the stored JSON is corrupt; saveSlots returns `false` when `setItem` throws
  (simulated quota error).

### 7.2 `conditional-logic.test.js` — scoring and gating

From `src/constants.js`: `scoreOf`, `evaluateEnabled`, `describeRule`, `OPERATORS`,
`isScoreableField`.

`scoreOf`:
- number field: `'7'` → 7; garbage/undefined → 0.
- radio: live value `[idx]` wins over `selectedIndex`; falls back to `selectedIndex`
  when live value absent; no selection at all → 0; index with missing/NaN weight → 0.
- checkbox: sums weights of checked options only (`[true, false, true]` pattern);
  empty/absent value → 0.
- dropdown: live value is the option *text* — matches its weight; unknown text → 0;
  falls back to `selectedIndex` when value empty.

`evaluateEnabled`:
- block without a rule → `true`; rule with dangling `sourceId` → `true` (no gate);
  unknown `op` → `true`.
- all six operators (`eq ne lt gt le ge`) tested at, below, and above the threshold
  via a number source field.
- non-numeric `rule.value` coerces to 0 (e.g. `ge` vs score 0 → enabled).

`describeRule`:
- uses the source's trimmed label; falls back to `describeBlock` output when label
  empty; `'(deleted field)'` when source missing; returns `''` when no rule.

`isScoreableField`: true only for field blocks of type number/radio/checkbox/dropdown.

### 7.3 `clone-form.test.js` — undo-history deep clone

From `src/constants.js` (after the section 5 move): `cloneForm`.
- clone equals the original structurally but shares no references: mutating the
  clone's `options`, `optionWeights`, and `enableWhen` does not affect the original
  (and vice versa).
- blocks without those optional props survive unchanged (`undefined` stays absent-ish,
  matching current behaviour).

## 8. Verification and wrap-up

1. `npm test` — all tests pass.
2. `npm run build` — production build still succeeds (proves the config change didn't
   break the singlefile build).
3. `npm run dev` — app loads, and the bug-fix path behaves: with dev tools, corrupt
   the current slot's JSON in localStorage (`powerform.slots.v1`), reload → demo form
   loads, badge shows "Not yet saved", ⌘S opens the Save-As modal (does **not**
   overwrite the slot), and the corrupt payload is still present in localStorage.
4. Update `AGENTS.md`: replace "No test runner or linter is configured" with a line
   documenting `npm test` (Vitest, pure-logic tests in `src/__tests__/`).
5. Prepend a session entry to `HANDOVER.md` per its format rules.
6. Commit on the branch, merge to `main` directly (no PR), delete the branch. Do not
   push.

## 9. Acceptance criteria

- [ ] `npm test` runs Vitest and passes; `npm run build` and `npm run dev` unaffected.
- [ ] Round-trip, remapping, validation, slot, scoring, gating, and clone cases from
      section 7 are all covered.
- [ ] Corrupt slot on startup no longer leaves the slot attached; quick-save cannot
      overwrite it; payload left intact; failure visible in history description.
- [ ] `cloneForm` lives in `src/constants.js` and `app.jsx` imports it; no other
      app behaviour changed.
- [ ] `AGENTS.md` and `HANDOVER.md` updated.
