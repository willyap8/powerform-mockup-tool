import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  GUIDE_PINK, SELECT_BLUE,
  buildDemoForm, isHeadingType, getBlockRect, describeBlock,
  FIELD_LABEL_HEIGHT, FIELD_DEFAULTS, STICKY_DEFAULTS, uid,
  HEADING_DEFAULT_LABELS,
} from './constants';
import { useTweaks, TweaksPanel, TweakSection, TweakRadio } from './tweaks-panel';
import { Block } from './blocks';
import { FloatingToolbar } from './toolbar';
import { MenuBar, StyleGuideModal } from './menus';
import {
  serializeDesign, deserializeDesign,
  downloadDesignFile, openDesignFile,
  getSlot, saveToSlot,
  getCurrentSlotName, setCurrentSlotName,
  AutosaveIndicator, SaveSlotModal, OpenSlotModal, ConfirmDiscardModal,
} from './storage';
import {
  HistoryPanel, PropertiesPanel, ContextMenu,
  PrintOptionsDialog, NotesPane,
} from './panels';

const MAX_HISTORY    = 50;
const SNAP_THRESHOLD = 6;

function cloneForm(form) {
  return {
    title: form.title,
    blocks: form.blocks.map((b) => ({ ...b, options: b.options ? [...b.options] : undefined })),
  };
}

