# Before I start designing these features, I need clarification on a few things:

**Radio Buttons:**
1. Should radio buttons have the same styling

_Started 2026-05-24 05:35 UTC_

---

## User

I would like to add in a new element - radio buttons. This will be different from the existing checkboxes.
The radio button element allows the user to add in multiple radio buttons within a single element but only one radio button can be selected at a time within the element(in contrast to the checkboxes that allow multiple checkboxes to be selected at once)
The user can add additional radio buttons in the properties pane when selected in a similar way to the checkbox field.

I also want to add in a persistent notes pane. This is to allow the user to document notes regarding the PowerForm design and is retained and saved throughout sessions. Saving the PowerForm design via the 'Save to File' option will also save the associated notes for this PowerForm and will be retained when the user imports a PowerForm into the Mockup Tool as well. The user can toggle viewing this notes pane through the ‘Tools’ menu at the top. The notes pane will also have a 32,000 character limit and there is a counter at the bottom of the pane displaying the current character count that is dynamic as the user types. The notes pane will also have a save button that will allow the user to manually save the notes that have been written. 

Ask for clarification before doing anything

## Assistant

_[tool: list_files]_

_[tool: grep]_

_[tool: questions_v2]_

Before I dive in, a few questions to make sure I build these the way you want:

## User

Questions answered:
- radio_layout: Same as checkboxes — flex-wrap horizontally
- radio_visual: Classic empty circle (○) / filled dot (●)
- radio_default: One empty option (same as checkbox default)
- radio_preselect: User-configurable in properties pane
- notes_position: Docked on the left side
- notes_default_visibility: Hidden by default — user opens via Tools menu
- notes_autosave: No autosave — only saves when Save button is clicked (unsaved changes lost on close)
- notes_unsaved_indicator: Yes — dot/asterisk on the Save button when there are unsaved changes
- notes_formatting: Plain text only
- char_limit_behavior: Hard stop — block further typing
- counter_style: '12,345 / 32,000'
- tools_menu: There is a tools menu already in the top bar

## Assistant

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: update_todos]_

Plan locked. I'll add a `radio` field type that mirrors the checkbox pattern, plus a left-docked Notes pane saved alongside the form. Let me apply the changes.

_[tool: str_replace_edit]_

### 1. constants.js — radio defaults + rect### 2. blocks.jsx — render radio group

_[tool: str_replace_edit]_

### 3. toolbar.jsx — radio tool

_[tool: str_replace_edit]_

### 4. panels.jsx — radio options editor + print rendering + NotesPane

_[tool: str_replace_edit]_

Now add the RadioOptionsEditor component and update the print preview:

_[tool: str_replace_edit]_

### 5. Add NotesPane component to panels.jsx

_[tool: str_replace_edit]_

### 6. menus.jsx — Notes toggle in Tools menu

_[tool: str_replace_edit]_

### 7. storage.jsx — include notes in save/load

_[tool: str_replace_edit]_

Now update the SaveSlotModal to accept notes:

_[tool: str_replace_edit]_

### 8. app.jsx — wire it all together

_[tool: str_replace_edit]_

Now wire menu, render NotesPane, and adjust form area's left offset:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Update SaveSlotModal call to include notes, and add radio block creator:

_[tool: str_replace_edit]_

## Assistant

_[tool: str_replace_edit]_

Now update `exportForm` JSON view to include notes:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

I introduced a shadow — the inner `notes` is sticky-notes; my added field uses `notesRef.current` which is fine. Let me make this cleaner by renaming the inner local:Now update toolbar.jsx to accept a `leftOffset` prop so it doesn't sit underneath the notes pane:

_[tool: str_replace_edit]_

Now load the file and check for errors:

_[tool: done]_

_[tool: update_todos]_

_[tool: fork_verifier_agent]_

Done. Both features are live:

**Radio buttons** — new "Radio group" tool in the Elements palette (Choices section). Renders ○/● circles, flex-wraps like checkboxes, but only one selectable at a time. Properties pane shows a "Radio buttons" editor where each row has a clickable circle to mark it as the preselected default (click again to clear). Removing the currently-default option clears the preselect automatically.

**Notes pane** — toggled via Tools → "Show Notes pane". Docks on the left at 320px wide. Hard-stops at 32,000 characters (paste over the cap is sliced, not dropped). Counter at bottom shows `X,XXX / 32,000` and turns amber within 500 chars of the cap, red at the limit. "Save notes" button shows a yellow dot when there are unsaved changes and goes disabled/grey after saving. ⌘S inside the textarea saves notes (not the file). Notes are saved with the form in both file export and browser slots, and restored on import. The floating Elements toolbar nudges right when the notes pane opens so it doesn't sit underneath.

Notes are intentionally **not** part of undo history — they're documentation, not design state, so rolling back the layout won't wipe your notes.

## User

Verifier agent check completed

## Assistant

Verifier confirmed both features working as expected.

