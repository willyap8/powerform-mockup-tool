import { useState } from 'react';
import { uid } from './constants';

const SAVE_FILE_VERSION = 1;
const SAVE_EXT = '.powerform.json';
const SLOTS_KEY = 'powerform.slots.v1';
const CURRENT_SLOT_KEY = 'powerform.currentSlot.v1';
export const MAX_SLOTS = 20;

// ---------------------------------------------------------------------------
// Serialize / deserialize
// ---------------------------------------------------------------------------
export function serializeDesign(form, notes) {
  // Block ids are stripped on save and regenerated on load, so a conditional
  // rule's `enableWhen.sourceId` (a block id) cannot survive verbatim. Translate
  // it to a stable array index here; deserializeDesign rebuilds the id from it.
  const idToIndex = {};
  form.blocks.forEach((b, i) => { idToIndex[b.id] = i; });
  const blocks = form.blocks.map((b) => {
    const out = { ...b };
    delete out.id;
    if (out.enableWhen && out.enableWhen.sourceId != null) {
      const idx = idToIndex[out.enableWhen.sourceId];
      const { sourceId, ...rest } = out.enableWhen;
      out.enableWhen = { ...rest, sourceIndex: idx == null ? -1 : idx };
    }
    return out;
  });
  return {
    fileType: 'powerform-mockup',
    version: SAVE_FILE_VERSION,
    savedAt: new Date().toISOString(),
    title: form.title || '',
    blocks,
    notes: typeof notes === 'string' ? notes : '',
  };
}

export function deserializeDesign(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('File is not valid JSON.');
  if (raw.fileType !== 'powerform-mockup') {
    throw new Error('This file is not a PowerForm mockup (missing fileType marker).');
  }
  if (typeof raw.version !== 'number') throw new Error('Missing version.');
  if (raw.version > SAVE_FILE_VERSION) {
    throw new Error('File was saved with a newer version of this tool (v' + raw.version + ').');
  }
  if (!Array.isArray(raw.blocks)) throw new Error('File has no blocks.');
  const blocks = raw.blocks.map((b) => ({ ...b, id: uid(b.type || 'b') }));
  // Second pass: rebuild conditional-rule source references now that every
  // block has a fresh id. Drop rules whose source no longer exists.
  blocks.forEach((b) => {
    if (b.enableWhen && b.enableWhen.sourceIndex != null) {
      const { sourceIndex, ...rest } = b.enableWhen;
      const source = blocks[sourceIndex];
      b.enableWhen = source ? { ...rest, sourceId: source.id } : undefined;
    }
  });
  return { title: raw.title || '', blocks, notes: typeof raw.notes === 'string' ? raw.notes : '' };
}

// ---------------------------------------------------------------------------
// File download / upload
// ---------------------------------------------------------------------------
export function downloadDesignFile(form, suggestedName, notes) {
  const payload = serializeDesign(form, notes);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const base = (suggestedName || form.title || 'PowerForm Mockup')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 80) || 'PowerForm Mockup';
  a.href = url;
  a.download = base + SAVE_EXT;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function openDesignFile(onLoaded, onError) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,.powerform.json,application/json';
  input.onchange = () => {
    const f = input.files && input.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result));
        const design = deserializeDesign(raw);
        onLoaded(design, { sourceName: f.name, savedAt: raw.savedAt });
      } catch (err) {
        onError && onError(err.message || String(err));
      }
    };
    reader.onerror = () => onError && onError('Could not read file.');
    reader.readAsText(f);
  };
  input.click();
}

