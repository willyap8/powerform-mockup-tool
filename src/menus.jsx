import { useState, useEffect, useRef } from 'react';

function MenuItem({ label, hint, checked, danger, onClick, disabled }) {
  return (
    <div
      onClick={() => { if (!disabled) onClick && onClick(); }}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 10px 6px 24px',
        fontSize: 12,
        color: disabled ? '#9ca3af' : (danger ? '#b91c1c' : '#111827'),
        cursor: disabled ? 'not-allowed' : 'pointer',
        borderRadius: 4,
        position: 'relative',
        gap: 16,
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = '#f3f4f6'; }}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      {checked && (
        <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#1d4ed8' }}>✓</span>
      )}
      <span>{label}</span>
      {hint && <span style={{ fontSize: 10, color: '#9ca3af', font: '10px "Roboto Mono", Menlo, monospace' }}>{hint}</span>}
    </div>
  );
}

function MenuSeparator() {
  return <div style={{ height: 1, background: '#ececef', margin: '4px 6px' }} />;
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
          color: isOpen ? '#111827' : '#374151',
          background: isOpen ? '#f3f4f6' : 'transparent',
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
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            boxShadow: '0 8px 28px rgba(15, 23, 42, 0.15)',
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
        <MenuItem label="Save to file…"        hint="⌘S" onClick={onSaveFile} disabled={isPreviewing} />
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
        background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 360,
        background: '#fff',
        borderRadius: 10,
        boxShadow: '0 24px 60px rgba(15,23,42,0.3)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #ececef', fontWeight: 600, fontSize: 14, color: '#111827' }}>
          Style Guide
        </div>
        <div style={{ padding: '20px 16px 16px', color: '#374151', fontSize: 13, lineHeight: 1.6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ color: '#6b7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 }}>Version</span>
            <span style={{ fontWeight: 600, fontSize: 18, color: '#111827' }}>v1.6</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
            <span style={{ color: '#6b7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 }}>Updated</span>
            <span style={{ fontSize: 13, color: '#111827' }}>10 October 2024</span>
          </div>
        </div>
        <div style={{ padding: '10px 16px', background: '#fafafa', borderTop: '1px solid #ececef', display: 'flex', justifyContent: 'flex-end' }}>
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
