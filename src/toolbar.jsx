import { useState, useRef, useEffect } from 'react';

const TOOL_GROUPS = [
  { label: 'Fields', tools: [
    { key: 'field:text',     icon: 'Tt', name: 'Text' },
    { key: 'field:number',   icon: '#',  name: 'Number' },
    { key: 'field:date',     icon: '📅', name: 'Date' },
    { key: 'field:time',     icon: '⏱',  name: 'Time' },
    { key: 'field:textarea', icon: '¶',  name: 'Textarea' },
  ]},
  { label: 'Choices', tools: [
    { key: 'field:checkbox', icon: '☑', name: 'Checkbox group' },
    { key: 'field:radio',    icon: '◉', name: 'Radio group' },
  ]},
  { label: 'Headers', tools: [
    { key: 'heading1',   swatch: 'rgb(255, 200, 69)', name: 'Heading 1' },
    { key: 'heading2',   swatch: 'rgb(237, 125, 49)', name: 'Heading 2' },
    { key: 'subSection', swatch: 'rgb(112, 173, 71)', name: 'Sub-Section' },
  ]},
  { label: 'Text', tools: [
    { key: 'text:label',             icon: 'L', name: 'Label' },
    { key: 'text:general',           icon: 'T', name: 'General' },
    { key: 'text:instructionalBold', icon: 'B', name: 'Instructional B' },
    { key: 'text:instructional',     icon: 'i', name: 'Instructional' },
  ]},
  { label: 'Configuration Notes', tools: [
    { key: 'sticky', swatch: '#fff59d', name: 'Sticky note' },
  ]},
];

const kbdSt = {
  font: '10px "Roboto Mono", Menlo, monospace',
  background: '#f3f4f6',
  border: '1px solid #e5e7eb',
  borderRadius: 3,
  padding: '0 4px',
  color: '#374151',
};

export function FloatingToolbar({ activeTool, setActiveTool, disabled, leftOffset }) {
  const offset = leftOffset || 0;
  const [pos, setPos] = useState({ x: 16 + offset, y: 96 });
  const [min, setMin] = useState(false);
  const dragRef = useRef(null);

  useEffect(() => {
    setPos((p) => (p.x < offset + 16 ? { ...p, x: offset + 16 } : p));
  }, [offset]);

  const onDragStart = (e) => {
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const base = { ...pos };
    const onMove = (ev) => setPos({
      x: Math.max(0, Math.min(window.innerWidth  - 220, base.x + (ev.clientX - startX))),
      y: Math.max(0, Math.min(window.innerHeight - 60,  base.y + (ev.clientY - startY))),
    });
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const clickTool = (key) => {
    if (disabled) return;
    setActiveTool(activeTool === key ? null : key);
  };

  return (
    <div
      ref={dragRef}
      style={{
        position: 'fixed',
        left: pos.x, top: pos.y,
        width: 220,
        background: '#ffffff',
        border: '1px solid #d9d9de',
        borderRadius: 10,
        boxShadow: '0 8px 28px rgba(15, 23, 42, 0.12), 0 2px 6px rgba(15, 23, 42, 0.06)',
        zIndex: 50,
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Helvetica, sans-serif',
        opacity: disabled ? 0.55 : 1,
        pointerEvents: 'auto',
      }}
    >
      <div
        onMouseDown={onDragStart}
        style={{
          cursor: 'move',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 10px',
          borderBottom: '1px solid #ececef',
          fontSize: 12, fontWeight: 600, color: '#1f2937', letterSpacing: 0.2,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a' }} />
          Elements
        </span>
        <button
          onClick={() => setMin(!min)}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14, color: '#6b7280', padding: '0 4px' }}
          title={min ? 'Expand' : 'Minimise'}
        >
          {min ? '▢' : '–'}
        </button>
      </div>
      {!min && (
        <div style={{ padding: '8px 10px 12px' }}>
          {TOOL_GROUPS.map((g) => (
            <div key={g.label} style={{ marginTop: 6 }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, color: '#9ca3af', margin: '4px 0 4px 2px' }}>{g.label}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {g.tools.map((t) => {
                  const active = activeTool === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => clickTool(t.key)}
                      title={t.name}
                      style={{
                        flex: '1 0 calc(50% - 4px)',
                        minHeight: 30,
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '4px 6px',
                        background: active ? '#1f2937' : '#f8f8fa',
                        color: active ? '#fff' : '#111827',
                        border: '1px solid ' + (active ? '#1f2937' : '#e5e7eb'),
                        borderRadius: 6,
                        fontSize: 11,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        textAlign: 'left',
                        fontFamily: 'inherit',
                      }}
                    >
                      {t.swatch ? (
                        <span style={{ display: 'inline-block', width: 16, height: 12, background: t.swatch, borderRadius: 2, border: '1px solid rgba(0,0,0,0.1)' }} />
                      ) : (
                        <span style={{ display: 'inline-block', width: 16, textAlign: 'center', fontFamily: '"Roboto Mono", "SF Mono", Menlo, monospace', fontSize: 11, color: active ? '#fff' : '#374151' }}>{t.icon}</span>
                      )}
                      <span>{t.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div style={{ marginTop: 10, fontSize: 10, color: '#9ca3af', borderTop: '1px solid #f1f1f3', paddingTop: 8, lineHeight: 1.4 }}>
            Click a tool then click the canvas. <kbd style={kbdSt}>Esc</kbd> to cancel.
          </div>
        </div>
      )}
    </div>
  );
}
