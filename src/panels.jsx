import { useState, useEffect, useRef } from 'react';
import {
  NAVY, SELECT_BLUE, MANDATORY_BG, INPUT_BORDER, INPUT_FONT, FIELD_LABEL_HEIGHT,
  TEXT_STYLES, BAR_STYLES, FIELD_DEFAULTS, STICKY_DEFAULTS,
  isHeadingType, describeBlock,
} from './constants';

function formatTime(ts) {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return hh + ':' + mm + ':' + ss;
}

// ---------------------------------------------------------------------------
// History panel
// ---------------------------------------------------------------------------
export function HistoryPanel(props) {
  const {
    history, historyIndex, previewIndex,
    onPreview, onConfirmRollback, onCancelPreview,
    showJson, setShowJson, jsonString,
    collapsed, setCollapsed,
  } = props;

  if (collapsed) {
    return (
      <div
        onClick={() => setCollapsed(false)}
        style={{
          position: 'fixed', right: 0, top: 96, bottom: 0, width: 28,
          background: '#fff', borderLeft: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', zIndex: 30,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
        title="Open history"
      >
        <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 11, color: '#374151', letterSpacing: 0.5 }}>
          ◂ History &nbsp;·&nbsp; {history.length} entr{history.length === 1 ? 'y' : 'ies'}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', right: 0, top: 96, bottom: 0, width: 290,
      background: '#fff', borderLeft: '1px solid #e5e7eb',
      display: 'flex', flexDirection: 'column',
      zIndex: 30,
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Helvetica, sans-serif',
    }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #ececef', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 600, fontSize: 12, color: '#111827', letterSpacing: 0.2 }}>
          Change history <span style={{ color: '#9ca3af', fontWeight: 500 }}>· {history.length}/50</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setShowJson(!showJson)} style={panelBtn(showJson)}>{showJson ? 'Timeline' : 'JSON'}</button>
          <button onClick={() => setCollapsed(true)} style={panelBtn(false)} title="Collapse">▸</button>
        </div>
      </div>

      {showJson ? (
        <div style={{ flex: 1, overflow: 'auto', padding: 0, background: '#0b1020' }}>
          <pre style={{
            margin: 0, padding: 12, color: '#cdd6f4',
            font: '11px/1.55 "Roboto Mono", "SF Mono", Menlo, monospace',
            whiteSpace: 'pre', tabSize: 2,
          }}>
{jsonString}
          </pre>
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto' }}>
          {history.map((h, i) => {
            const isCurrent   = i === historyIndex && previewIndex === null;
            const isPreviewing = previewIndex === i;
            return (
              <div key={i} style={{
                padding: '8px 12px',
                borderBottom: '1px solid #f1f1f3',
                background: isPreviewing ? '#fef3c7' : (isCurrent ? '#eff6ff' : '#fff'),
                position: 'relative',
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: isCurrent ? '#1d4ed8' : '#374151' }}>
                    #{i + 1} {isCurrent && <span style={{ marginLeft: 4, fontSize: 9, color: '#1d4ed8' }}>CURRENT</span>}
                  </div>
                  <div style={{ font: '10px "Roboto Mono", Menlo, monospace', color: '#9ca3af' }}>{formatTime(h.ts)}</div>
                </div>
                <div style={{ fontSize: 12, color: '#1f2937', marginTop: 2, lineHeight: 1.35 }}>{h.description}</div>
                {!isCurrent && previewIndex === null && (
                  <button onClick={() => onPreview(i)} style={{ ...panelBtn(false), marginTop: 4, fontSize: 11 }}>
                    👁 Preview
                  </button>
                )}
                {isPreviewing && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                    <button onClick={onConfirmRollback} style={{ ...panelBtn(false), background: '#16a34a', color: '#fff', borderColor: '#16a34a', fontSize: 11 }}>✓ Confirm Rollback</button>
                    <button onClick={onCancelPreview}  style={{ ...panelBtn(false), fontSize: 11 }}>✕ Cancel</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function panelBtn(active) {
  return {
    background: active ? '#1f2937' : '#fff',
    color: active ? '#fff' : '#374151',
    border: '1px solid ' + (active ? '#1f2937' : '#d1d5db'),
    borderRadius: 6,
    padding: '3px 8px',
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };
}

// ---------------------------------------------------------------------------
// DeferredInput — live canvas update, single history commit on blur/Enter
// ---------------------------------------------------------------------------
function DeferredInput({ value, onLive, onCommitDesc, multiline, style, ...rest }) {
  const valueAtFocusRef = useRef(value);
  const handleFocus = (e) => { valueAtFocusRef.current = e.target.value; };
  const handleBlur  = (e) => { if (e.target.value !== valueAtFocusRef.current) onCommitDesc(e.target.value); };
  const handleKey   = (e) => { if (e.key === 'Enter' && !multiline) e.target.blur(); };
  const common = {
    value: value == null ? '' : value,
    onFocus: handleFocus,
    onBlur: handleBlur,
    onKeyDown: handleKey,
    onChange: (e) => onLive(e.target.value),
    style,
    ...rest,
  };
  if (multiline) return <textarea {...common} />;
  return <input type="text" {...common} />;
}

function DeferredNumber({ value, onLive, onCommitDesc, style, ...rest }) {
  const valueAtFocusRef = useRef(value);
  return (
    <input
      type="number"
      value={value == null ? '' : value}
      onFocus={(e) => { valueAtFocusRef.current = e.target.value; }}
      onChange={(e) => onLive(Number(e.target.value) || 0)}
      onBlur={(e) => { if (e.target.value !== valueAtFocusRef.current) onCommitDesc(Number(e.target.value) || 0); }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
      style={style}
      {...rest}
    />
  );
}

// ---------------------------------------------------------------------------
// Properties panel
// ---------------------------------------------------------------------------
export function PropertiesPanel({ block, onLiveUpdate, onCommitDesc, onApplyAndCommit, onClose, historyCollapsed }) {
  if (!block) return null;
  const right = historyCollapsed ? 36 : 298;

  const isField        = block.type === 'field';
  const isHeading      = isHeadingType(block.type);
  const isText         = block.type === 'text';
  const isCheckboxGroup = isField && block.fieldType === 'checkbox';
  const isRadioGroup    = isField && block.fieldType === 'radio';
  const isGroupField    = isCheckboxGroup || isRadioGroup;

  return (
    <div style={{
      position: 'fixed', right, top: 96, width: 260,
      background: '#ffffff',
      border: '1px solid #e5e7eb', borderRight: 'none',
      borderRadius: '10px 0 0 10px',
      boxShadow: '-6px 8px 24px rgba(15, 23, 42, 0.08)',
      zIndex: 28,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxHeight: 'calc(100vh - 120px)',
      overflow: 'auto',
    }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #ececef', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 600, fontSize: 12, color: '#111827' }}>
          Properties
          <div style={{ fontWeight: 500, fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{describeBlock(block)}</div>
        </div>
        <button onClick={onClose} style={panelBtn(false)} title="Deselect">✕</button>
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Position */}
        <Row label="Position">
          <DeferredNumberField value={block.x} onLive={(v) => onLiveUpdate({ x: v })} onCommitDesc={() => onCommitDesc('Moved ' + describeBlock(block))} suffix="x" />
          <DeferredNumberField value={block.y} onLive={(v) => onLiveUpdate({ y: v })} onCommitDesc={() => onCommitDesc('Moved ' + describeBlock(block))} suffix="y" />
        </Row>

        {/* Size */}
        {isField && (
          <Row label="Size">
            <DeferredNumberField value={block.width}  onLive={(v) => onLiveUpdate({ width: v })}  onCommitDesc={() => onCommitDesc('Resized ' + describeBlock(block))} suffix="w" />
            <DeferredNumberField value={block.height} onLive={(v) => onLiveUpdate({ height: v })} onCommitDesc={() => onCommitDesc('Resized ' + describeBlock(block))} suffix="h" />
          </Row>
        )}
        {isText && (
          <Row label="Width">
            <DeferredNumberField value={block.width || 300} onLive={(v) => onLiveUpdate({ width: v })} onCommitDesc={() => onCommitDesc('Resized text')} suffix="w" />
          </Row>
        )}

        {/* Label */}
        {(isHeading || (isField && !isGroupField)) && (
          <Row label="Label">
            <DeferredInput
              value={block.label || ''}
              onLive={(v) => onLiveUpdate({ label: v })}
              onCommitDesc={(v) => onCommitDesc("Edited label → '" + (v || '').trim() + "'")}
              style={inputSt}
            />
          </Row>
        )}

        {/* Text content */}
        {isText && (
          <Row label="Text">
            <DeferredInput
              value={block.text || ''}
              onLive={(v) => onLiveUpdate({ text: v })}
              onCommitDesc={(v) => onCommitDesc("Edited text → '" + (v || '').slice(0, 24) + "'")}
              multiline
              style={{ ...inputSt, minHeight: 60, resize: 'vertical', font: 'inherit' }}
            />
          </Row>
        )}

        {/* Text variant */}
        {isText && (
          <Row label="Variant">
            <select value={block.variant} onChange={(e) => onApplyAndCommit({ variant: e.target.value }, 'Changed text variant')} style={inputSt}>
              <option value="label">Label (Tahoma 10 Bold Navy)</option>
              <option value="general">General (Tahoma 10 Navy)</option>
              <option value="instructionalBold">Instructional Bold</option>
              <option value="instructional">Instructional</option>
            </select>
          </Row>
        )}

        {/* Field type */}
        {isField && (
          <Row label="Field type">
            <select
              value={block.fieldType}
              onChange={(e) => {
                const ft = e.target.value;
                const d = FIELD_DEFAULTS[ft];
                const patch = { fieldType: ft, height: d.height };
                if ((ft === 'checkbox' || ft === 'radio') && !block.options) patch.options = [...d.options];
                if (ft === 'radio' && block.selectedIndex === undefined) patch.selectedIndex = null;
                onApplyAndCommit(patch, 'Changed field type → ' + ft);
              }}
              style={inputSt}
            >
              {['text','number','date','time','checkbox','radio','textarea'].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Row>
        )}

        {/* Placeholder */}
        {isField && !isGroupField && (
          <Row label="Placeholder">
            <DeferredInput
              value={block.placeholder || ''}
              onLive={(v) => onLiveUpdate({ placeholder: v })}
              onCommitDesc={() => onCommitDesc('Edited placeholder')}
              style={inputSt}
            />
          </Row>
        )}

        {/* Mandatory */}
        {isField && !isGroupField && (
          <Row label="">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151' }}>
              <input
                type="checkbox"
                checked={!!block.mandatory}
                onChange={(e) => onApplyAndCommit({ mandatory: e.target.checked }, e.target.checked ? 'Marked mandatory' : 'Removed mandatory')}
              />
              Mandatory (yellow background)
            </label>
          </Row>
        )}

        {/* Checkbox group options */}
        {isCheckboxGroup && (
          <Row label="Checkboxes">
            <CheckboxOptionsEditor
              options={block.options || []}
              onLive={(opts) => onLiveUpdate({ options: opts })}
              onCommitDesc={(desc) => onCommitDesc(desc)}
            />
          </Row>
        )}

        {/* Radio group options */}
        {isRadioGroup && (
          <Row label="Radio buttons">
            <RadioOptionsEditor
              options={block.options || []}
              selectedIndex={block.selectedIndex == null ? null : block.selectedIndex}
              onLive={(opts, sel) => onLiveUpdate({ options: opts, selectedIndex: sel })}
              onCommitDesc={(desc) => onCommitDesc(desc)}
            />
          </Row>
        )}
      </div>
    </div>
  );
}

function DeferredNumberField({ value, onLive, onCommitDesc, suffix }) {
  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <DeferredNumber
        value={value}
        onLive={onLive}
        onCommitDesc={onCommitDesc}
        style={{ ...inputSt, paddingRight: 22, width: '100%' }}
      />
      <span style={{ position: 'absolute', right: 6, top: 5, fontSize: 10, color: '#9ca3af', font: '10px "Roboto Mono", Menlo, monospace' }}>{suffix}</span>
    </div>
  );
}

function CheckboxOptionsEditor({ options, onLive, onCommitDesc }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
      {options.map((opt, i) => (
        <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ width: 14, color: '#9ca3af', fontSize: 12, textAlign: 'center' }}>☐</span>
          <DeferredInput
            value={opt}
            onLive={(v) => { const next = options.slice(); next[i] = v; onLive(next); }}
            onCommitDesc={(v) => onCommitDesc("Edited checkbox label → '" + (v || '').trim() + "'")}
            style={{ ...inputSt, flex: 1 }}
            placeholder={'Label ' + (i + 1)}
          />
          <button
            onClick={() => { const next = options.slice(); next.splice(i, 1); onLive(next); onCommitDesc("Removed checkbox '" + opt + "'"); }}
            disabled={options.length <= 1}
            title="Remove"
            style={{ ...panelBtn(false), padding: '2px 6px', opacity: options.length <= 1 ? 0.4 : 1 }}
          >✕</button>
        </div>
      ))}
      <button
        onClick={() => { const next = [...options, 'Option ' + (options.length + 1)]; onLive(next); onCommitDesc('Added checkbox'); }}
        style={{ ...panelBtn(false), marginTop: 2, fontSize: 11 }}
      >+ Add checkbox</button>
    </div>
  );
}

function RadioOptionsEditor({ options, selectedIndex, onLive, onCommitDesc }) {
  const setSelected = (i) => {
    const next = selectedIndex === i ? null : i;
    onLive(options.slice(), next);
    onCommitDesc(next == null ? 'Cleared default radio' : "Set default radio → '" + (options[i] || '').trim() + "'");
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
      <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 2, lineHeight: 1.4 }}>
        Tap a circle to set the pre-selected default. Only one radio can be selected at a time.
      </div>
      {options.map((opt, i) => {
        const isSel = selectedIndex === i;
        return (
          <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button
              onClick={() => setSelected(i)}
              title={isSel ? 'Selected by default — click to clear' : 'Make this the default selection'}
              style={{
                width: 16, height: 16, padding: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid ' + (isSel ? SELECT_BLUE : '#9ca3af'),
                background: '#fff', borderRadius: '50%', cursor: 'pointer', flex: '0 0 16px',
              }}
            >
              {isSel && <span style={{ display: 'block', width: 8, height: 8, borderRadius: '50%', background: SELECT_BLUE }} />}
            </button>
            <DeferredInput
              value={opt}
              onLive={(v) => { const next = options.slice(); next[i] = v; onLive(next, selectedIndex); }}
              onCommitDesc={(v) => onCommitDesc("Edited radio label → '" + (v || '').trim() + "'")}
              style={{ ...inputSt, flex: 1 }}
              placeholder={'Label ' + (i + 1)}
            />
            <button
              onClick={() => {
                const next = options.slice(); next.splice(i, 1);
                let nextSel = selectedIndex;
                if (selectedIndex === i) nextSel = null;
                else if (selectedIndex != null && selectedIndex > i) nextSel = selectedIndex - 1;
                onLive(next, nextSel);
                onCommitDesc("Removed radio '" + opt + "'");
              }}
              disabled={options.length <= 1}
              title="Remove"
              style={{ ...panelBtn(false), padding: '2px 6px', opacity: options.length <= 1 ? 0.4 : 1 }}
            >✕</button>
          </div>
        );
      })}
      <button
        onClick={() => { const next = [...options, 'Option ' + (options.length + 1)]; onLive(next, selectedIndex); onCommitDesc('Added radio'); }}
        style={{ ...panelBtn(false), marginTop: 2, fontSize: 11 }}
      >+ Add radio</button>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, color: '#9ca3af' }}>{label}</div>}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{children}</div>
    </div>
  );
}

const inputSt = {
  width: '100%', padding: '5px 7px',
  border: '1px solid #d1d5db', borderRadius: 5,
  fontSize: 12, background: '#fff', color: '#111827',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};

// ---------------------------------------------------------------------------
// Context menu (right-click)
// ---------------------------------------------------------------------------
export function ContextMenu({ menu, onAction, onClose }) {
  useEffect(() => {
    if (!menu) return;
    const off = () => onClose();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    setTimeout(() => window.addEventListener('mousedown', off), 0);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', off);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu, onClose]);
  if (!menu) return null;
  return (
    <div
      style={{
        position: 'fixed', left: menu.x, top: menu.y,
        background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6,
        boxShadow: '0 6px 24px rgba(15, 23, 42, 0.15)',
        minWidth: 160, zIndex: 80, padding: 4,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {[
        { key: 'edit',      label: 'Edit label' },
        { key: 'duplicate', label: 'Duplicate' },
        { key: 'delete',    label: 'Delete', danger: true },
      ].map((it) => (
        <div
          key={it.key}
          onClick={() => onAction(it.key)}
          style={{ padding: '6px 10px', borderRadius: 4, fontSize: 12, color: it.danger ? '#b91c1c' : '#111827', cursor: 'pointer' }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          {it.label}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// openPrintWindow — opens a new tab with the form rendered as static HTML
// ---------------------------------------------------------------------------
export function openPrintWindow(form, options) {
  const includeNotes = !!(options && options.includeNotes);
  const w = window.open('', '_blank', 'width=1024,height=900,scrollbars=yes');
  if (!w) {
    alert('Pop-up blocked. Please allow pop-ups for this site to use Print Preview.');
    return;
  }

  function rectFor(b) {
    if (b.type === 'formHeading' || b.type === 'heading1' || b.type === 'heading2' || b.type === 'subSection') {
      const s = BAR_STYLES[b.type];
      return { x: b.x, y: b.y, w: s.width, h: s.height };
    }
    if (b.type === 'field') {
      const fw = b.width  || FIELD_DEFAULTS[b.fieldType].width;
      const fh = b.height || FIELD_DEFAULTS[b.fieldType].height;
      // Fix: radio groups have no label above them (same as checkbox)
      if (b.fieldType === 'checkbox' || b.fieldType === 'radio') return { x: b.x, y: b.y, w: fw, h: fh };
      return { x: b.x, y: b.y - FIELD_LABEL_HEIGHT, w: fw, h: fh + FIELD_LABEL_HEIGHT };
    }
    if (b.type === 'text')   return { x: b.x, y: b.y, w: b.width || 300, h: 18 };
    if (b.type === 'sticky') return { x: b.x, y: b.y, w: b.width || 180, h: b.height || 130 };
    return { x: b.x, y: b.y, w: 100, h: 20 };
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  let maxBottom = 0;
  form.blocks.forEach((b) => {
    if (b.type === 'sticky' && !includeNotes) return;
    const r = rectFor(b);
    if (r.y + r.h > maxBottom) maxBottom = r.y + r.h;
  });
  const canvasH = Math.max(maxBottom + 30, 600);

  function renderBlock(b) {
    const r = rectFor(b);
    const pos = `position:absolute;left:${r.x}px;top:${r.y}px;`;
    if (b.type === 'formHeading' || b.type === 'heading1' || b.type === 'heading2' || b.type === 'subSection') {
      const s = BAR_STYLES[b.type];
      return `<div style="${pos}width:${s.width}px;height:${s.height}px;background:${s.bg};color:${s.color};font:${s.font};display:flex;align-items:center;padding:0 4px;box-sizing:border-box;white-space:nowrap;overflow:hidden;">${esc(b.label)}</div>`;
    }
    if (b.type === 'text') {
      const t = TEXT_STYLES[b.variant] || TEXT_STYLES.general;
      return `<div style="${pos}width:${b.width || 300}px;font:${t.font};color:${t.color};font-style:${t.italic ? 'italic' : 'normal'};white-space:pre-wrap;">${esc(b.text)}</div>`;
    }
    if (b.type === 'field') {
      const ft = b.fieldType;
      const fw = b.width  || FIELD_DEFAULTS[ft].width;
      const fh = b.height || FIELD_DEFAULTS[ft].height;
      const inputBg = b.mandatory ? MANDATORY_BG : '#fff';

      if (ft === 'checkbox' || ft === 'radio') {
        const isRadio = ft === 'radio';
        const sel = b.selectedIndex == null ? null : b.selectedIndex;
        const opts = (b.options || ['']).map((label, i) => {
          if (isRadio) {
            const isChecked = sel === i;
            return `<span style="display:inline-flex;align-items:center;gap:4px;font:${INPUT_FONT};color:${NAVY};line-height:16px;white-space:nowrap;"><span style="display:inline-flex;align-items:center;justify-content:center;width:11px;height:11px;border-radius:50%;border:1px solid #555;background:#fff;box-sizing:border-box;">${isChecked ? `<span style="display:block;width:5px;height:5px;border-radius:50%;background:${NAVY};"></span>` : ''}</span><span>${esc(label)}</span></span>`;
          }
          return `<span style="display:inline-flex;align-items:center;gap:4px;font:${INPUT_FONT};color:${NAVY};line-height:16px;white-space:nowrap;"><span style="display:inline-block;width:10px;height:10px;border:1px solid #555;background:#fff;"></span><span>${esc(label)}</span></span>`;
        }).join('');
        return `<div style="${pos}width:${fw}px;height:${fh}px;box-sizing:border-box;padding:2px 4px;background:#fff;border:1px solid transparent;display:flex;flex-wrap:wrap;align-content:flex-start;gap:4px 12px;overflow:hidden;">${opts}</div>`;
      }

      const labelHtml = `<div style="font:${TEXT_STYLES.label.font};color:${TEXT_STYLES.label.color};height:${FIELD_LABEL_HEIGHT}px;line-height:${FIELD_LABEL_HEIGHT}px;white-space:nowrap;">${esc(b.label)}</div>`;
      const inputBoxStyle = `width:${fw}px;height:${fh}px;border:1px solid ${INPUT_BORDER};background:${inputBg};font:${INPUT_FONT};color:${NAVY};padding:${ft === 'textarea' ? '3px 4px' : '0 4px'};box-sizing:border-box;`;
      return `<div style="${pos}">${labelHtml}<div style="${inputBoxStyle}"></div></div>`;
    }
    if (b.type === 'sticky') {
      if (!includeNotes) return '';
      return `<div style="${pos}width:${r.w}px;height:${r.h}px;background:#fff59d;border:1px solid #e6cc44;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;"><div style="height:16px;background:#fbe57c;border-bottom:1px solid #e6cc44;padding:0 6px;font:bold 9px Tahoma,sans-serif;color:#7a6a1a;letter-spacing:0.4px;text-transform:uppercase;display:flex;align-items:center;">Configuration note</div><div style="flex:1;padding:4px 6px;font:11px/1.4 Tahoma,sans-serif;color:#3f3a1a;white-space:pre-wrap;word-break:break-word;overflow:hidden;">${esc(b.text || '')}</div></div>`;
    }
    return '';
  }

  const blocksHtml = form.blocks.map(renderBlock).join('\n');

  const html = `<!doctype html>
<html><head>
<meta charset="utf-8">
<title>Print Preview — ${esc(form.title || 'PowerForm')}</title>
<style>
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #f3f4f6; }
  body { font-family: system-ui, -apple-system, "Segoe UI", Helvetica, sans-serif; }
  .toolbar { position: sticky; top: 0; z-index: 10; background: #fff; border-bottom: 1px solid #e5e7eb; padding: 10px 20px; display: flex; align-items: center; gap: 12px; }
  .toolbar h1 { margin: 0; font-size: 14px; font-weight: 600; }
  .toolbar .spacer { flex: 1; }
  .toolbar button { padding: 6px 14px; font-size: 12px; font-weight: 500; border: 1px solid #d1d5db; background: #fff; color: #374151; border-radius: 6px; cursor: pointer; font-family: inherit; }
  .toolbar button.primary { background: rgb(0, 48, 135); color: #fff; border-color: rgb(0, 48, 135); }
  .toolbar .hint { font-size: 11px; color: #6b7280; }
  .page { margin: 30px auto; width: 870px; background: #fff; box-shadow: 0 2px 14px rgba(15, 23, 42, 0.08); padding: 5px 5px 30px; position: relative; }
  .canvas { position: relative; width: 860px; height: ${canvasH + 30}px; }
  @media print {
    *, html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .toolbar { display: none !important; }
    body { background: #fff; }
    .page { margin: 0; box-shadow: none; padding: 0; width: auto; }
    .canvas { width: 870px; }
    @page { margin: 12mm; }
  }
</style>
</head><body>
<div class="toolbar">
  <h1>Print Preview — ${esc((form.title || 'PowerForm').trim())}</h1>
  <span class="hint">Sticky notes: ${includeNotes ? 'included' : 'hidden'}</span>
  <span class="spacer"></span>
  <button onclick="window.print()" class="primary">🖨 Print / Save as PDF</button>
  <button onclick="window.close()">Close</button>
</div>
<div class="page"><div class="canvas">${blocksHtml}</div></div>
</body></html>`;

  w.document.open();
  w.document.write(html);
  w.document.close();
}

// ---------------------------------------------------------------------------
// PrintOptionsDialog
// ---------------------------------------------------------------------------
export function PrintOptionsDialog({ form, onClose }) {
  const [includeNotes, setIncludeNotes] = useState(false);
  const hasNotes = form.blocks.some((b) => b.type === 'sticky');
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, fontFamily: 'system-ui, sans-serif',
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 420, background: '#fff', borderRadius: 10,
        boxShadow: '0 24px 60px rgba(15,23,42,0.3)', overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #ececef', fontWeight: 600, fontSize: 14, color: '#111827' }}>
          Print Preview
        </div>
        <div style={{ padding: '16px 18px', fontSize: 13, color: '#374151', lineHeight: 1.55 }}>
          <p style={{ margin: '0 0 14px' }}>Opens a new tab with the form rendered for printing or saving as PDF.</p>
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: 10, borderRadius: 6,
            background: hasNotes ? '#fffbeb' : '#f9fafb',
            border: '1px solid ' + (hasNotes ? '#fde68a' : '#e5e7eb'),
            cursor: hasNotes ? 'pointer' : 'not-allowed',
            opacity: hasNotes ? 1 : 0.6,
          }}>
            <input type="checkbox" checked={includeNotes} onChange={(e) => setIncludeNotes(e.target.checked)} disabled={!hasNotes} style={{ marginTop: 2 }} />
            <span>
              <strong style={{ display: 'block', marginBottom: 2 }}>Include sticky notes</strong>
              <span style={{ fontSize: 12, color: '#6b7280' }}>
                {hasNotes ? 'Show configuration notes on the printed form.' : 'No sticky notes in the current mockup.'}
              </span>
            </span>
          </label>
        </div>
        <div style={{ padding: '12px 18px', background: '#fafafa', borderTop: '1px solid #ececef', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={panelBtn(false)}>Cancel</button>
          <button
            onClick={() => { openPrintWindow(form, { includeNotes }); onClose(); }}
            style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, background: 'rgb(0, 48, 135)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}
          >Open Print View</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NotesPane — left-docked persistent notes editor
// ---------------------------------------------------------------------------
const NOTES_CHAR_LIMIT = 32000;

export function NotesPane({ committed, onSave, onClose }) {
  const [draft, setDraft] = useState(committed || '');
  useEffect(() => { setDraft(committed || ''); }, [committed]);

  const dirty     = draft !== (committed || '');
  const count     = draft.length;
  const atLimit   = count >= NOTES_CHAR_LIMIT;
  const nearLimit = count >= NOTES_CHAR_LIMIT - 500;

  const handleChange = (e) => {
    const v = e.target.value;
    if (v.length > NOTES_CHAR_LIMIT) setDraft(v.slice(0, NOTES_CHAR_LIMIT));
    else setDraft(v);
  };

  const handleSave = () => { if (dirty) onSave(draft); };

  const handleKey = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      e.stopPropagation();
      handleSave();
    }
  };

  return (
    <div style={{
      position: 'fixed', left: 0, top: 96, bottom: 0, width: 320,
      background: '#ffffff', borderRight: '1px solid #e5e7eb',
      display: 'flex', flexDirection: 'column',
      zIndex: 32,
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Helvetica, sans-serif',
      boxShadow: '2px 0 12px rgba(15, 23, 42, 0.04)',
    }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #ececef', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 22, height: 22, borderRadius: 5, background: '#fef3c7', color: '#92400e', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>📝</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 12, color: '#111827', lineHeight: 1.2 }}>Notes</div>
            <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>Saved with this PowerForm</div>
          </div>
        </div>
        <button onClick={onClose} title="Close (Tools → Show Notes pane to reopen)" style={panelBtn(false)}>✕</button>
      </div>

      <div style={{ flex: 1, padding: '10px 12px 6px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <textarea
          value={draft}
          onChange={handleChange}
          onKeyDown={handleKey}
          placeholder="Document your PowerForm here. Decisions, open questions, stakeholder feedback, configuration team handoff notes…"
          style={{
            flex: 1, width: '100%',
            padding: '10px 12px',
            border: '1px solid #e5e7eb', borderRadius: 6,
            background: '#fafafa', color: '#111827',
            font: '12px/1.55 system-ui, -apple-system, "Segoe UI", Helvetica, sans-serif',
            outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
          }}
        />
      </div>

      <div style={{
        padding: '8px 12px 12px', borderTop: '1px solid #ececef', background: '#fafafa',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <div style={{
          font: '11px "Roboto Mono", "SF Mono", Menlo, monospace',
          color: atLimit ? '#b91c1c' : (nearLimit ? '#b45309' : '#6b7280'),
          fontWeight: atLimit ? 600 : 400,
        }}>
          {count.toLocaleString()} / {NOTES_CHAR_LIMIT.toLocaleString()}
          {atLimit && <span style={{ marginLeft: 6 }}>limit reached</span>}
        </div>
        <button
          onClick={handleSave}
          disabled={!dirty}
          title={dirty ? 'Save notes (⌘S)' : 'No unsaved changes'}
          style={{
            position: 'relative',
            padding: '6px 14px', fontSize: 12, fontWeight: 600,
            background: dirty ? 'rgb(0, 48, 135)' : '#e5e7eb',
            color: dirty ? '#fff' : '#9ca3af',
            border: 'none', borderRadius: 6,
            cursor: dirty ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        >
          {dirty && (
            <span aria-hidden="true" style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#fbbf24',
              boxShadow: '0 0 0 2px rgba(0, 48, 135, 0.95)',
              display: 'inline-block',
            }} />
          )}
          Save notes
        </button>
      </div>
    </div>
  );
}
