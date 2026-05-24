// ---------------------------------------------------------------------------
// Style guide tokens — derived from Eastern Health PowerForm Style Guide v1.6
// These are the single source of truth for every form-element rendering.
// ---------------------------------------------------------------------------
const NAVY = '#000080';
const INSTR_BLUE = '#0000FF';
const MANDATORY_BG = '#FFFF99';
const INPUT_BORDER = '#7F9DB9';
const SELECT_BLUE = '#2568D4';
const GUIDE_PINK = '#FF1493';

const BAR_STYLES = {
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

const TEXT_STYLES = {
  label:             { font: 'bold 10px Tahoma, Geneva, sans-serif',         color: NAVY,        italic: false },
  general:           { font: 'normal 10px Tahoma, Geneva, sans-serif',       color: NAVY,        italic: false },
  instructionalBold: { font: 'bold 9px Tahoma, Geneva, sans-serif',          color: INSTR_BLUE,  italic: true  },
  instructional:    { font: 'normal 9px Tahoma, Geneva, sans-serif',        color: INSTR_BLUE,  italic: true  },
};

const INPUT_FONT = 'normal 10px Tahoma, Geneva, sans-serif';
const FIELD_LABEL_HEIGHT = 14; // vertical space reserved for label above the input

// ---------------------------------------------------------------------------
// IDs & defaults
// ---------------------------------------------------------------------------
let __idSeq = 0;
function uid(prefix) {
  __idSeq += 1;
  return (prefix || 'b') + '_' + Date.now().toString(36).slice(-4) + __idSeq;
}

const FIELD_DEFAULTS = {
  text:     { width: 200, height: 22, label: 'Text field' },
  number:   { width: 110, height: 22, label: 'Number' },
  date:     { width: 110, height: 22, label: 'Date' },
  time:     { width: 90,  height: 22, label: 'Time' },
  checkbox: { width: 220, height: 22, label: '', options: ['Option 1'] },
  radio:    { width: 220, height: 22, label: '', options: ['Option 1'], selectedIndex: null },
  textarea: { width: 400, height: 90, label: 'Notes' },
};

const HEADING_DEFAULT_LABELS = {
  heading1:   ' Heading 1',
  heading2:   ' Heading 2',
  subSection: ' Sub-Section Heading',
};

// ---------------------------------------------------------------------------
// Demo: minimal Nursing Assessment
// ---------------------------------------------------------------------------
function buildDemoForm() {
  const blocks = [];
  const add = (b) => { blocks.push({ id: uid(b.type), ...b }); };

  // Form heading
  add({ type: 'formHeading', x: 5, y: 5, label: ' Nursing Assessment' });

  // --- Patient Details
  add({ type: 'heading1', x: 5, y: 55, label: ' Patient Details' });
  add({ type: 'field', fieldType: 'date',     label: 'Date',           x: 10,  y: 110, width: 110, height: 22, mandatory: true  });
  add({ type: 'field', fieldType: 'time',     label: 'Time',           x: 135, y: 110, width: 90,  height: 22, mandatory: true });
  add({ type: 'field', fieldType: 'text',     label: 'Clinician Name', x: 240, y: 110, width: 260, height: 22, mandatory: true });
  add({ type: 'field', fieldType: 'text',     label: 'Ward',           x: 515, y: 110, width: 180, height: 22, mandatory: true });
  add({ type: 'text',  variant: 'instructional', text: 'Enter assessment date and assigned ward. Mandatory fields are highlighted in yellow.', x: 10, y: 148, width: 800 });

  // --- Vital Signs
  add({ type: 'heading1', x: 5, y: 185, label: ' Vital Signs' });
  add({ type: 'heading2', x: 5, y: 220, label: ' Observations' });
  add({ type: 'field', fieldType: 'text',   label: 'Blood Pressure (mmHg)', x: 10,  y: 275, width: 130, height: 22, placeholder: '120/80' });
  add({ type: 'field', fieldType: 'number', label: 'Heart Rate (bpm)',      x: 155, y: 275, width: 90,  height: 22 });
  add({ type: 'field', fieldType: 'number', label: 'Temp (°C)',             x: 260, y: 275, width: 90,  height: 22 });
  add({ type: 'field', fieldType: 'number', label: 'SpO2 (%)',              x: 365, y: 275, width: 80,  height: 22 });
  add({ type: 'field', fieldType: 'number', label: 'GCS',                   x: 460, y: 275, width: 60,  height: 22 });

  add({ type: 'heading2', x: 5, y: 315, label: ' Respiratory' });
  add({ type: 'field', fieldType: 'number',   label: 'Resp Rate (/min)', x: 10,  y: 370, width: 110, height: 22 });
  add({ type: 'field', fieldType: 'text',     label: 'O2 Therapy',       x: 135, y: 370, width: 170, height: 22 });
  add({ type: 'field', fieldType: 'number',   label: 'Flow Rate (L/min)', x: 320, y: 370, width: 110, height: 22 });
  add({ type: 'text',  variant: 'instructionalBold', text: 'Record observations on admission and at each set of vitals.', x: 10, y: 405, width: 800 });

  // --- Clinical Notes
  add({ type: 'heading1', x: 5, y: 445, label: ' Clinical Notes' });
  add({ type: 'field', fieldType: 'textarea', label: 'Free-text notes', x: 10, y: 500, width: 820, height: 120 });

  return { title: ' Nursing Assessment', blocks };
}

// ---------------------------------------------------------------------------
// Block helpers
// ---------------------------------------------------------------------------
function isHeadingType(t) {
  return t === 'formHeading' || t === 'heading1' || t === 'heading2' || t === 'subSection';
}

// Returns a rectangle representing the block's bounding box for snap math
function getBlockRect(block) {
  if (isHeadingType(block.type)) {
    const s = BAR_STYLES[block.type];
    return { x: block.x, y: block.y, w: s.width, h: s.height };
  }
  if (block.type === 'field') {
    // include label above the input (unless this is a checkbox group, which has no group label)
    const w = block.width || FIELD_DEFAULTS[block.fieldType].width;
    const h = block.height || FIELD_DEFAULTS[block.fieldType].height;
    if (block.fieldType === 'checkbox' || block.fieldType === 'radio') {
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

function describeBlock(block) {
  if (block.type === 'formHeading') return 'form heading';
  if (block.type === 'heading1')    return "heading 1 '" + (block.label || '').trim() + "'";
  if (block.type === 'heading2')    return "heading 2 '" + (block.label || '').trim() + "'";
  if (block.type === 'subSection')  return "sub-section '" + (block.label || '').trim() + "'";
  if (block.type === 'field')       return block.fieldType + " field '" + (block.label || '').trim() + "'";
  if (block.type === 'text')        return "text '" + (block.text || '').slice(0, 24).trim() + "'";
  if (block.type === 'sticky')      return "sticky note '" + (block.text || '').slice(0, 24).trim() + "'";
  return 'block';
}

// Sticky note defaults
const STICKY_DEFAULTS = {
  width: 180,
  height: 130,
  text: '',
  placeholder: 'Note to configuration team…',
};

// Export to globals (cross-script sharing)
Object.assign(window, {
  NAVY, INSTR_BLUE, MANDATORY_BG, INPUT_BORDER, SELECT_BLUE, GUIDE_PINK,
  BAR_STYLES, TEXT_STYLES, INPUT_FONT, FIELD_LABEL_HEIGHT,
  uid, FIELD_DEFAULTS, HEADING_DEFAULT_LABELS, STICKY_DEFAULTS,
  buildDemoForm, isHeadingType, getBlockRect, describeBlock,
});
