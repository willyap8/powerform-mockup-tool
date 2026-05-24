import { useState, useEffect } from 'react';
import { uid } from './constants';

const SAVE_FILE_VERSION = 1;
const SAVE_EXT = '.powerform.json';
const SLOTS_KEY = 'powerform.slots.v1';
const CURRENT_SLOT_KEY = 'powerform.currentSlot.v1';
export const MAX_SLOTS = 10;

// ---------------------------------------------------------------------------
// Serialize / deserialize
// ---------------------------------------------------------------------------
export function serializeDesign(form, notes) {
  const blocks = form.blocks.map((b) => {
    const out = { ...b };
    delete out.id;
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
  background: 'rgba(15, 23, 42, 0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Helvetica, sans-serif',
};
const modalCard = (w) => ({
  width: w, maxWidth: 'calc(100vw - 32px)',
  background: '#fff', borderRadius: 10,
  boxShadow: '0 24px 60px rgba(15,23,42,0.3)',
  overflow: 'hidden',
});
const modalHeader = {
  padding: '12px 18px',
  borderBottom: '1px solid #ececef',
  fontWeight: 600, fontSize: 14, color: '#111827',
};
const modalFooter = {
  padding: '12px 18px', background: '#fafafa', borderTop: '1px solid #ececef',
  display: 'flex', justifyContent: 'flex-end', gap: 8,
};
const btnSecondary = {
  padding: '6px 14px', fontSize: 12, fontWeight: 500,
  background: '#fff', color: '#374151',
  border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer',
  fontFamily: 'inherit',
};
const btnPrimary = (enabled) => ({
  padding: '6px 14px', fontSize: 12, fontWeight: 600,
  background: enabled ? 'rgb(0, 48, 135)' : '#9ca3af',
  color: '#fff', border: 'none',
  borderRadius: 6, cursor: enabled ? 'pointer' : 'not-allowed',
  fontFamily: 'inherit',
});
const chip = (active) => ({
  padding: '3px 8px', fontSize: 11,
  background: active ? '#1f2937' : '#f3f4f6',
  color: active ? '#fff' : '#374151',
  border: '1px solid ' + (active ? '#1f2937' : '#e5e7eb'),
  borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
});

export function formatStamp(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch (e) { return ''; }
}

export function relativeTime(iso) {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 30 * 1000)             return 'just now';
    if (diff < 60 * 1000)             return Math.floor(diff / 1000) + ' sec ago';
    if (diff < 60 * 60 * 1000)        return Math.floor(diff / 60000) + ' min ago';
    if (diff < 24 * 60 * 60 * 1000)   return Math.floor(diff / 3600000) + ' hr ago';
    return d.toLocaleDateString();
  } catch (e) { return ''; }
}

// ---------------------------------------------------------------------------
// Modal — Save to local slot
// ---------------------------------------------------------------------------
export function SaveSlotModal({ form, notes, onClose, onSaved }) {
  const [name, setName] = useState((form.title || '').trim() || 'My PowerForm');
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
        <div style={{ padding: '16px 18px', color: '#374151', fontSize: 13, lineHeight: 1.55 }}>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6b7280' }}>
            Saved in this browser only ({slotNames.length}/{MAX_SLOTS} slots used).
            Cleared if you clear site data. To share with the configuration team, use <strong>Save to file…</strong> instead.
          </p>
          <label style={{ display: 'block', fontWeight: 500, fontSize: 12, color: '#374151', marginBottom: 4 }}>Slot name</label>
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setConfirmOverwrite(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') doSave(); }}
            autoFocus
            style={{
              width: '100%', padding: '7px 9px', fontSize: 13,
              border: '1px solid #d1d5db', borderRadius: 6,
              boxSizing: 'border-box', fontFamily: 'inherit',
              background: '#fff', color: '#111827',
            }}
            placeholder="e.g. Nursing Assessment v3"
          />
          {overwrites && (
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 10, padding: 8, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, fontSize: 12, color: '#92400e' }}>
              <input type="checkbox" checked={confirmOverwrite} onChange={(e) => setConfirmOverwrite(e.target.checked)} />
              <span>A slot named <strong>{trimmed}</strong> already exists. Overwrite it?</span>
            </label>
          )}
          {isAtCap && (
            <div style={{ marginTop: 10, padding: 8, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 12, color: '#991b1b' }}>
              You've reached {MAX_SLOTS} saved slots. Delete one from <em>Open from browser…</em> to free space, or save as a file instead.
            </div>
          )}
          {slotNames.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, color: '#9ca3af', marginBottom: 6 }}>Existing slots</div>
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
        <div style={{ padding: '14px 18px 6px', color: '#374151', fontSize: 13 }}>
          {dirty && (
            <div style={{ marginBottom: 12, padding: 8, background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, fontSize: 12, color: '#92400e' }}>
              You have unsaved changes — opening another design will replace them.
            </div>
          )}
          {slotNames.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
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
                    border: '1px solid #ececef', borderRadius: 6, background: '#fff',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n}</div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                        {fieldCount} field{fieldCount !== 1 ? 's' : ''} · {stickyCount} note{stickyCount !== 1 ? 's' : ''}
                        {s && s.savedAt && <span> · saved {formatStamp(s.savedAt)}</span>}
                      </div>
                    </div>
                    {confirmDelete === n ? (
                      <>
                        <span style={{ fontSize: 11, color: '#b91c1c' }}>Delete?</span>
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
        <div style={{ padding: '16px 18px', color: '#374151', fontSize: 13, lineHeight: 1.55 }}>
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
// AutosaveIndicator — text + save button shown in the top bar
// ---------------------------------------------------------------------------
export function AutosaveIndicator({ slotName, lastSavedAt, onClickSave }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!lastSavedAt) return;
    const id = setInterval(() => setTick((t) => t + 1), 30 * 1000);
    return () => clearInterval(id);
  }, [lastSavedAt]);

  let label;
  if (!slotName || !lastSavedAt) {
    label = 'Last autosave: never';
  } else {
    label = 'Last autosave: ' + relativeTime(lastSavedAt);
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 6px 4px 10px',
      borderRadius: 999,
      background: slotName ? '#ecfdf5' : '#f9fafb',
      border: '1px solid ' + (slotName ? '#a7f3d0' : '#e5e7eb'),
      fontSize: 11,
      color: slotName ? '#065f46' : '#6b7280',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: slotName ? '#10b981' : '#9ca3af' }} />
      <span>{label}{slotName ? ` · ${slotName}` : ''}</span>
      <button
        onClick={onClickSave}
        title="Save to browser…"
        style={{
          marginLeft: 4,
          width: 24, height: 22,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: '#fff', color: '#374151',
          border: '1px solid #d1d5db', borderRadius: 6,
          cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
        }}
      >💾</button>
    </div>
  );
}
