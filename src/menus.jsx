import { useState, useEffect, useRef } from 'react';

function MenuItem({ label, hint, checked, danger, onClick, disabled }) {
  return (
    <div
      onClick={() => { if (!disabled) onClick && onClick(); }}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 10px 6px 24px',
        fontSize: 12,
        color: disabled ? 'var(--ui-text-faint)' : (danger ? '#ef4444' : 'var(--ui-text)'),
        cursor: disabled ? 'not-allowed' : 'pointer',
        borderRadius: 4,
        position: 'relative',
        gap: 16,
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = 'var(--ui-hover)'; }}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      {checked && (
        <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#3b82f6' }}>✓</span>
      )}
      <span>{label}</span>
      {hint && <span style={{ fontSize: 10, color: 'var(--ui-text-faint)', font: '10px "Roboto Mono", Menlo, monospace' }}>{hint}</span>}
    </div>
  );
}

function MenuSeparator() {
  return <div style={{ height: 1, background: 'var(--ui-border-soft)', margin: '4px 6px' }} />;
}

function MenuButton({ name, openName, setOpenName, children, width }) {
  const ref = useRef(null);
  const isOpen = openName === name;

  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpenName(null);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpenName(null); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, setOpenName]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        onClick={() => setOpenName(isOpen ? null : name)}
        style={{
          padding: '6px 10px',
          fontSize: 12,
          color: isOpen ? 'var(--ui-text)' : 'var(--ui-text-secondary)',
          background: isOpen ? 'var(--ui-hover)' : 'transparent',
          borderRadius: 4,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {name}
      </div>
      {isOpen && (
        <div
          onClick={() => setOpenName(null)}
          style={{
            position: 'absolute', left: 0, top: '100%', marginTop: 4,
            minWidth: width || 200,
            background: 'var(--ui-surface)',
            border: '1px solid var(--ui-border)',
            borderRadius: 6,
            boxShadow: '0 8px 28px var(--ui-shadow)',
            padding: 4,
            zIndex: 60,
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuBar(props) {
  const {
    onPrintPreview, onResetAll,
    onSaveFile, onOpenFile, onSaveSlot, onOpenSlot,
    showGuides, setShowGuides, showGrid, setShowGrid,
    showElements, setShowElements, showHistory, setShowHistory,
    showNotes, setShowNotes,
    onShowDisclaimer, onShowStyleGuide,
    isPreviewing,
  } = props;
  const [openName, setOpenName] = useState(null);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      <MenuButton name="File" openName={openName} setOpenName={setOpenName} width={220}>
        <MenuItem label="Save to file…"                 onClick={onSaveFile} disabled={isPreviewing} />
        <MenuItem label="Open file…"                    onClick={onOpenFile}  disabled={isPreviewing} />
        <MenuSeparator />
        <MenuItem label="Save to browser…"              onClick={onSaveSlot}  disabled={isPreviewing} />
        <MenuItem label="Open from browser…"            onClick={onOpenSlot}  disabled={isPreviewing} />
        <MenuSeparator />
        <MenuItem label="Print Preview…"       hint="⌘P" onClick={onPrintPreview} />
        <MenuSeparator />
        <MenuItem label="Reset all" danger onClick={onResetAll} disabled={isPreviewing} />
      </MenuButton>
      <MenuButton name="View" openName={openName} setOpenName={setOpenName}>
        <MenuItem label="Show guidelines" checked={showGuides} onClick={() => setShowGuides(!showGuides)} />
        <MenuItem label="Show grid"       checked={showGrid}   onClick={() => setShowGrid(!showGrid)} />
      </MenuButton>
      <MenuButton name="Tools" openName={openName} setOpenName={setOpenName}>
        <MenuItem label="Show Elements pane"         checked={showElements} onClick={() => setShowElements(!showElements)} />
        <MenuItem label="Show Change History pane"   checked={showHistory}  onClick={() => setShowHistory(!showHistory)} />
        <MenuSeparator />
        <MenuItem label="Show Notes pane" checked={showNotes} onClick={() => setShowNotes(!showNotes)} />
      </MenuButton>
      <MenuButton name="Help" openName={openName} setOpenName={setOpenName}>
        <MenuItem label="Show disclaimer"      onClick={onShowDisclaimer} />
        <MenuItem label="Style Guide Version…" onClick={onShowStyleGuide} />
      </MenuButton>
    </div>
  );
}

export function StyleGuideModal({ onClose }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'var(--ui-overlay)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 360,
        background: 'var(--ui-surface)',
        borderRadius: 10,
        boxShadow: '0 24px 60px var(--ui-shadow)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--ui-border-soft)', fontWeight: 600, fontSize: 14, color: 'var(--ui-text)' }}>
          Style Guide
        </div>
        <div style={{ padding: '20px 16px 16px', color: 'var(--ui-text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ color: 'var(--ui-text-muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 }}>Version</span>
            <span style={{ fontWeight: 600, fontSize: 18, color: 'var(--ui-text)' }}>v1.6</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
            <span style={{ color: 'var(--ui-text-muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 }}>Updated</span>
            <span style={{ fontSize: 13, color: 'var(--ui-text)' }}>10 October 2024</span>
          </div>
        </div>
        <div style={{ padding: '10px 16px', background: 'var(--ui-surface-subtle)', borderTop: '1px solid var(--ui-border-soft)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px', fontSize: 12, fontWeight: 500,
              background: 'rgb(0, 48, 135)', color: '#fff',
              border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >Close</button>
        </div>
      </div>
    </div>
  );
}
