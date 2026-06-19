// ---------------------------------------------------------------------------
// Style guide tokens — derived from Eastern Health PowerForm Style Guide v1.6
// ---------------------------------------------------------------------------
export const NAVY = '#000080';
export const INSTR_BLUE = '#0000FF';
export const MANDATORY_BG = '#FFFF99';
export const DISABLED_BG = '#eef1f4';
export const DISABLED_TEXT = '#9aa3af';
export const INPUT_BORDER = '#7F9DB9';
export const SELECT_BLUE = '#2568D4';
export const GUIDE_PINK = '#FF1493';

export const BAR_STYLES = {
  formHeading: {
    height: 35,
    width: 850,
    left: 5,
    bg: 'rgb(0, 48, 135)',
    color: '#ffffff',
    font: 'bold 14px Verdana, Geneva, sans-serif',
    label: 'Form Heading',
  },
  heading1: {
    height: 30,
    width: 850,
    left: 5,
    bg: 'rgb(255, 200, 69)',
    color: NAVY,
    font: 'bold 13px Verdana, Geneva, sans-serif',
    label: 'Heading 1',
  },
  heading2: {
    height: 25,
    width: 850,
    left: 5,
    bg: 'rgb(237, 125, 49)',
    color: '#ffffff',
    font: 'bold 12px Verdana, Geneva, sans-serif',
    label: 'Heading 2',
  },
  subSection: {
    height: 20,
    width: 850,
    left: 5,
    bg: 'rgb(112, 173, 71)',
    color: '#ffffff',
    font: 'bold 11px Verdana, Geneva, sans-serif',
    label: 'Sub-Section',
  },
};

export const TEXT_STYLES = {
  label:             { font: 'bold 10px Tahoma, Geneva, sans-serif',   color: NAVY,       italic: false },
  general:           { font: 'normal 10px Tahoma, Geneva, sans-serif', color: NAVY,       italic: false },
  instructionalBold: { font: 'bold 9px Tahoma, Geneva, sans-serif',    color: INSTR_BLUE, italic: true  },
  instructional:     { font: 'normal 9px Tahoma, Geneva, sans-serif',  color: INSTR_BLUE, italic: true  },
};

export const INPUT_FONT = 'normal 10px Tahoma, Geneva, sans-serif';
export const FIELD_LABEL_HEIGHT = 14;

// ---------------------------------------------------------------------------
// IDs & defaults
// ---------------------------------------------------------------------------
let __idSeq = 0;
export function uid(prefix) {
  __idSeq += 1;
  return (prefix || 'b') + '_' + Date.now().toString(36).slice(-4) + __idSeq;
}

export const FIELD_DEFAULTS = {
  text:     { width: 200, height: 22, label: 'Text field' },
  number:   { width: 110, height: 22, label: 'Number' },
  date:     { width: 110, height: 22, label: 'Date' },
  time:     { width: 90,  height: 22, label: 'Time' },
  checkbox: { width: 220, height: 22, label: '', options: ['Option 1'], optionWeights: [0] },
  radio:    { width: 220, height: 22, label: '', options: ['Option 1'], optionWeights: [0], selectedIndex: null },
  dropdown: { width: 180, height: 22, label: '', options: ['Option 1'], optionWeights: [0], selectedIndex: null, placeholder: 'Select…' },
  textarea: { width: 400, height: 90, label: 'Notes' },
};

export const HEADING_DEFAULT_LABELS = {
  formHeading: ' Form Heading',
  heading1:   ' Heading 1',
  heading2:   ' Heading 2',
  subSection: ' Sub-Section Heading',
};

