import { useState, useEffect, useRef, forwardRef } from 'react';
import {
  SELECT_BLUE, BAR_STYLES, TEXT_STYLES, INPUT_FONT, FIELD_LABEL_HEIGHT,
  NAVY, MANDATORY_BG, INPUT_BORDER, FIELD_DEFAULTS, STICKY_DEFAULTS,
  isHeadingType, getBlockRect,
} from './constants';

// Inline text editor — dashed blue outline, matches the source element font.
export function InlineEdit({ initial, style, onCommit, onCancel, multiline }) {
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

function HeadingBar({ block, editing, onCommitLabel, onCancelLabel }) {
  const s = BAR_STYLES[block.type];
  const style = {
    position: 'absolute',
    left: 0, top: 0,
    width: s.width, height: s.height,
    background: s.bg, color: s.color,
    font: s.font,
    display: 'flex', alignItems: 'center',
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
    width: w, height: h,
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
      <textarea value={value || ''} onChange={(e) => setValue(e.target.value)}
                placeholder={block.placeholder || ''} style={baseStyle} />
    );
  }

  if (ft === 'dropdown') {
    const opts = block.options && block.options.length ? block.options : [''];
    const defaultIdx = block.selectedIndex == null ? null : block.selectedIndex;
    const defaultVal = defaultIdx != null && opts[defaultIdx] != null ? opts[defaultIdx] : '';
    const currentVal = value != null && value !== '' ? value : defaultVal;
    const placeholder = block.placeholder || 'Select…';
    const showMandatoryBg = block.mandatory && !currentVal;

    const boxStyle = {
      width: w, height: h,
      border: '1px solid ' + INPUT_BORDER,
      background: showMandatoryBg ? MANDATORY_BG : '#ffffff',
      color: NAVY,
      font: INPUT_FONT,
      padding: '0 4px',
      boxSizing: 'border-box',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      overflow: 'hidden',
    };

    if (editLayoutOn) {
      return (
        <div style={{ ...boxStyle, pointerEvents: 'none', userSelect: 'none' }}>
          <span style={{
            color: currentVal ? NAVY : '#7d8aa0',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {currentVal || placeholder}
          </span>
          <span style={{ marginLeft: 6, color: NAVY, fontSize: 9, lineHeight: 1 }}>▾</span>
        </div>
      );
    }

    return (
      <div style={{ ...boxStyle, position: 'relative', padding: 0 }}>
        <select
          value={currentVal}
          onChange={(e) => setValue && setValue(e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            width: '100%', height: '100%',
            padding: '0 18px 0 4px',
            border: 'none',
            background: 'transparent',
            font: INPUT_FONT,
            color: currentVal ? NAVY : '#7d8aa0',
            outline: 'none',
            appearance: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            cursor: 'pointer',
            boxSizing: 'border-box',
          }}
        >
          {!currentVal && <option value="" disabled hidden>{placeholder}</option>}
          {opts.map((o, i) => (
            <option key={i} value={o}>{o}</option>
          ))}
        </select>
        <span style={{
          position: 'absolute', right: 4, top: '50%',
          transform: 'translateY(-50%)',
          color: NAVY, fontSize: 9, lineHeight: 1,
          pointerEvents: 'none',
        }}>▾</span>
      </div>
    );
  }

  if (ft === 'checkbox' || ft === 'radio') {
    const isRadio = ft === 'radio';
    const opts = block.options && block.options.length ? block.options : [''];
    const vals = values || [];
    const selectedIdx = isRadio
      ? (vals.length > 0 ? vals[0] : (block.selectedIndex == null ? null : block.selectedIndex))
      : null;
    const groupStyle = {
      width: w, height: h,
      boxSizing: 'border-box',
      padding: '2px 4px',
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
                <span
                  onClick={(e) => {
                    if (editLayoutOn || !setValues) return;
                    e.preventDefault();
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
export function Block(props) {
  const {
    block, selected, editLayoutOn, editingLabel, fieldValue,
    onMouseDown, onClick, onDoubleClickLabel,
    onCommitLabel, onCancelLabel, onContextMenu, setFieldValue,
    onResizeStart,
  } = props;

  const isHeading = isHeadingType(block.type);
  const rect = getBlockRect(block);
  const isCheckboxGroup = block.type === 'field' && block.fieldType === 'checkbox';
  const isRadioGroup    = block.type === 'field' && block.fieldType === 'radio';
  const isDropdown      = block.type === 'field' && block.fieldType === 'dropdown';
  const isNoLabelField  = isCheckboxGroup || isRadioGroup || isDropdown;

  const wrapperStyle = {
    position: 'absolute',
    left: rect.x, top: rect.y,
    width: rect.w, height: rect.h,
    boxSizing: 'border-box',
    cursor: editLayoutOn ? 'move' : 'default',
  };
  if (selected && editLayoutOn) {
    wrapperStyle.outline = '1px dashed ' + SELECT_BLUE;
    wrapperStyle.outlineOffset = '1px';
  }

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
    if (isNoLabelField) {
      const isGroup = isCheckboxGroup || isRadioGroup;
      inner = (
        <div style={{ position: 'absolute', left: 0, top: 0 }}>
          <FieldInput
            block={block}
            editLayoutOn={editLayoutOn}
            value={isGroup ? undefined : fieldValue}
            setValue={isGroup ? undefined : setFieldValue}
            values={isGroup && Array.isArray(fieldValue) ? fieldValue : []}
            setValues={isGroup ? setFieldValue : undefined}
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
      position: 'absolute', left: 0, top: 0,
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
  const isText = block.type === 'text';
  const isWidthOnlyResize = isText || isDropdown;
  const isResizable = (isField || block.type === 'sticky' || isText) && selected && editLayoutOn;

  return (
    <div
      data-block-id={block.id}
      style={wrapperStyle}
      onMouseDown={(e) => onMouseDown(e, block)}
      onClick={(e) => onClick(e, block)}
      onContextMenu={(e) => onContextMenu(e, block)}
      onDoubleClick={(e) => {
        if (isHeading && editLayoutOn) {
          e.stopPropagation();
          onDoubleClickLabel(block);
        }
      }}
    >
      {inner}
      {isResizable && (isWidthOnlyResize ? (
        <div
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onResizeStart && onResizeStart(block, e); }}
          title="Drag to resize width"
          style={{
            position: 'absolute',
            right: -4, top: -2, bottom: -2,
            width: 8,
            background: SELECT_BLUE,
            border: '1px solid #fff',
            borderRadius: 2,
            cursor: 'ew-resize',
            zIndex: 5,
          }}
        />
      ) : (
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
            clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StickyNote
// ---------------------------------------------------------------------------
export function StickyNote({ block, editLayoutOn, editing, onCommit, onCancel, onDoubleClick, onAutoGrow }) {
  const w = block.width  || STICKY_DEFAULTS.width;
  const h = block.height || STICKY_DEFAULTS.height;
  const taRef = useRef(null);

  const paper = {
    position: 'absolute', left: 0, top: 0,
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
    border: 'none', outline: 'none',
    resize: 'none',
    padding: 0, margin: 0,
    font: 'inherit', color: 'inherit',
  };

  if (editing) {
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

const DeferredStickyText = forwardRef(function DeferredStickyText({ block, onCommit, onAutoGrow, placeholder, style }, ref) {
  const [val, setVal] = useState(block.text || '');
  const valueAtFocus  = useRef(val);
  const localRef      = useRef(null);

  useEffect(() => { setVal(block.text || ''); }, [block.text]);

  useEffect(() => {
    if (!onAutoGrow || !localRef.current) return;
    const ta = localRef.current;
    const prev = ta.style.height;
    ta.style.height = 'auto';
    const needed = ta.scrollHeight;
    ta.style.height = prev;
    const totalNeeded = 16 + 8 + needed + 2;
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
