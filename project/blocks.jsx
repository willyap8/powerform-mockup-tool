// ---------------------------------------------------------------------------
// blocks.jsx — Renders a single block. Handles input rendering, inline label
// editing, selection visuals, drag mousedown handoff, and context menu.
// ---------------------------------------------------------------------------
const { useState, useEffect, useRef } = React;

// Inline text editor — dashed blue outline, matches the source element font.
function InlineEdit({ initial, style, onCommit, onCancel, multiline }) {
  const ref = useRef(null);
  const [val, setVal] = useState(initial);

  useEffect(() => {
    if (ref.current) {
      ref.current.focus();
      ref.current.select && ref.current.select();
    }
  }, []);

  const commit = () => onCommit(val);
  const handleKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    else if (e.key === 'Enter' && !multiline) { e.preventDefault(); commit(); }
  };

  const baseStyle = {
    ...style,
    background: 'rgba(255,255,255,0.96)',
    color: style.color || '#000',
    border: '1px dashed ' + SELECT_BLUE,
    outline: 'none',
    boxSizing: 'border-box',
    padding: '0 2px',
    margin: 0,
  };

  if (multiline) {
    return (
      <textarea
        ref={ref}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKey}
        style={baseStyle}
      />
    );
  }
  return (
    <input
      ref={ref}
      type="text"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={handleKey}
      style={baseStyle}
    />
  );
}

// ---------------------------------------------------------------------------
// Individual visual pieces
// ---------------------------------------------------------------------------
function HeadingBar({ block, editing, onCommitLabel, onCancelLabel }) {
  const s = BAR_STYLES[block.type];
  const style = {
    position: 'absolute',
    left: 0,
    top: 0,
    width: s.width,
    height: s.height,
    background: s.bg,
    color: s.color,
    font: s.font,
    display: 'flex',
    alignItems: 'center',
    padding: '0 4px',
    boxSizing: 'border-box',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  };
  if (editing) {
    return (
      <div style={style}>
        <InlineEdit
          initial={block.label}
          style={{ font: s.font, color: s.color, width: '100%', height: s.height - 4 }}
          onCommit={onCommitLabel}
          onCancel={onCancelLabel}
        />
      </div>
    );
  }
  return <div style={style}>{block.label}</div>;
}

function FieldLabel({ text, editing, onCommit, onCancel, onDoubleClick }) {
  const style = {
    font: TEXT_STYLES.label.font,
    color: TEXT_STYLES.label.color,
    height: FIELD_LABEL_HEIGHT,
    lineHeight: FIELD_LABEL_HEIGHT + 'px',
    whiteSpace: 'nowrap',
  };
  if (editing) {
    return <InlineEdit initial={text} style={{ ...style, width: 240 }} onCommit={onCommit} onCancel={onCancel} />;
  }
  return <div style={style} onDoubleClick={onDoubleClick}>{text}</div>;
}