// ---------------------------------------------------------------------------
// Demo: minimal Nursing Assessment
// ---------------------------------------------------------------------------
export function buildDemoForm() {
  const blocks = [];
  const add = (b) => { blocks.push({ id: uid(b.type), ...b }); };

  add({ type: 'formHeading', x: 5, y: 5, label: ' Nursing Assessment' });

  add({ type: 'heading1', x: 5, y: 55, label: ' Patient Details' });
  add({ type: 'field', fieldType: 'date',     label: 'Date',           x: 10,  y: 110, width: 110, height: 22, mandatory: true });
  add({ type: 'field', fieldType: 'time',     label: 'Time',           x: 135, y: 110, width: 90,  height: 22, mandatory: true });
  add({ type: 'field', fieldType: 'text',     label: 'Clinician Name', x: 240, y: 110, width: 260, height: 22, mandatory: true });
  add({ type: 'field', fieldType: 'text',     label: 'Ward',           x: 515, y: 110, width: 180, height: 22, mandatory: true });
  add({ type: 'text',  variant: 'instructional', text: 'Enter assessment date and assigned ward. Mandatory fields are highlighted in yellow.', x: 10, y: 148, width: 800 });

  add({ type: 'heading1', x: 5, y: 185, label: ' Vital Signs' });
  add({ type: 'heading2', x: 5, y: 220, label: ' Observations' });
  add({ type: 'field', fieldType: 'text',   label: 'Blood Pressure (mmHg)', x: 10,  y: 275, width: 130, height: 22, placeholder: '120/80' });
  add({ type: 'field', fieldType: 'number', label: 'Heart Rate (bpm)',      x: 155, y: 275, width: 90,  height: 22 });
  add({ type: 'field', fieldType: 'number', label: 'Temp (°C)',             x: 260, y: 275, width: 90,  height: 22 });
  add({ type: 'field', fieldType: 'number', label: 'SpO2 (%)',              x: 365, y: 275, width: 80,  height: 22 });
  add({ type: 'field', fieldType: 'number', label: 'GCS',                   x: 460, y: 275, width: 60,  height: 22 });

  add({ type: 'heading2', x: 5, y: 315, label: ' Respiratory' });
  add({ type: 'field', fieldType: 'number', label: 'Resp Rate (/min)',  x: 10,  y: 370, width: 110, height: 22 });
  add({ type: 'field', fieldType: 'text',   label: 'O2 Therapy',        x: 135, y: 370, width: 170, height: 22 });
  add({ type: 'field', fieldType: 'number', label: 'Flow Rate (L/min)', x: 320, y: 370, width: 110, height: 22 });
  add({ type: 'text',  variant: 'instructionalBold', text: 'Record observations on admission and at each set of vitals.', x: 10, y: 405, width: 800 });

  add({ type: 'heading1', x: 5, y: 445, label: ' Clinical Notes' });
  add({ type: 'field', fieldType: 'textarea', label: 'Free-text notes', x: 10, y: 500, width: 820, height: 120 });

  return { title: ' Nursing Assessment', blocks };
}

// ---------------------------------------------------------------------------
// Block helpers
// ---------------------------------------------------------------------------
export function isHeadingType(t) {
  return t === 'formHeading' || t === 'heading1' || t === 'heading2' || t === 'subSection';
}

export function getBlockRect(block) {
  if (isHeadingType(block.type)) {
    const s = BAR_STYLES[block.type];
    return { x: block.x, y: block.y, w: s.width, h: s.height };
  }
  if (block.type === 'field') {
    const w = block.width || FIELD_DEFAULTS[block.fieldType].width;
    const h = block.height || FIELD_DEFAULTS[block.fieldType].height;
    if (block.fieldType === 'checkbox' || block.fieldType === 'radio' || block.fieldType === 'dropdown') {
      return { x: block.x, y: block.y, w, h };
    }
    return { x: block.x, y: block.y - FIELD_LABEL_HEIGHT, w, h: h + FIELD_LABEL_HEIGHT };
  }
  if (block.type === 'text') {
    return { x: block.x, y: block.y, w: block.width || 300, h: 18 };
  }
  if (block.type === 'sticky') {
    return { x: block.x, y: block.y, w: block.width || 180, h: block.height || 130 };
  }
  return { x: block.x, y: block.y, w: 100, h: 20 };
}

export function describeBlock(block) {
  if (block.type === 'formHeading') return 'form heading';
  if (block.type === 'heading1')    return "heading 1 '" + (block.label || '').trim() + "'";
  if (block.type === 'heading2')    return "heading 2 '" + (block.label || '').trim() + "'";
  if (block.type === 'subSection')  return "sub-section '" + (block.label || '').trim() + "'";
  if (block.type === 'field')       return block.fieldType + " field '" + (block.label || '').trim() + "'";
  if (block.type === 'text')        return "text '" + (block.text || '').slice(0, 24).trim() + "'";
  if (block.type === 'sticky')      return "sticky note '" + (block.text || '').slice(0, 24).trim() + "'";
  return 'block';
}