function toolName(key) {
  if (key.startsWith('field:')) return 'Placing ' + key.split(':')[1] + ' field';
  if (key.startsWith('text:'))  return 'Placing text';
  return 'Placing ' + key.replace(/([A-Z])/g, ' $1').toLowerCase();
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  const [tweaks, setTweak] = useTweaks({ gridSnap: 'off' });
  const gridStep = tweaks.gridSnap === '5px' ? 5 : tweaks.gridSnap === '10px' ? 10 : 0;

  const initialStateRef = useRef(null);
  if (initialStateRef.current === null) {
    const slotName = getCurrentSlotName();
    const slot = slotName ? getSlot(slotName) : null;
    let initialForm = null, initialNotes = '', description = 'Initial demo form loaded';
    if (slot) {
      try {
        const design = deserializeDesign(slot);
        initialForm = { title: design.title || ' Nursing Assessment', blocks: design.blocks };
        initialNotes = design.notes || '';
        description = "Restored '" + slotName + "' from browser";
      } catch (e) {
        initialForm = buildDemoForm();
      }
    } else {
      initialForm = buildDemoForm();
    }
    initialStateRef.current = { form: initialForm, notes: initialNotes, description, slotName: slot ? slotName : null };
  }
  const [form, setForm]           = useState(() => initialStateRef.current.form);
  const [history, setHistory]     = useState(() => [
    { form: cloneForm(initialStateRef.current.form), description: initialStateRef.current.description, ts: Date.now() }
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [previewIndex, setPreviewIndex] = useState(null);
  const [showJson,         setShowJson]         = useState(false);
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [showStyleGuide,   setShowStyleGuide]   = useState(false);

  // View toggles
  const [showGuides, setShowGuides] = useState(true);
  const [showGrid,   setShowGrid]   = useState(false);

  // Pane visibility
  const [showElementsPane, setShowElementsPane] = useState(true);
  const [showHistoryPane,  setShowHistoryPane]  = useState(false);
  const [showNotesPane,    setShowNotesPane]    = useState(false);

  // Notes (documentation; not part of undo history)
  const [notes, setNotes] = useState(() => initialStateRef.current.notes);
  const notesRef = useRef('');
  useEffect(() => { notesRef.current = notes; }, [notes]);

  // Selection & editing
  const [selectedIds,  setSelectedIds]  = useState([]);
  const [editLayoutOn, setEditLayoutOn] = useState(false);
  const [activeTool,   setActiveTool]   = useState(null);
  const [editingId,    setEditingId]    = useState(null);
  const [fieldValues,  setFieldValues]  = useState({});
  const [contextMenu,  setContextMenu]  = useState(null);

  // Disclaimer (every page load)
  const [disclaimerOpen, setDisclaimerOpen] = useState(true);

  // Save/Open modals
  const [saveSlotOpen,     setSaveSlotOpen]     = useState(false);
  const [saveSlotInitial,  setSaveSlotInitial]  = useState('');
  const [openSlotOpen,     setOpenSlotOpen]     = useState(false);
  const [pendingDestructive, setPendingDestructive] = useState(null);

  // Dirty tracking — lastSavedSnapshot is state (not a ref) so saves trigger re-render.
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(null);
  const [lastSaveName, setLastSaveName] = useState(() => initialStateRef.current.slotName || '');

  // Active save slot
  const [currentSlot, setCurrentSlot] = useState(() => getCurrentSlotName());

  // Drag
  const [dragGuides, setDragGuides] = useState([]);
  const dragRef = useRef(null);

  const isPreviewing   = previewIndex !== null;
  const effectiveForm  = isPreviewing && history[previewIndex] ? history[previewIndex].form : form;
  const placementDisabled = isPreviewing;

  // formRef mirrors `form` for callbacks that close over stale state
  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);

  // -------------------------------------------------------------------------
  // History commit
  // -------------------------------------------------------------------------
  const commit = useCallback((newForm, description) => {
    setForm(newForm);
    setHistory((prev) => {
      let truncated = prev.slice(0, historyIndex + 1);
      truncated.push({ form: cloneForm(newForm), description, ts: Date.now() });
      if (truncated.length > MAX_HISTORY) truncated = truncated.slice(truncated.length - MAX_HISTORY);
      setHistoryIndex(truncated.length - 1);
      return truncated;
    });
  }, [historyIndex]);

  // Snapshot the current live form (used by deferred inputs)
  const commitCurrent = useCallback((description) => {
    const cur = formRef.current;
    setHistory((prev) => {
      let truncated = prev.slice(0, historyIndex + 1);
      truncated.push({ form: cloneForm(cur), description, ts: Date.now() });
      if (truncated.length > MAX_HISTORY) truncated = truncated.slice(truncated.length - MAX_HISTORY);
      setHistoryIndex(truncated.length - 1);
      return truncated;
    });
  }, [historyIndex]);

  const updateBlock = (id, patch) => {
    setForm((f) => ({ ...f, blocks: f.blocks.map((b) => b.id === id ? { ...b, ...patch } : b) }));
  };
  const updateBlocks = (updater) => {
    setForm((f) => ({ ...f, blocks: updater(f.blocks) }));
  };

  // -------------------------------------------------------------------------
  // Click-to-place
  // -------------------------------------------------------------------------
  const handleCanvasClick = (e) => {
    if (e.target.closest && e.target.closest('[data-block-id]')) return;
    if (placementDisabled) return;
    if (activeTool) {
      const canvasRect = e.currentTarget.getBoundingClientRect();
      let x = e.clientX - canvasRect.left;
      let y = e.clientY - canvasRect.top;
      if (gridStep) { x = Math.round(x / gridStep) * gridStep; y = Math.round(y / gridStep) * gridStep; }
      placeNewBlock(activeTool, x, y);
      setActiveTool(null);
      return;
    }
    if (editLayoutOn) setSelectedIds([]);
  };

  const placeNewBlock = (toolKey, x, y) => {
    const newBlock = makeBlockFromTool(toolKey, x, y);
    if (!newBlock) return;
    const newForm = { ...form, blocks: [...form.blocks, newBlock] };
    const desc = (() => {
      if (newBlock.type === 'field')  return "Added " + newBlock.fieldType + " field '" + newBlock.label + "'";
      if (newBlock.type === 'text')   return "Added text '" + newBlock.text.slice(0, 24) + "'";
      return "Added " + newBlock.type.replace(/([A-Z])/g, ' $1').toLowerCase().trim() + " '" + (newBlock.label || '').trim() + "'";
    })();
    commit(newForm, desc);
    if (editLayoutOn) setSelectedIds([newBlock.id]);
  };

  function makeBlockFromTool(toolKey, x, y) {
    if (toolKey.startsWith('field:')) {
      const ft = toolKey.split(':')[1];
      const d = FIELD_DEFAULTS[ft];
      const isGroup = ft === 'checkbox' || ft === 'radio';
      const yAdjusted = isGroup ? y : Math.max(y, FIELD_LABEL_HEIGHT + 2);
      return {
        id: uid('f'), type: 'field', fieldType: ft,
        label: d.label || '', x, y: yAdjusted,
        width: d.width, height: d.height,
        ...(ft === 'checkbox' ? { options: [...d.options] } : {}),
        ...(ft === 'radio'    ? { options: [...d.options], selectedIndex: null } : {}),
      };
    }
    if (toolKey.startsWith('text:')) {
      const variant = toolKey.split(':')[1];
      const placeholder =
        variant === 'label'             ? 'New label' :
        variant === 'general'           ? 'General text' :
        variant === 'instructionalBold' ? 'Instructional text (bold italic).' :
                                          'Instructional text (italic).';
      return { id: uid('t'), type: 'text', variant, text: placeholder, x, y, width: 360 };
    }
    if (toolKey === 'sticky') {
      return { id: uid('s'), type: 'sticky', text: '', x, y, width: STICKY_DEFAULTS.width, height: STICKY_DEFAULTS.height };
    }
    if (toolKey === 'heading1' || toolKey === 'heading2' || toolKey === 'subSection' || toolKey === 'formHeading') {
      return { id: uid('h'), type: toolKey, label: HEADING_DEFAULT_LABELS[toolKey] || ' Heading', x: 5, y };
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Selection / click on block
  // -------------------------------------------------------------------------
  const onBlockClick = (e, block) => {
    if (placementDisabled) return;
    if (activeTool) return;
    if (!editLayoutOn) return;
    e.stopPropagation();
  };

  // -------------------------------------------------------------------------
  // Drag
  // -------------------------------------------------------------------------
  const onBlockMouseDown = (e, block) => {
    if (placementDisabled || activeTool) return;
    if (editingId === block.id) return;
    if (!editLayoutOn) return;
    if (e.button !== 0) return;

    let newSelection;
    if (e.shiftKey) {
      if (selectedIds.includes(block.id)) newSelection = selectedIds.filter((id) => id !== block.id);
      else newSelection = [...selectedIds, block.id];
    } else {
      newSelection = selectedIds.includes(block.id) ? selectedIds : [block.id];
    }
    setSelectedIds(newSelection);

    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const blockStartPositions = {};
    form.blocks.forEach((b) => {
      if (newSelection.includes(b.id)) blockStartPositions[b.id] = { x: b.x, y: b.y };
    });
    dragRef.current = { startX, startY, blockStartPositions, moved: false, selection: newSelection };

    const onMove = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = ev.clientX - d.startX;
      const dy = ev.clientY - d.startY;
      if (!d.moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) d.moved = true;
      if (!d.moved) return;

      let proposed = {};
      Object.keys(d.blockStartPositions).forEach((id) => {
        const start = d.blockStartPositions[id];
        let nx = start.x + dx;
        let ny = start.y + dy;
        const blk = form.blocks.find((b) => b.id === id);
        if (blk && isHeadingType(blk.type)) nx = 5;
        nx = Math.max(0, nx);
        ny = Math.max(blk && blk.type === 'field' ? FIELD_LABEL_HEIGHT : 0, ny);
        proposed[id] = { x: nx, y: ny };
      });

      if (gridStep) {
        Object.keys(proposed).forEach((id) => {
          const blk = form.blocks.find((b) => b.id === id);
          if (blk && isHeadingType(blk.type)) return;
          proposed[id].x = Math.round(proposed[id].x / gridStep) * gridStep;
          proposed[id].y = Math.round(proposed[id].y / gridStep) * gridStep;
        });
      }

      // Alignment snap
      const guides = [];
      const others = form.blocks.filter((b) => !d.selection.includes(b.id));
      const otherVerts = [], otherHorz = [];
      others.forEach((b) => {
        const r = getBlockRect(b);
        otherVerts.push({ value: r.x }, { value: r.x + r.w / 2 }, { value: r.x + r.w });
        otherHorz.push({ value: r.y }, { value: r.y + r.h / 2 }, { value: r.y + r.h });
      });

      let bestDx = null, bestDxAbs = Infinity, bestVertGuide = null;
      let bestDy = null, bestDyAbs = Infinity, bestHorzGuide = null;
      d.selection.forEach((id) => {
        const blk = form.blocks.find((b) => b.id === id);
        if (!blk) return;
        const proposedBlock = { ...blk, x: proposed[id].x, y: proposed[id].y };
        const r = getBlockRect(proposedBlock);
        [r.x, r.x + r.w / 2, r.x + r.w].forEach((ev) => {
          otherVerts.forEach((ov) => {
            const diff = ov.value - ev;
            if (Math.abs(diff) <= SNAP_THRESHOLD && Math.abs(diff) < bestDxAbs) {
              bestDx = diff; bestDxAbs = Math.abs(diff); bestVertGuide = ov.value;
            }
          });
        });
        [r.y, r.y + r.h / 2, r.y + r.h].forEach((eh) => {
          otherHorz.forEach((oh) => {
            const diff = oh.value - eh;
            if (Math.abs(diff) <= SNAP_THRESHOLD && Math.abs(diff) < bestDyAbs) {
              bestDy = diff; bestDyAbs = Math.abs(diff); bestHorzGuide = oh.value;
            }
          });
        });
      });

      if (bestDx !== null) {
        Object.keys(proposed).forEach((id) => {
          const blk = form.blocks.find((b) => b.id === id);
          if (blk && isHeadingType(blk.type)) return;
          proposed[id].x = proposed[id].x + bestDx;
        });
        guides.push({ kind: 'v', value: bestVertGuide });
      }
      if (bestDy !== null) {
        Object.keys(proposed).forEach((id) => { proposed[id].y = proposed[id].y + bestDy; });
        guides.push({ kind: 'h', value: bestHorzGuide });
      }

      setDragGuides(guides);
      updateBlocks((blocks) => blocks.map((b) => proposed[b.id] ? { ...b, x: proposed[b.id].x, y: proposed[b.id].y } : b));
    };

    const onUp = () => {
      const d = dragRef.current;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setDragGuides([]);
      dragRef.current = null;
      if (d && d.moved) {
        const ids = d.selection;
        const desc = ids.length === 1
          ? "Moved " + (form.blocks.find((x) => x.id === ids[0]) ? describeBlock(form.blocks.find((x) => x.id === ids[0])) : 'block')
          : "Moved " + ids.length + ' blocks';
        setForm((cur) => {
          const newF = { ...cur };
          setHistory((prev) => {
            let truncated = prev.slice(0, historyIndex + 1);
            truncated.push({ form: cloneForm(newF), description: desc, ts: Date.now() });
            if (truncated.length > MAX_HISTORY) truncated = truncated.slice(truncated.length - MAX_HISTORY);
            setHistoryIndex(truncated.length - 1);
            return truncated;
          });
          return cur;
        });
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // -------------------------------------------------------------------------
  // Dirty tracking
  // -------------------------------------------------------------------------
  const currentSaved = useMemo(
    () => JSON.stringify({ blocks: serializeDesign(form, notes).blocks, notes }),
    [form, notes]
  );
  const dirty = lastSavedSnapshot !== null && lastSavedSnapshot !== currentSaved;
  useEffect(() => {
    if (lastSavedSnapshot === null) setLastSavedSnapshot(currentSaved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------------------
  // Warn before unload if there are unsaved changes
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handler = (e) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // -------------------------------------------------------------------------
  // Save / Open handlers
  // -------------------------------------------------------------------------
  const markSaved = () => {
    setLastSavedSnapshot(JSON.stringify({
      blocks: serializeDesign(formRef.current, notesRef.current).blocks,
      notes: notesRef.current,
    }));
  };

  const handleSaveFile = () => {
    downloadDesignFile(formRef.current, lastSaveName, notesRef.current);
    markSaved();
  };

  const loadDesign = (design, sourceName) => {
    const newForm  = { title: design.title || formRef.current.title, blocks: design.blocks };
    const newNotes = typeof design.notes === 'string' ? design.notes : '';
    setForm(newForm);
    setNotes(newNotes);
    setHistory([{ form: cloneForm(newForm), description: 'Opened ' + (sourceName || 'design'), ts: Date.now() }]);
    setHistoryIndex(0);
    setPreviewIndex(null);
    setSelectedIds([]);
    setActiveTool(null);
    setEditingId(null);
    setFieldValues({});
    setLastSavedSnapshot(JSON.stringify({
      blocks: serializeDesign(newForm, newNotes).blocks,
      notes: newNotes,
    }));
    if (sourceName) setLastSaveName(sourceName.replace(/\.powerform\.json$|\.json$/i, ''));
  };

  const handleOpenFile = () => {
    const proceed = () => {
      openDesignFile(
        (design, meta) => loadDesign(design, meta && meta.sourceName),
        (msg) => alert('Could not open file:\n\n' + msg)
      );
    };
    if (dirty) setPendingDestructive({ message: 'Opening a file will discard your unsaved changes.', confirmLabel: 'Discard and open', run: proceed });
    else proceed();
  };

  // Quick save (used by the 💾 icon): writes straight to the active slot if one
  // exists, otherwise opens the modal with the most reasonable starting name.
  const handleQuickSave = () => {
    if (currentSlot && getSlot(currentSlot)) {
      const ok = saveToSlot(currentSlot, formRef.current, notesRef.current);
      if (ok) markSaved();
      else alert('Could not save — browser storage may be full or blocked.');
      return;
    }
    if (currentSlot) {
      // Slot was removed externally; clear the stale reference.
      setCurrentSlot(null);
      setCurrentSlotName(null);
    }
    setSaveSlotInitial(lastSaveName || '');
    setSaveSlotOpen(true);
  };

  // "Save as" (File menu): always opens the modal, pre-filled with the active
  // slot name if one exists so the user can confirm or change it.
  const handleSaveSlot = () => {
    setSaveSlotInitial(currentSlot || '');
    setSaveSlotOpen(true);
  };
  const handleOpenSlot = () => setOpenSlotOpen(true);
  const handlePickSlot = (name, payload) => {
    try {
      const design = deserializeDesign(payload);
      loadDesign(design, name);
      // Make this slot the active save target so subsequent saves target this slot.
      setCurrentSlot(name);
      setCurrentSlotName(name);
      setOpenSlotOpen(false);
    } catch (e) {
      alert('Could not load slot:\n\n' + (e.message || String(e)));
    }
  };

  // -------------------------------------------------------------------------
  // Resize handle
  // -------------------------------------------------------------------------
  const onResizeStart = (block, e) => {
    if (!editLayoutOn || isPreviewing) return;
    const isText = block.type === 'text';
    const startX = e.clientX, startY = e.clientY;
    const startW = block.width  || (isText ? 300 : 220);
    const startH = block.height || 22;
    const MIN_W = 80, MIN_H = 22;
    const onMove = (ev) => {
      let nw = Math.max(MIN_W, startW + (ev.clientX - startX));
      let nh = Math.max(MIN_H, startH + (ev.clientY - startY));
      if (gridStep) { nw = Math.round(nw / gridStep) * gridStep; nh = Math.round(nh / gridStep) * gridStep; }
      updateBlock(block.id, isText ? { width: nw } : { width: nw, height: nh });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      commitCurrent('Resized ' + describeBlock(block));
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // -------------------------------------------------------------------------
  // Inline edit
  // -------------------------------------------------------------------------
  const startInlineEdit = (block) => {
    if (placementDisabled) return;
    setEditingId(block.id);
  };
  const commitInlineEdit = (block, newValue) => {
    setEditingId(null);
    let patch, desc;
    if (block.type === 'text') {
      patch = { text: newValue };
      desc  = "Edited text → '" + newValue.slice(0, 24) + "'";
    } else if (isHeadingType(block.type)) {
      let v = newValue;
      if (v && v[0] !== ' ') v = ' ' + v;
      patch = { label: v };
      desc  = "Edited heading → '" + v.trim() + "'";
    } else if (block.type === 'field') {
      patch = { label: newValue };
      desc  = "Edited field label → '" + newValue.trim() + "'";
    } else if (block.type === 'sticky') {
      patch = { text: newValue };
      desc  = "Edited sticky note → '" + (newValue || '').slice(0, 24).trim() + "'";
    }
    if (patch) {
      const newForm = { ...form, blocks: form.blocks.map((b) => b.id === block.id ? { ...b, ...patch } : b) };
      commit(newForm, desc);
    }
  };
  const cancelInlineEdit = () => setEditingId(null);

  // -------------------------------------------------------------------------
  // Delete / duplicate / context menu
  // -------------------------------------------------------------------------
  const deleteSelected = () => {
    if (!selectedIds.length || isPreviewing) return;
    const targets = form.blocks.filter((b) => selectedIds.includes(b.id));
    const desc = targets.length === 1 ? "Deleted " + describeBlock(targets[0]) : "Deleted " + targets.length + ' blocks';
    const newForm = { ...form, blocks: form.blocks.filter((b) => !selectedIds.includes(b.id)) };
    commit(newForm, desc);
    setSelectedIds([]);
  };

  const duplicateBlock = (block) => {
    if (isPreviewing) return;
    const copy = { ...block, id: uid('d'), x: (block.x || 0) + 12, y: (block.y || 0) + 12 };
    if (copy.options) copy.options = [...copy.options];
    const newForm = { ...form, blocks: [...form.blocks, copy] };
    commit(newForm, "Duplicated " + describeBlock(block));
    setSelectedIds([copy.id]);
  };

  const onBlockContextMenu = (e, block) => {
    if (!editLayoutOn || isPreviewing) return;
    e.preventDefault();
    if (!selectedIds.includes(block.id)) setSelectedIds([block.id]);
    setContextMenu({ x: e.clientX, y: e.clientY, blockId: block.id });
  };

  const onContextAction = (action) => {
    const id = contextMenu?.blockId;
    setContextMenu(null);
    if (!id) return;
    const block = form.blocks.find((b) => b.id === id);
    if (!block) return;
    if (action === 'edit')      startInlineEdit(block);
    if (action === 'duplicate') duplicateBlock(block);
    if (action === 'delete') {
      if (!selectedIds.includes(id)) {
        const newForm = { ...form, blocks: form.blocks.filter((b) => b.id !== id) };
        commit(newForm, "Deleted " + describeBlock(block));
        setSelectedIds([]);
      } else {
        deleteSelected();
      }
    }
  };

  // -------------------------------------------------------------------------
  // Keyboard shortcuts
  // -------------------------------------------------------------------------
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
      if (isTyping) {
        if (e.key === 'Escape' && activeTool) setActiveTool(null);
        return;
      }
      if (e.key === 'Escape') {
        if (activeTool)   { setActiveTool(null); return; }
        if (editingId)    { setEditingId(null);  return; }
        if (contextMenu)  { setContextMenu(null); return; }
        if (isPreviewing) { setPreviewIndex(null); return; }
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && !e.shiftKey) {
        e.preventDefault();
        if (!isPreviewing) handleQuickSave();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (historyIndex > 0 && !isPreviewing) {
          const target = historyIndex - 1;
          setHistoryIndex(target);
          setForm(cloneForm(history[target].form));
          setSelectedIds([]);
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (historyIndex < history.length - 1 && !isPreviewing) {
          const target = historyIndex + 1;
          setHistoryIndex(target);
          setForm(cloneForm(history[target].form));
          setSelectedIds([]);
        }
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && editLayoutOn && !isPreviewing) {
        if (selectedIds.length) { e.preventDefault(); deleteSelected(); }
        return;
      }
      if (editLayoutOn && !isPreviewing && selectedIds.length && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp'   ? -step : e.key === 'ArrowDown'  ? step : 0;
        const newForm = { ...form, blocks: form.blocks.map((b) => {
          if (!selectedIds.includes(b.id)) return b;
          if (isHeadingType(b.type)) return { ...b, y: Math.max(0, b.y + dy) };
          return { ...b, x: Math.max(0, b.x + dx), y: Math.max(FIELD_LABEL_HEIGHT, b.y + dy) };
        })};
        const blk = form.blocks.find((b) => b.id === selectedIds[0]);
        commit(newForm, "Nudged " + (selectedIds.length === 1 ? describeBlock(blk) : selectedIds.length + ' blocks'));
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeTool, editingId, contextMenu, isPreviewing, historyIndex, history, selectedIds, editLayoutOn, form]);

  // -------------------------------------------------------------------------
  // History preview / rollback
  // -------------------------------------------------------------------------
  const onPreview = (i) => {
    if (i === historyIndex) return;
    setPreviewIndex(i);
    setSelectedIds([]);
    setEditingId(null);
    setActiveTool(null);
  };
  const onConfirmRollback = () => {
    const i = previewIndex;
    if (i == null) return;
    const target = history[i];
    if (!target) return;
    setHistory(history.slice(0, i + 1));
    setHistoryIndex(i);
    setForm(cloneForm(target.form));
    setPreviewIndex(null);
  };
  const onCancelPreview = () => setPreviewIndex(null);

  const resetAll = () => {
    const doReset = () => {
      const fresh = buildDemoForm();
      setForm(fresh);
      setNotes('');
      setHistory([{ form: cloneForm(fresh), description: 'Reset to demo form', ts: Date.now() }]);
      setHistoryIndex(0);
      setPreviewIndex(null);
      setSelectedIds([]);
      setActiveTool(null);
      setEditingId(null);
      setFieldValues({});
      setLastSavedSnapshot(JSON.stringify({ blocks: serializeDesign(fresh, '').blocks, notes: '' }));
      // Detach from any previously loaded slot so the indicator reflects a fresh form.
      setCurrentSlot(null);
      setCurrentSlotName(null);
      setLastSaveName('');
    };
    if (dirty) {
      setPendingDestructive({ message: 'Reset all will discard your unsaved changes and reload the demo form.', confirmLabel: 'Discard and reset', run: doReset });
    } else {
      if (!confirm('Reset form and clear all history?')) return;
      doReset();
    }
  };

  // JSON export object
  const exportForm = useMemo(() => {
    const formBlocks = [], stickyNotes = [];
    effectiveForm.blocks.forEach((b) => {
      if (b.type === 'sticky') {
        stickyNotes.push({ x: b.x, y: b.y, width: b.width || STICKY_DEFAULTS.width, height: b.height || STICKY_DEFAULTS.height, text: b.text || '' });
      } else {
        const out = { ...b };
        delete out.id;
        formBlocks.push(out);
      }
    });
    return { title: effectiveForm.title, blocks: formBlocks, configurationNotes: stickyNotes, notes };
  }, [effectiveForm, notes]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const selectedBlock = selectedIds.length === 1 ? effectiveForm.blocks.find((b) => b.id === selectedIds[0]) : null;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f5f7',
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Helvetica, sans-serif',
      color: '#111827',
      overflow: 'hidden',
    }}>
      {/* Top bar */}
      <div style={{
        height: 48, background: '#fff', borderBottom: '1px solid #e5e7eb',
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: 16,
        position: 'sticky', top: 0, zIndex: 40,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 6,
            background: 'linear-gradient(135deg, rgb(0, 48, 135), #4060d0)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', font: 'bold 11px Verdana, sans-serif',
          }}>PF</div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            PowerForm Mockup Tool
            {dirty && <span title="Unsaved changes" style={{ marginLeft: 6, color: '#dc2626', fontSize: 16, fontWeight: 700 }}>•</span>}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>v1.6 style guide</div>
        </div>
        <div style={{ width: 1, height: 22, background: '#e5e7eb' }} />
        <MenuBar
          onPrintPreview={() => setShowPrintOptions(true)}
          onResetAll={resetAll}
          onSaveFile={handleSaveFile}
          onOpenFile={handleOpenFile}
          onSaveSlot={handleSaveSlot}
          onOpenSlot={handleOpenSlot}
          showGuides={showGuides} setShowGuides={setShowGuides}
          showGrid={showGrid}     setShowGrid={setShowGrid}
          showElements={showElementsPane} setShowElements={setShowElementsPane}
          showHistory={showHistoryPane}   setShowHistory={setShowHistoryPane}
          showNotes={showNotesPane}       setShowNotes={setShowNotesPane}
          onShowDisclaimer={() => setDisclaimerOpen(true)}
          onShowStyleGuide={() => setShowStyleGuide(true)}
          isPreviewing={isPreviewing}
        />
        <AutosaveIndicator
          slotName={currentSlot}
          dirty={dirty}
          onClickSave={handleQuickSave}
        />
        <div style={{ flex: 1 }} />
        <button
          onClick={() => { if (!isPreviewing) setEditLayoutOn(!editLayoutOn); }}
          disabled={isPreviewing}
          style={{
            padding: '6px 12px', fontSize: 12, fontWeight: 500,
            background: editLayoutOn ? '#ed7d31' : '#fff',
            color: editLayoutOn ? '#fff' : '#374151',
            border: '1px solid ' + (editLayoutOn ? '#ed7d31' : '#d1d5db'),
            borderRadius: 6, cursor: isPreviewing ? 'not-allowed' : 'pointer',
            opacity: isPreviewing ? 0.5 : 1,
            fontFamily: 'inherit', whiteSpace: 'nowrap',
          }}
        >
          {editLayoutOn ? '✎ Edit Layout: ON' : 'Edit Layout: OFF'}
        </button>
      </div>

      {/* Active tool / preview banners */}
      {activeTool && (
        <div style={{
          position: 'sticky', top: 48, zIndex: 35,
          background: '#fef3c7', borderBottom: '1px solid #fcd34d',
          padding: '8px 16px', fontSize: 12, color: '#92400e',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
          <strong>{toolName(activeTool)}</strong> — Click the form to place ·{' '}
          <kbd style={{ font: '10px "Roboto Mono", Menlo, monospace', background: '#fff', border: '1px solid #fcd34d', borderRadius: 3, padding: '0 4px' }}>Esc</kbd> to cancel
        </div>
      )}
      {isPreviewing && (
        <div style={{
          position: 'sticky', top: 48, zIndex: 35,
          background: '#fef3c7', borderBottom: '1px solid #fcd34d',
          padding: '8px 16px', fontSize: 12, color: '#92400e',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706' }} />
          Previewing #{previewIndex + 1}: {history[previewIndex]?.description} — Edit Layout and placement are disabled
        </div>
      )}

      {/* Scrollable form area */}
      <div style={{
        position: 'absolute',
        top: 48 + ((activeTool || isPreviewing) ? 34 : 0),
        left: showNotesPane ? 320 : 0,
        right: showHistoryPane ? 290 : 0,
        bottom: 0,
        overflow: 'auto',
        background: '#f5f5f7',
        transition: 'left 0.18s, right 0.18s',
      }}>
        <FormCanvas
          form={effectiveForm}
          editLayoutOn={editLayoutOn && !isPreviewing}
          selectedIds={selectedIds}
          editingId={editingId}
          activeTool={activeTool}
          gridStep={gridStep}
          showGuides={showGuides}
          showGrid={showGrid}
          fieldValues={fieldValues}
          setFieldValue={(id, v) => setFieldValues((s) => ({ ...s, [id]: v }))}
          guides={dragGuides}
          onCanvasClick={handleCanvasClick}
          onBlockMouseDown={onBlockMouseDown}
          onBlockClick={onBlockClick}
          onBlockContextMenu={onBlockContextMenu}
          onDoubleClickLabel={(b) => editLayoutOn && !isPreviewing && startInlineEdit(b)}
          onCommitLabel={(b, v) => commitInlineEdit(b, v)}
          onCancelLabel={cancelInlineEdit}
          onResizeStart={onResizeStart}
          onStickyAutoGrow={(b, h) => updateBlock(b.id, { height: h })}
        />
      </div>

      {showNotesPane && (
        <NotesPane committed={notes} onSave={(draft) => setNotes(draft)} onClose={() => setShowNotesPane(false)} />
      )}

      {showElementsPane && (
        <FloatingToolbar
          activeTool={activeTool}
          setActiveTool={(t) => { if (!isPreviewing) setActiveTool(t); }}
          disabled={isPreviewing}
          leftOffset={showNotesPane ? 320 : 0}
        />
      )}

      {showHistoryPane && (
        <HistoryPanel
          history={history}
          historyIndex={historyIndex}
          previewIndex={previewIndex}
          onPreview={onPreview}
          onConfirmRollback={onConfirmRollback}
          onCancelPreview={onCancelPreview}
          showJson={showJson}
          setShowJson={setShowJson}
          jsonString={JSON.stringify(exportForm, null, 2)}
          collapsed={false}
          setCollapsed={() => setShowHistoryPane(false)}
        />
      )}

      {selectedBlock && editLayoutOn && !isPreviewing && (
        <PropertiesPanel
          block={selectedBlock}
          historyCollapsed={!showHistoryPane}
          onLiveUpdate={(patch) => updateBlock(selectedBlock.id, patch)}
          onCommitDesc={(desc) => commitCurrent(desc)}
          onApplyAndCommit={(patch, desc) => {
            const newForm = { ...formRef.current, blocks: formRef.current.blocks.map((b) => b.id === selectedBlock.id ? { ...b, ...patch } : b) };
            commit(newForm, desc || 'Edited block');
          }}
          onClose={() => setSelectedIds([])}
        />
      )}

      <ContextMenu menu={contextMenu} onAction={onContextAction} onClose={() => setContextMenu(null)} />

      {showPrintOptions && <PrintOptionsDialog form={effectiveForm} displayName={lastSaveName || currentSlot || effectiveForm.title} onClose={() => setShowPrintOptions(false)} />}
      {showStyleGuide   && <StyleGuideModal onClose={() => setShowStyleGuide(false)} />}

      {saveSlotOpen && (
        <SaveSlotModal
          form={formRef.current}
          notes={notesRef.current}
          initialName={saveSlotInitial}
          onClose={() => setSaveSlotOpen(false)}
          onSaved={(name) => {
            markSaved();
            setLastSaveName(name);
            setSaveSlotOpen(false);
            setCurrentSlot(name);
            setCurrentSlotName(name);
          }}
        />
      )}

      {openSlotOpen && (
        <OpenSlotModal
          dirty={dirty}
          onClose={() => setOpenSlotOpen(false)}
          onPick={(name, payload) => {
            const proceed = () => handlePickSlot(name, payload);
            if (dirty) {
              setOpenSlotOpen(false);
              setPendingDestructive({ message: 'Opening "' + name + '" will discard your unsaved changes.', confirmLabel: 'Discard and open', run: proceed });
            } else {
              proceed();
            }
          }}
        />
      )}

      {pendingDestructive && (
        <ConfirmDiscardModal
          message={pendingDestructive.message}
          confirmLabel={pendingDestructive.confirmLabel}
          onCancel={() => setPendingDestructive(null)}
          onConfirm={() => { const run = pendingDestructive.run; setPendingDestructive(null); run && run(); }}
        />
      )}

      {disclaimerOpen && <DisclaimerModal onAcknowledge={() => setDisclaimerOpen(false)} />}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Layout">
          <TweakRadio
            label="Grid snap"
            value={tweaks.gridSnap}
            onChange={(v) => setTweak('gridSnap', v)}
            options={[
              { value: 'off',  label: 'Off'  },
              { value: '5px',  label: '5 px' },
              { value: '10px', label: '10 px' },
            ]}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FormCanvas
// ---------------------------------------------------------------------------
function FormCanvas(props) {
  const {
    form, editLayoutOn, selectedIds, editingId, activeTool, gridStep,
    showGuides, showGrid,
    fieldValues, setFieldValue, guides,
    onCanvasClick, onBlockMouseDown, onBlockClick, onBlockContextMenu,
    onDoubleClickLabel, onCommitLabel, onCancelLabel, onResizeStart, onStickyAutoGrow,
  } = props;

  const visualGridStep = showGrid ? 10 : 0;
  const lineGridStep = (gridStep && visualGridStep)
    ? Math.min(gridStep, visualGridStep)
    : (gridStep || visualGridStep);

  const maxBottom = form.blocks.reduce((m, b) => {
    const r = getBlockRect(b);
    return Math.max(m, r.y + r.h);
  }, 0);
  const canvasH = Math.max(maxBottom + 80, 700);
  const canvasW = 1000;

  return (
    <div style={{ minWidth: canvasW + 80, padding: '24px 40px 60px' }}>
      <div
        style={{
          position: 'relative',
          width: canvasW, minHeight: canvasH,
          background: '#fff',
          boxShadow: '0 2px 14px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.04)',
          borderRadius: 4,
          cursor: activeTool ? 'crosshair' : 'default',
          margin: '0 auto',
        }}
        onClick={onCanvasClick}
      >
        {lineGridStep > 0 && (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage:
              'linear-gradient(to right, rgba(15,23,42,0.05) 1px, transparent 1px),' +
              'linear-gradient(to bottom, rgba(15,23,42,0.05) 1px, transparent 1px)',
            backgroundSize: lineGridStep + 'px ' + lineGridStep + 'px',
          }} />
        )}

        {form.blocks.map((b) => (
          <Block
            key={b.id}
            block={b}
            selected={selectedIds.includes(b.id)}
            editLayoutOn={editLayoutOn}
            editingLabel={editingId === b.id}
            fieldValue={fieldValues[b.id]}
            setFieldValue={(v) => setFieldValue(b.id, v)}
            onMouseDown={onBlockMouseDown}
            onClick={onBlockClick}
            onContextMenu={onBlockContextMenu}
            onDoubleClickLabel={() => onDoubleClickLabel(b)}
            onCommitLabel={(v) => onCommitLabel(b, v)}
            onCancelLabel={onCancelLabel}
            onResizeStart={onResizeStart}
            onStickyAutoGrow={onStickyAutoGrow}
          />
        ))}

        {showGuides && guides.map((g, i) => (
          g.kind === 'v' ? (
            <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: g.value, width: 1, background: GUIDE_PINK, pointerEvents: 'none', zIndex: 20 }} />
          ) : (
            <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: g.value, height: 1, background: GUIDE_PINK, pointerEvents: 'none', zIndex: 20 }} />
          )
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DisclaimerModal
// ---------------------------------------------------------------------------
function DisclaimerModal({ onAcknowledge }) {
  const btnRef = useRef(null);
  useEffect(() => { btnRef.current && btnRef.current.focus(); }, []);
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Helvetica, sans-serif',
      }}
    >
      <div style={{
        width: 'min(520px, calc(100vw - 32px))',
        background: '#ffffff', borderRadius: 12,
        boxShadow: '0 24px 64px rgba(15, 23, 42, 0.35)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid #ececef',
          background: 'linear-gradient(180deg, rgba(0,48,135,0.04), transparent)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: '#fef3c7', color: '#92400e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⚠</div>
          <div style={{ fontWeight: 600, fontSize: 15, color: '#111827' }}>Mockup tool — please read before continuing</div>
        </div>
        <div style={{ padding: '18px 20px', color: '#1f2937', fontSize: 13, lineHeight: 1.55 }}>
          <p style={{ margin: '0 0 10px' }}>
            This tool is for <strong>mockup purposes only</strong>. Designs created here are intended to communicate intent to the configuration team — they are <strong>not</strong> the live EMR build.
          </p>
          <p style={{ margin: '0 0 10px' }}>
            The actual build delivered in the EMR may have <strong>visual or functional differences</strong> from what you design here, due to platform constraints, governance review, and clinical safety requirements.
          </p>
          <p style={{ margin: 0, color: '#6b7280', fontSize: 12 }}>
            Use these mockups as a starting point for discussion with the PowerForm configuration team.
          </p>
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid #ececef', display: 'flex', justifyContent: 'flex-end', background: '#fafafa' }}>
          <button
            ref={btnRef}
            onClick={onAcknowledge}
            style={{
              padding: '8px 18px', fontSize: 13, fontWeight: 600,
              background: 'rgb(0, 48, 135)', color: '#fff',
              border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >I acknowledge</button>
        </div>
      </div>
    </div>
  );
}
