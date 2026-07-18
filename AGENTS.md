# AGENTS.md

This file is the canonical repository guide for coding agents working on this project. `CLAUDE.md` is only a compatibility entrypoint; update this file when project guidance changes.

## Commands

```bash
npm run dev       # dev server (hot reload)
npm run build     # production build → dist/index.html (single file)
npm run preview   # preview the production build locally
npm test          # run the Vitest unit tests once (vitest run)
npm run test:watch # run Vitest in watch mode
```

Tests are Vitest unit tests covering the pure logic only (serialize/deserialize
round-trip, conditional-logic scoring, `cloneForm`, and theme resolution), in `src/__tests__/`.
They run in the `node` environment with a stubbed `localStorage` — there is no
DOM/component rendering. No linter is configured.

## What This Is

A browser-based drag-and-drop mockup tool for designing **Eastern Health PowerForm** clinical forms. Users place labelled heading bars and form fields on a freeform canvas, then export the design as a `.powerform.json` file or print to PDF.

The production build is a **single self-contained HTML file** (via `vite-plugin-singlefile`) with no external dependencies — this is intentional so it can be shared as a standalone artifact.

## Architecture

Application state is coordinated by `src/app.jsx` (one large root component — no external state manager), with small view preferences encapsulated in hooks. The key state pieces:

- `form` — `{ title, blocks[] }` — the live canvas
- `history[]` + `historyIndex` — undo/redo stack (max 50 entries); mutations go through `commit(newForm, description)` or `commitCurrent(description)`
- `selectedIds[]`, `activeTool`, `editingId` — selection and tool mode
- `tweaks` — grid snap and other view options (from `useTweaks` in `tweaks-panel.jsx`)
- `themePreference`, `resolvedTheme` — persistent Light/Dark/System interface theme (from `useAppTheme` in `theme.jsx`)

**Block model** — every element on the canvas is a "block" with a `type`:
- Heading bars: `formHeading`, `heading1`, `heading2`, `subSection` — fixed widths from `BAR_STYLES` in `constants.js`
- `field` — has a `fieldType`: `text | number | date | time | checkbox | radio | dropdown | textarea`
- `text` — has a `variant`: `label | general | instructional | instructionalBold`
- `sticky` — yellow sticky note for configuration team comments

Block geometry helpers (`getBlockRect`, `isHeadingType`, `describeBlock`) and the fixed canvas style tokens live in `src/constants.js`. Those tokens are derived from the **Eastern Health PowerForm Style Guide v1.6** — do not change canvas colours or fonts without a style guide reference. Interface-only light/dark tokens live in `src/theme.jsx` and must not affect the canvas or print output.

**Module breakdown:**

| File | Responsibility |
|------|---------------|
| `src/app.jsx` | Root component, all state, drag/drop, keyboard shortcuts, click-to-place |
| `src/blocks.jsx` | Visual renderers for each block type + `InlineEdit` |
| `src/toolbar.jsx` | Floating draggable toolbox for placing new elements |
| `src/panels.jsx` | `HistoryPanel`, `PropertiesPanel`, `ContextMenu`, `PrintOptionsDialog`, `NotesPane` |
| `src/menus.jsx` | Menu bar and `StyleGuideModal` |
| `src/storage.jsx` | localStorage slot persistence (max 20 slots), file download/upload (`.powerform.json`) |
| `src/theme.jsx` | Persistent Light/Dark/System preference, system-theme listener, interface theme tokens, top-bar toggle |
| `src/tweaks-panel.jsx` | Bottom-right floating panel and `useTweaks` hook for grid snap settings |
| `src/constants.js` | Style tokens, block defaults, `uid()`, `buildDemoForm()`, geometry helpers |

## Persistence

- **localStorage** — up to 20 named save slots (`powerform.slots.v1`), with manual save and ⌘S/Ctrl+S quick-save to the current slot
- **Theme preference** — Light/Dark/System stored under `powerform.theme.v1`; System follows `prefers-color-scheme`
- **File export/import** — `.powerform.json` files; format versioned with `SAVE_FILE_VERSION` in `storage.jsx`

## Design Files

`project/` contains the original HTML prototype from the design handoff. `chats/` has the chat transcripts that explain design intent. The `src/` implementation is the production React version of those prototypes.