// ---------------------------------------------------------------------------
// localStorage slots
// ---------------------------------------------------------------------------
export function loadSlots() {
  try {
    const raw = localStorage.getItem(SLOTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) { return {}; }
}

export function saveSlots(slots) {
  try {
    localStorage.setItem(SLOTS_KEY, JSON.stringify(slots));
    return true;
  } catch (e) { return false; }
}

export function saveToSlot(name, form, notes) {
  const slots = loadSlots();
  slots[name] = serializeDesign(form, notes);
  return saveSlots(slots);
}

export function deleteSlot(name) {
  const slots = loadSlots();
  delete slots[name];
  return saveSlots(slots);
}

export function getCurrentSlotName() {
  try { return localStorage.getItem(CURRENT_SLOT_KEY) || null; } catch (e) { return null; }
}
export function setCurrentSlotName(name) {
  try {
    if (name == null) localStorage.removeItem(CURRENT_SLOT_KEY);
    else localStorage.setItem(CURRENT_SLOT_KEY, name);
  } catch (e) { /* storage full or blocked */ }
}
export function getSlot(name) {
  const slots = loadSlots();
  return slots[name] || null;
}

// ---------------------------------------------------------------------------
// Shared modal styles
// ---------------------------------------------------------------------------
const modalBackdrop = {
  position: 'fixed', inset: 0, zIndex: 220,
  background: 'var(--ui-overlay)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Helvetica, sans-serif',
};
const modalCard = (w) => ({
  width: w, maxWidth: 'calc(100vw - 32px)',
  background: 'var(--ui-surface)', borderRadius: 10,
  boxShadow: '0 24px 60px var(--ui-shadow)',
  overflow: 'hidden',
});
const modalHeader = {
  padding: '12px 18px',
  borderBottom: '1px solid var(--ui-border-soft)',
  fontWeight: 600, fontSize: 14, color: 'var(--ui-text)',
};
const modalFooter = {
  padding: '12px 18px', background: 'var(--ui-surface-subtle)', borderTop: '1px solid var(--ui-border-soft)',
  display: 'flex', justifyContent: 'flex-end', gap: 8,
};
const btnSecondary = {
  padding: '6px 14px', fontSize: 12, fontWeight: 500,
  background: 'var(--ui-surface)', color: 'var(--ui-text-secondary)',
  border: '1px solid var(--ui-border-strong)', borderRadius: 6, cursor: 'pointer',
  fontFamily: 'inherit',
};
const btnPrimary = (enabled) => ({
  padding: '6px 14px', fontSize: 12, fontWeight: 600,
  background: enabled ? 'rgb(0, 48, 135)' : 'var(--ui-text-faint)',
  color: '#fff', border: 'none',
  borderRadius: 6, cursor: enabled ? 'pointer' : 'not-allowed',
  fontFamily: 'inherit',
});
const chip = (active) => ({
  padding: '3px 8px', fontSize: 11,
  background: active ? 'var(--ui-active)' : 'var(--ui-surface-muted)',
  color: active ? 'var(--ui-active-text)' : 'var(--ui-text-secondary)',
  border: '1px solid ' + (active ? 'var(--ui-active)' : 'var(--ui-border)'),
  borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
});

export function formatStamp(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch (e) { return ''; }
}

// ---------------------------------------------------------------------------
// Modal — Save to local slot
// ---------------------------------------------------------------------------
export function SaveSlotModal({ form, notes, initialName, onClose, onSaved }) {
  const [name, setName] = useState(() => (initialName == null ? '' : initialName));
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const slots = loadSlots();
  const slotNames = Object.keys(slots).sort();
  const isAtCap = slotNames.length >= MAX_SLOTS && !slots[name];
  const overwrites = !!slots[name];
  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && !isAtCap && (!overwrites || confirmOverwrite);

  const doSave = () => {
    if (!canSave) return;
    const ok = saveToSlot(trimmed, form, notes);
    if (!ok) { alert('Could not save — browser storage may be full or blocked.'); return; }
    onSaved && onSaved(trimmed);
  };

  return (
    <div style={modalBackdrop} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={modalCard(480)}>
        <div style={modalHeader}>Save to browser</div>
        <div style={{ padding: '16px 18px', color: 'var(--ui-text-secondary)', fontSize: 13, lineHeight: 1.55 }}>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--ui-text-muted)' }}>
            Saved in this browser only ({slotNames.length}/{MAX_SLOTS} slots used).
            Cleared if you clear site data. To share with the configuration team, use <strong>Save to file…</strong> instead.
          </p>
          <label style={{ display: 'block', fontWeight: 500, fontSize: 12, color: 'var(--ui-text-secondary)', marginBottom: 4 }}>Slot name</label>
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setConfirmOverwrite(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') doSave(); }}
            autoFocus
            style={{
              width: '100%', padding: '7px 9px', fontSize: 13,
              border: '1px solid var(--ui-border-strong)', borderRadius: 6,
              boxSizing: 'border-box', fontFamily: 'inherit',
              background: 'var(--ui-surface)', color: 'var(--ui-text)',
            }}
            placeholder="e.g. Nursing Assessment v3"
          />
          {overwrites && (
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 10, padding: 8, background: 'var(--ui-warning-bg)', border: '1px solid var(--ui-warning-border)', borderRadius: 6, fontSize: 12, color: 'var(--ui-warning-text)' }}>
              <input type="checkbox" checked={confirmOverwrite} onChange={(e) => setConfirmOverwrite(e.target.checked)} />
              <span>A slot named <strong>{trimmed}</strong> already exists. Overwrite it?</span>
            </label>
          )}
          {isAtCap && (
            <div style={{ marginTop: 10, padding: 8, background: 'var(--ui-danger-bg)', border: '1px solid var(--ui-danger-border)', borderRadius: 6, fontSize: 12, color: 'var(--ui-danger-text)' }}>
              You've reached {MAX_SLOTS} saved slots. Delete one from <em>Open from browser…</em> to free space, or save as a file instead.
            </div>
          )}
          {slotNames.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--ui-text-faint)', marginBottom: 6 }}>Existing slots</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {slotNames.map((n) => (
                  <button key={n} onClick={() => setName(n)} style={chip(n === name)}>{n}</button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={modalFooter}>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
          <button onClick={doSave} disabled={!canSave} style={btnPrimary(canSave)}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal — Open from local slot
// ---------------------------------------------------------------------------
export function OpenSlotModal({ onClose, onPick, dirty }) {
  const [slots, setSlots] = useState(loadSlots());
  const [confirmDelete, setConfirmDelete] = useState(null);
  const slotNames = Object.keys(slots).sort();

  const refresh = () => setSlots(loadSlots());
  const remove = (n) => { deleteSlot(n); refresh(); setConfirmDelete(null); };

  return (
    <div style={modalBackdrop} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={modalCard(520)}>
        <div style={modalHeader}>Open from browser</div>
        <div style={{ padding: '14px 18px 6px', color: 'var(--ui-text-secondary)', fontSize: 13 }}>
          {dirty && (
            <div style={{ marginBottom: 12, padding: 8, background: 'var(--ui-warning-bg)', border: '1px solid var(--ui-warning-border)', borderRadius: 6, fontSize: 12, color: 'var(--ui-warning-text)' }}>
              You have unsaved changes — opening another design will replace them.
            </div>
          )}
          {slotNames.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ui-text-faint)', fontSize: 13 }}>
              No saved slots yet. Use <em>File → Save to browser…</em> to create one.
            </div>
          ) : (
            <div style={{ maxHeight: 320, overflow: 'auto', margin: '0 -4px' }}>
              {slotNames.map((n) => {
                const s = slots[n];
                const blocks = (s && s.blocks) || [];
                const stickyCount = blocks.filter((b) => b.type === 'sticky').length;
                const fieldCount  = blocks.filter((b) => b.type === 'field').length;
                return (
                  <div key={n} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', margin: '2px 0',
                    border: '1px solid var(--ui-border-soft)', borderRadius: 6, background: 'var(--ui-surface)',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ui-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n}</div>
                      <div style={{ fontSize: 11, color: 'var(--ui-text-muted)', marginTop: 2 }}>
                        {fieldCount} field{fieldCount !== 1 ? 's' : ''} · {stickyCount} note{stickyCount !== 1 ? 's' : ''}
                        {s && s.savedAt && <span> · saved {formatStamp(s.savedAt)}</span>}
                      </div>
                    </div>
                    {confirmDelete === n ? (
                      <>
                        <span style={{ fontSize: 11, color: 'var(--ui-danger-text)' }}>Delete?</span>
                        <button onClick={() => remove(n)} style={{ ...btnSecondary, color: '#fff', background: '#dc2626', borderColor: '#dc2626' }}>Yes</button>
                        <button onClick={() => setConfirmDelete(null)} style={btnSecondary}>No</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => onPick(n, slots[n])} style={btnPrimary(true)}>Open</button>
                        <button onClick={() => setConfirmDelete(n)} style={btnSecondary} title="Delete">🗑</button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div style={modalFooter}>
          <button onClick={onClose} style={btnSecondary}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal — Unsaved-changes confirm
// ---------------------------------------------------------------------------
export function ConfirmDiscardModal({ message, confirmLabel, onCancel, onConfirm }) {
  return (
    <div style={modalBackdrop} onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} style={modalCard(420)}>
        <div style={modalHeader}>Unsaved changes</div>
        <div style={{ padding: '16px 18px', color: 'var(--ui-text-secondary)', fontSize: 13, lineHeight: 1.55 }}>
          {message}
        </div>
        <div style={modalFooter}>
          <button onClick={onCancel} style={btnSecondary}>Cancel</button>
          <button onClick={onConfirm} style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 600,
            background: '#dc2626', color: '#fff', border: 'none',
            borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
          }}>{confirmLabel || 'Discard and continue'}</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AutosaveIndicator — dirty/clean badge + save button shown in the top bar
// ---------------------------------------------------------------------------
export function AutosaveIndicator({ slotName, dirty, onClickSave }) {
  let label, bg, border, color, dotColor;
  if (dirty) {
    label = 'Unsaved changes' + (slotName ? ' · ' + slotName : '');
    bg = 'var(--ui-warning-bg)'; border = 'var(--ui-warning-border)'; color = 'var(--ui-warning-text)'; dotColor = '#f59e0b';
  } else if (slotName) {
    label = 'Saved · ' + slotName;
    bg = 'var(--ui-success-bg)'; border = 'var(--ui-success-border)'; color = 'var(--ui-success-text)'; dotColor = '#10b981';
  } else {
    label = 'Not yet saved';
    bg = 'var(--ui-surface-subtle)'; border = 'var(--ui-border)'; color = 'var(--ui-text-muted)'; dotColor = 'var(--ui-text-faint)';
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 6px 4px 10px',
      borderRadius: 999,
      background: bg,
      border: '1px solid ' + border,
      fontSize: 11,
      color,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor }} />
      <span>{label}</span>
      <button
        onClick={onClickSave}
        title="Save to browser (⌘S / Ctrl+S)"
        style={{
          marginLeft: 4,
          width: 24, height: 22,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--ui-surface)', color: 'var(--ui-text-secondary)',
          border: '1px solid var(--ui-border-strong)', borderRadius: 6,
          cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
        }}
      >💾</button>
    </div>
  );
}