function FieldInput({ block, editLayoutOn, value, setValue, values, setValues }) {
  const ft = block.fieldType;
  const w = block.width || FIELD_DEFAULTS[ft].width;
  const h = block.height || FIELD_DEFAULTS[ft].height;
  const showMandatoryBg = block.mandatory && !value;

  const baseStyle = {
    width: w,
    height: h,
    border: '1px solid ' + INPUT_BORDER,
    background: showMandatoryBg ? MANDATORY_BG : '#ffffff',
    color: NAVY,
    font: INPUT_FONT,
    padding: ft === 'textarea' ? '3px 4px' : '0 4px',
    boxSizing: 'border-box',
    outline: 'none',
    pointerEvents: editLayoutOn ? 'none' : 'auto',
    resize: 'none',
  };

  if (ft === 'textarea') {
    return (
      <textarea value={value || ''} onChange={(e) => setValue(e.target.value)} placeholder={block.placeholder || ''} style={baseStyle} />
    );
  }
  if (ft === 'checkbox' || ft === 'radio') {
    // Multi-option group: each option renders as [☐ label] (or [○ label] for radio).
    // Flex-wrap fills width. For radio only one option may be selected at a time.
    const isRadio = ft === 'radio';
    const opts = block.options && block.options.length ? block.options : [''];
    const vals = values || [];
    // For radio: selected index comes from values[0] if set, otherwise block.selectedIndex
    // (the configured default). vals[0] === null means "user cleared the default".
    const selectedIdx = isRadio
      ? (vals.length > 0 ? vals[0] : (block.selectedIndex == null ? null : block.selectedIndex))
      : null;
    const groupStyle = {
      width: w,
      height: h,
      boxSizing: 'border-box',
      padding: '2px 4px',
      // Subtle dashed boundary so users see the group rectangle in Edit Layout
      border: editLayoutOn ? '1px dashed #c7d2e0' : '1px solid transparent',
      background: '#ffffff',
      overflow: 'hidden',
      display: 'flex',
      flexWrap: 'wrap',
      alignContent: 'flex-start',
      gap: '4px 12px',
      pointerEvents: editLayoutOn ? 'none' : 'auto',
    };
    return (
      <div style={groupStyle}>
        {opts.map((label, i) => {
          const checked = isRadio ? (selectedIdx === i) : !!vals[i];
          return (
            <label key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              font: INPUT_FONT, color: NAVY, lineHeight: '16px',
              whiteSpace: 'nowrap',
              cursor: editLayoutOn ? 'inherit' : 'pointer',
            }}>
              {isRadio ? (
                // Custom circle so the ring-and-dot is visually consistent
                // regardless of the platform's native radio styling.
                <span
                  onClick={(e) => {
                    if (editLayoutOn || !setValues) return;
                    e.preventDefault();
                    // Click same option again to deselect (matches typical mockup feel).
                    setValues([checked ? null : i]);
                  }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 11, height: 11, borderRadius: '50%',
                    border: '1px solid #555', background: '#fff',
                    boxSizing: 'border-box',
                  }}
                  aria-checked={checked}
                  role="radio"
                >
                  {checked && (
                    <span style={{
                      display: 'block',
                      width: 5, height: 5, borderRadius: '50%',
                      background: NAVY,
                    }} />
                  )}
                </span>
              ) : (
                <input
                  type="checkbox"
                  checked={!!vals[i]}
                  onChange={(e) => {
                    if (!setValues) return;
                    const next = vals.slice();
                    next[i] = e.target.checked;
                    setValues(next);
                  }}
                  style={{ margin: 0 }}
                />
              )}
              <span>{label}</span>
            </label>
          );
        })}
      </div>
    );
  }
  if (ft === 'date')   return <input type="date"   value={value || ''} onChange={(e) => setValue(e.target.value)} style={baseStyle} />;
  if (ft === 'time')   return <input type="time"   value={value || ''} onChange={(e) => setValue(e.target.value)} style={baseStyle} />;
  if (ft === 'number') return <input type="number" value={value || ''} onChange={(e) => setValue(e.target.value)} placeholder={block.placeholder || ''} style={baseStyle} />;
  return <input type="text" value={value || ''} onChange={(e) => setValue(e.target.value)} placeholder={block.placeholder || ''} style={baseStyle} />;
}