export const STICKY_DEFAULTS = {
  width: 180,
  height: 130,
  text: '',
  placeholder: 'Note to configuration team…',
};

// ---------------------------------------------------------------------------
// Conditional logic (Millennium-style conditional activation)
//
// A field can carry an `enableWhen` rule:
//   { sourceId, op, value }
// The source field produces a numeric "score" (scoreOf). When that score
// satisfies the operator against `value`, the target field is editable;
// otherwise it is greyed out and locked.
//
// Option-bearing fields (radio/checkbox/dropdown) carry a parallel
// `optionWeights` array aligned by index with `options` (missing → 0).
// ---------------------------------------------------------------------------

// Field types that can act as a conditional-logic source (produce a score).
export function isScoreableField(block) {
  return block && block.type === 'field'
    && ['number', 'radio', 'checkbox', 'dropdown'].includes(block.fieldType);
}

// Ordered operator map — keys mirror the six Millennium operators.
export const OPERATORS = {
  eq: { symbol: '=',  label: 'Exactly equal (=)',          test: (a, b) => a === b },
  ne: { symbol: '≠',  label: 'Not equal to (≠)',           test: (a, b) => a !== b },
  lt: { symbol: '<',  label: 'Less than (<)',              test: (a, b) => a <  b },
  gt: { symbol: '>',  label: 'Greater than (>)',           test: (a, b) => a >  b },
  le: { symbol: '≤',  label: 'Less than or equal (≤)',     test: (a, b) => a <= b },
  ge: { symbol: '≥',  label: 'Greater than or equal (≥)',  test: (a, b) => a >= b },
};

// Weight for a given option index (missing entries default to 0).
function weightAt(block, i) {
  const w = block.optionWeights && block.optionWeights[i];
  return Number.isFinite(w) ? w : 0;
}

// Compute the numeric score a source field currently contributes, given the
// live value held in fieldValues for that field.
export function scoreOf(sourceBlock, value) {
  if (!sourceBlock) return 0;
  const ft = sourceBlock.fieldType;

  if (ft === 'number') return Number(value) || 0;

  if (ft === 'radio') {
    // radio value is stored as [idx]; fall back to the default selectedIndex.
    let idx = Array.isArray(value) && value.length ? value[0] : sourceBlock.selectedIndex;
    if (idx == null) return 0;
    return weightAt(sourceBlock, idx);
  }

  if (ft === 'checkbox') {
    // value is an array of booleans — sum the weights of checked options.
    const vals = Array.isArray(value) ? value : [];
    return (sourceBlock.options || []).reduce((sum, _o, i) => sum + (vals[i] ? weightAt(sourceBlock, i) : 0), 0);
  }

  if (ft === 'dropdown') {
    // value is the option text; fall back to the default selectedIndex.
    const opts = sourceBlock.options || [];
    let idx = value != null && value !== '' ? opts.indexOf(value) : sourceBlock.selectedIndex;
    if (idx == null || idx < 0) return 0;
    return weightAt(sourceBlock, idx);
  }

  return 0;
}

// Whether a block is currently editable given the live field values.
// Fields without a rule are always enabled.
export function evaluateEnabled(block, blocksById, fieldValues) {
  const rule = block && block.enableWhen;
  if (!rule || !rule.sourceId) return true;
  const source = blocksById[rule.sourceId];
  if (!source) return true; // dangling reference (source deleted) → no gate
  const op = OPERATORS[rule.op];
  if (!op) return true;
  const score = scoreOf(source, fieldValues[rule.sourceId]);
  return op.test(score, Number(rule.value) || 0);
}

// Human-readable summary of a rule, e.g. "Editable when ‘Pain score’ ≥ 3".
export function describeRule(block, blocksById) {
  const rule = block && block.enableWhen;
  if (!rule || !rule.sourceId) return '';
  const source = blocksById && blocksById[rule.sourceId];
  const name = source ? (source.label || '').trim() || describeBlock(source) : '(deleted field)';
  const op = OPERATORS[rule.op];
  const sym = op ? op.symbol : '?';
  return 'Editable when ‘' + name + '’ ' + sym + ' ' + (Number(rule.value) || 0);
}