// ---------------------------------------------------------------------------
// Block wrapper — positioned, selectable, drag source, double-click editor
// ---------------------------------------------------------------------------
function Block(props) {
  const {
    block, selected, editLayoutOn, editingLabel, fieldValue,
    onMouseDown, onClick, onDoubleClickLabel,
    onCommitLabel, onCancelLabel, onContextMenu, setFieldValue,
    onResizeStart,
  } = props;

  const isHeading = isHeadingType(block.type);
  const rect = getBlockRect(block);
  const isCheckboxGroup = block.type === 'field' && block.fieldType === 'checkbox';
  const isRadioGroup = block.type === 'field' && block.fieldType === 'radio';
  const isGroupField = isCheckboxGroup || isRadioGroup;

  // Outer wrapper at the block's bounding rect. Selection outline lives here.
  const wrapperStyle = {
    position: 'absolute',
    left: rect.x,
    top: rect.y,
    width: rect.w,
    height: rect.h,
    boxSizing: 'border-box',
    cursor: editLayoutOn ? 'move' : 'default',
  };
  if (selected && editLayoutOn) {
    wrapperStyle.outline = '1px dashed ' + SELECT_BLUE;
    wrapperStyle.outlineOffset = '1px';
  }

  // For headings we render the bar directly at the wrapper origin.
  // For fields we render label, then input below.
  // For text blocks we render the styled text.
  let inner;
  if (isHeading) {
    inner = (
      <HeadingBar
        block={block}
        editing={editingLabel}
        onCommitLabel={onCommitLabel}
        onCancelLabel={onCancelLabel}
      />
    );
  } else if (block.type === 'field') {
    // Checkbox / radio groups have no group label — render only the group.
    if (isGroupField) {
      inner = (
        <div style={{ position: 'absolute', left: 0, top: 0 }}>
          <FieldInput
            block={block}
            editLayoutOn={editLayoutOn}
            values={Array.isArray(fieldValue) ? fieldValue : []}
            setValues={setFieldValue}
          />
        </div>
      );
    } else {
      inner = (
        <div style={{ position: 'absolute', left: 0, top: 0 }}>
          <FieldLabel
            text={block.label}
            editing={editingLabel}
            onCommit={onCommitLabel}
            onCancel={onCancelLabel}
            onDoubleClick={onDoubleClickLabel}
          />
          <div style={{ position: 'relative' }}>
            <FieldInput block={block} editLayoutOn={editLayoutOn} value={fieldValue} setValue={setFieldValue} />
          </div>
        </div>
      );
    }
  } else if (block.type === 'text') {
    const t = TEXT_STYLES[block.variant] || TEXT_STYLES.general;
    const textStyle = {
      position: 'absolute',
      left: 0,
      top: 0,
      width: block.width || 300,
      font: t.font,
      color: t.color,
      fontStyle: t.italic ? 'italic' : 'normal',
      whiteSpace: 'pre-wrap',
      userSelect: editLayoutOn ? 'none' : 'auto',
    };
    if (editingLabel) {
      inner = (
        <InlineEdit
          initial={block.text}
          style={{ ...textStyle, width: block.width || 300, height: 18 }}
          onCommit={onCommitLabel}
          onCancel={onCancelLabel}
        />
      );
    } else {
      inner = <div style={textStyle} onDoubleClick={onDoubleClickLabel}>{block.text}</div>;
    }
  } else if (block.type === 'sticky') {
    inner = (
      <StickyNote
        block={block}
        editLayoutOn={editLayoutOn}
        editing={editingLabel}
        onCommit={onCommitLabel}
        onCancel={onCancelLabel}
        onDoubleClick={onDoubleClickLabel}
        onAutoGrow={(h) => props.onStickyAutoGrow && props.onStickyAutoGrow(block, h)}
      />
    );
  }

  const isField = block.type === 'field';
  const isResizable = (isField || block.type === 'sticky') && selected && editLayoutOn;
  const showResizeHandle = isResizable;

  return (
    <div
      data-block-id={block.id}
      style={wrapperStyle}
      onMouseDown={(e) => onMouseDown(e, block)}
      onClick={(e) => onClick(e, block)}
      onContextMenu={(e) => onContextMenu(e, block)}
      onDoubleClick={(e) => {
        // For headings, double-click anywhere on the bar opens label edit
        if (isHeading && editLayoutOn) {
          e.stopPropagation();
          onDoubleClickLabel(block);
        }
      }}
    >
      {inner}
      {showResizeHandle && (
        <div
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onResizeStart && onResizeStart(block, e); }}
          title="Drag to resize"
          style={{
            position: 'absolute',
            right: -1, bottom: -1,
            width: 12, height: 12,
            background: SELECT_BLUE,
            border: '1px solid #fff',
            cursor: 'nwse-resize',
            zIndex: 5,
            // small triangle look
            clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StickyNote — yellow free-form note for the configuration team.
// In Edit Layout mode it behaves like any other block (select / drag / resize);
// double-click to edit text. Outside Edit Layout, the textarea is directly
// focusable so the user can type without entering a mode.
// ---------------------------------------------------------------------------
function StickyNote({ block, editLayoutOn, editing, onCommit, onCancel, onDoubleClick, onAutoGrow }) {
  const w = block.width || STICKY_DEFAULTS.width;
  const h = block.height || STICKY_DEFAULTS.height;
  const taRef = useRef(null);

  // Outer "paper" — flat yellow with a small darker header strip.
  const paper = {
    position: 'absolute',
    left: 0, top: 0,
    width: w, height: h,
    boxSizing: 'border-box',
    background: '#fff59d',
    border: '1px solid #e6cc44',
    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  };
  const header = {
    height: 16, flex: '0 0 16px',
    background: '#fbe57c',
    borderBottom: '1px solid #e6cc44',
    display: 'flex', alignItems: 'center',
    padding: '0 6px',
    font: 'bold 9px Tahoma, Geneva, sans-serif',
    color: '#7a6a1a',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    userSelect: 'none',
  };
  const body = {
    flex: 1,
    padding: '4px 6px',
    font: '11px/1.4 Tahoma, Geneva, sans-serif',
    color: '#3f3a1a',
    boxSizing: 'border-box',
    overflow: 'hidden',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  };
  const taStyle = {
    width: '100%', height: '100%',
    boxSizing: 'border-box',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    resize: 'none',
    padding: 0, margin: 0,
    font: 'inherit',
    color: 'inherit',
  };

  if (editing) {
    // Inline edit overlay — replaces body with focused textarea
    return (
      <div style={paper}>
        <div style={header}>Configuration note</div>
        <div style={body}>
          <InlineEdit
            initial={block.text || ''}
            style={{ ...taStyle, background: 'rgba(255,255,255,0.7)', border: '1px dashed ' + SELECT_BLUE, padding: '2px 4px' }}
            onCommit={onCommit}
            onCancel={onCancel}
            multiline
          />
        </div>
      </div>
    );
  }

  // Outside Edit Layout: the textarea is the source of truth, edits commit on blur.
  if (!editLayoutOn) {
    return (
      <div style={paper}>
        <div style={header}>Configuration note</div>
        <div style={body}>
          <DeferredStickyText
            ref={taRef}
            block={block}
            onCommit={onCommit}
            onAutoGrow={onAutoGrow}
            placeholder={STICKY_DEFAULTS.placeholder}
            style={taStyle}
          />
        </div>
      </div>
    );
  }

  // In Edit Layout: read-only display, double-click body to edit.
  return (
    <div style={paper}>
      <div style={header}>Configuration note</div>
      <div
        style={{ ...body, cursor: 'pointer' }}
        onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick && onDoubleClick(); }}
      >
        {block.text
          ? block.text
          : <span style={{ color: '#9e8b3d', fontStyle: 'italic' }}>{STICKY_DEFAULTS.placeholder}</span>}
      </div>
    </div>
  );
}

// Sticky textarea that commits on blur (so each change is one history entry).
// Calls onAutoGrow whenever its scrollHeight exceeds the current rendered
// height so the host can resize the block (live, no history entry).
const DeferredStickyText = React.forwardRef(function DeferredStickyText({ block, onCommit, onAutoGrow, placeholder, style }, ref) {
  const [val, setVal] = useState(block.text || '');
  const valueAtFocus = useRef(val);
  const localRef = useRef(null);
  // Re-sync if block.text changes externally (e.g. history rollback)
  useEffect(() => { setVal(block.text || ''); }, [block.text]);

  // Auto-grow effect — runs after each render
  useEffect(() => {
    if (!onAutoGrow || !localRef.current) return;
    const ta = localRef.current;
    // Reset to measure
    const prev = ta.style.height;
    ta.style.height = 'auto';
    const needed = ta.scrollHeight;
    ta.style.height = prev;
    // Total sticky height = header (16) + padding (4 top + 4 bottom) + needed
    const totalNeeded = 16 + 8 + needed + 2; // +2 fudge
    if (totalNeeded > (block.height || STICKY_DEFAULTS.height)) {
      onAutoGrow(totalNeeded);
    }
  }, [val, block.height, onAutoGrow]);

  return (
    <textarea
      ref={(el) => {
        localRef.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
      }}
      value={val}
      placeholder={placeholder}
      onFocus={(e) => { valueAtFocus.current = e.target.value; }}
      onChange={(e) => setVal(e.target.value)}
      onBlur={(e) => { if (e.target.value !== valueAtFocus.current) onCommit(e.target.value); }}
      onMouseDown={(e) => e.stopPropagation()}
      style={style}
    />
  );
});

Object.assign(window, { Block, InlineEdit, StickyNote });
