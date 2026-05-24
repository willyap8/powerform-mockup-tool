// ---------------------------------------------------------------------------
// app.jsx — Top-level state, history, drag/snap, layout chrome.
// ---------------------------------------------------------------------------
const { useState, useEffect, useRef, useMemo, useCallback } = React;

const MAX_HISTORY = 50;
const SNAP_THRESHOLD = 6;

function App() {
  // Tweaks (grid snap)
  const [tweaks, setTweak] = useTweaks(/*EDITMODE-BEGIN*/{
    "gridSnap": "off"
  }/*EDITMODE-END*/);
  const gridStep = tweaks.gridSnap === '5px' ? 5 : tweaks.gridSnap === '10px' ? 10 : 0;

  // Form & history — share a single initial form so the first history snapshot
  // has the same IDs as the live form.
  const initialFormRef = useRef(null);
  if (initialFormRef.current === null) initialFormRef.current = buildDemoForm();
  const [form, setForm] = useState(() => initialFormRef.current);
  const [history, setHistory] = useState(() => [
    { form: cloneForm(initialFormRef.current), description: 'Initial demo form loaded', ts: Date.now() }
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [previewIndex, setPreviewIndex] = useState(null);
  const [showJson, setShowJson] = useState(false);
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [showStyleGuide, setShowStyleGuide] = useState(false);

  // View toggles
  const [showGuides, setShowGuides] = useState(true);
  const [showGrid, setShowGrid]     = useState(false);

  // Pane visibility
  const [showElementsPane, setShowElementsPane] = useState(true);
  const [showHistoryPane,  setShowHistoryPane]  = useState(false);
  const [showNotesPane,    setShowNotesPane]    = useState(false);

  // Notes — separate from form/history (notes are documentation, not design).
  // Persisted alongside the form via Save/Open; never enters undo history.
  const [notes, setNotes] = useState('');
  const notesRef = useRef('');
  useEffect(() => { notesRef.current = notes; }, [notes]);

  // Selection & editing
  const [selectedIds, setSelectedIds] = useState([]);
  const [editLayoutOn, setEditLayoutOn] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [fieldValues, setFieldValues] = useState({});
  const [contextMenu, setContextMenu] = useState(null);

  // Disclaimer (shown every page load — not persisted)
  const [disclaimerOpen, setDisclaimerOpen] = useState(true);

  // Save/Open state
  const [saveSlotOpen, setSaveSlotOpen] = useState(false);
  const [openSlotOpen, setOpenSlotOpen] = useState(false);
  // Pending action queued behind unsaved-changes confirm
  const [pendingDestructive, setPendingDestructive] = useState(null);
  // Dirty tracking: snapshot the form payload at the last save/load and
  // compare on every form change. (Stable JSON keeps the comparison cheap.)
  const lastSavedRef = useRef(null);
  // Last save filename (for hint in download default)
  const [lastSaveName, setLastSaveName] = useState('');

  // Autosave state — current slot name (persisted across reloads) + last
  // timestamp written. Restore offer surfaces once disclaimer is dismissed
  // if an autosaved slot diverges from the freshly-loaded form.
  const [currentSlot, setCurrentSlot] = useState(() => getCurrentSlotName());
  const [autosaveAt, setAutosaveAt]   = useState(() => {
    const n = getCurrentSlotName();
    const s = n ? getSlot(n) : null;
    return s && s.savedAt ? s.savedAt : null;
  });
  const [restoreOffer, setRestoreOffer] = useState(null);

  // Drag state — kept in a ref so the live mousemove handler doesn't re-bind
  const [dragGuides, setDragGuides] = useState([]);
  const dragRef = useRef(null);

  // Are we in preview mode?
  const isPreviewing = previewIndex !== null;
  const effectiveForm = isPreviewing && history[previewIndex] ? history[previewIndex].form : form;
  const placementDisabled = isPreviewing;
  const editingDisabled = isPreviewing;

  // -------------------------------------------------------------------------
  // History commit
  // -------------------------------------------------------------------------
  // formRef mirrors `form` for callbacks that need the latest snapshot without
  // re-binding on every form change.
  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);

  const commit = useCallback((newForm, description) => {
    setForm(newForm);
    setHistory((prev) => {
      // Truncate forward of current pointer (standard undo)
      let truncated = prev.slice(0, historyIndex + 1);
      truncated.push({ form: cloneForm(newForm), description, ts: Date.now() });
      if (truncated.length > MAX_HISTORY) {
        truncated = truncated.slice(truncated.length - MAX_HISTORY);
      }
      // historyIndex update will be the new last position
      setHistoryIndex(truncated.length - 1);
      return truncated;
    });
  }, [historyIndex]);

  // Snapshot the *current* form state into a single history entry. Used by
  // deferred inputs (commit on blur) where the form was already updated live.
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

  // Quick-update without commit (used during drag/text typing edits we don't want to spam)
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
    // Ignore clicks that originated on a block
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
    // Empty background click in Edit Layout → deselect
    if (editLayoutOn) setSelectedIds([]);
  };

  const placeNewBlock = (toolKey, x, y) => {
    const newBlock = makeBlockFromTool(toolKey, x, y);
    if (!newBlock) return;
    const newForm = { ...form, blocks: [...form.blocks, newBlock] };
    const desc = (() => {
      if (newBlock.type === 'field')      return "Added " + newBlock.fieldType + " field '" + newBlock.label + "'";
      if (newBlock.type === 'text')       return "Added text '" + newBlock.text.slice(0, 24) + "'";
      return "Added " + newBlock.type.replace(/([A-Z])/g, ' $1').toLowerCase().trim() + " '" + (newBlock.label || '').trim() + "'";
    })();
    commit(newForm, desc);
    if (editLayoutOn) setSelectedIds([newBlock.id]);
  };

  function makeBlockFromTool(toolKey, x, y) {
    if (toolKey.startsWith('field:')) {
      const ft = toolKey.split(':')[1];
      const d = FIELD_DEFAULTS[ft];
      // Checkbox / radio groups have no field label above them, so they
      // don't need the FIELD_LABEL_HEIGHT margin at the top.
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
      const placeholder = variant === 'label' ? 'New label' :
        variant === 'general' ? 'General text' :
        variant === 'instructionalBold' ? 'Instructional text (bold italic).' :
        'Instructional text (italic).';
      return { id: uid('t'), type: 'text', variant, text: placeholder, x, y, width: 360 };
    }
    if (toolKey === 'sticky') {
      return {
        id: uid('s'), type: 'sticky', text: '',
        x, y,
        width: STICKY_DEFAULTS.width, height: STICKY_DEFAULTS.height,
      };
    }
    if (toolKey === 'heading1' || toolKey === 'heading2' || toolKey === 'subSection' || toolKey === 'formHeading') {
      // Headings always snap to x:5 on drop (spec)
      return { id: uid('h'), type: toolKey, label: HEADING_DEFAULT_LABELS[toolKey] || ' Heading', x: 5, y };
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Selection / click handling on a block
  // -------------------------------------------------------------------------
  const onBlockClick = (e, block) => {
    if (placementDisabled) return;
    if (activeTool) return; // The canvas click handler does the placement
    if (!editLayoutOn) return;
    // selection handled in mousedown; click is just to prevent bubble to canvas click
    e.stopPropagation();
  };

  // -------------------------------------------------------------------------
  // Drag (mousedown on block) — selects, then drags any selected block
  // -------------------------------------------------------------------------
  const onBlockMouseDown = (e, block) => {
    if (placementDisabled || activeTool) return;
    if (editingId === block.id) return; // editing input, let it handle
    if (!editLayoutOn) return;
    if (e.button !== 0) return;

    // Selection update
    let newSelection;
    if (e.shiftKey) {
      if (selectedIds.includes(block.id)) newSelection = selectedIds.filter((id) => id !== block.id);
      else newSelection = [...selectedIds, block.id];
    } else {
      newSelection = selectedIds.includes(block.id) ? selectedIds : [block.id];
    }
    setSelectedIds(newSelection);

    // Begin drag
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
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

      // Compute proposed positions
      let proposed = {};
      Object.keys(d.blockStartPositions).forEach((id) => {
        const start = d.blockStartPositions[id];
        let nx = start.x + dx;
        let ny = start.y + dy;
        // Heading bars are always x:5
        const blk = form.blocks.find((b) => b.id === id);
        if (blk && isHeadingType(blk.type)) nx = 5;
        // Constrain to non-negative
        nx = Math.max(0, nx);
        ny = Math.max(blk && blk.type === 'field' ? FIELD_LABEL_HEIGHT : 0, ny);
        proposed[id] = { x: nx, y: ny };
      });

      // Grid snap
      if (gridStep) {
        Object.keys(proposed).forEach((id) => {
          const blk = form.blocks.find((b) => b.id === id);
          if (blk && isHeadingType(blk.type)) return;
          proposed[id].x = Math.round(proposed[id].x / gridStep) * gridStep;
          proposed[id].y = Math.round(proposed[id].y / gridStep) * gridStep;
        });
      }

      // Alignment snap — find best snap delta against non-selected blocks
      const guides = [];
      const others = form.blocks.filter((b) => !d.selection.includes(b.id));
      // Build candidate edges from others
      const otherVerts = []; // {edge, value, rect}
      const otherHorz = [];
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
        const edgesV = [r.x, r.x + r.w / 2, r.x + r.w];
        const edgesH = [r.y, r.y + r.h / 2, r.y + r.h];
        edgesV.forEach((ev) => {
          otherVerts.forEach((ov) => {
            const diff = ov.value - ev;
            if (Math.abs(diff) <= SNAP_THRESHOLD && Math.abs(diff) < bestDxAbs) {
              bestDx = diff;
              bestDxAbs = Math.abs(diff);
              bestVertGuide = ov.value;
            }
          });
        });
        edgesH.forEach((eh) => {
          otherHorz.forEach((oh) => {
            const diff = oh.value - eh;
            if (Math.abs(diff) <= SNAP_THRESHOLD && Math.abs(diff) < bestDyAbs) {
              bestDy = diff;
              bestDyAbs = Math.abs(diff);
              bestHorzGuide = oh.value;
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
      // Apply
      updateBlocks((blocks) => blocks.map((b) => (
        proposed[b.id] ? { ...b, x: proposed[b.id].x, y: proposed[b.id].y } : b
      )));
    };
    const onUp = () => {
      const d = dragRef.current;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setDragGuides([]);
      dragRef.current = null;
      if (d && d.moved) {
        // Commit history entry
        const ids = d.selection;
        let desc;
        if (ids.length === 1) {
          const b = form.blocks.find((x) => x.id === ids[0]);
          desc = "Moved " + (b ? describeBlock(b) : 'block');
        } else {
          desc = "Moved " + ids.length + ' blocks';
        }
        // Push history using the *current* form state at next tick
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

  // Compute dirty: stringify the saveable payload and compare with the
  // snapshot taken at last save / load / fresh-load. Cheap enough at form
  // sizes we expect; updates on every form mutation or notes commit.
  const currentSaved = useMemo(
    () => JSON.stringify({
      blocks: serializeDesign(form, notes).blocks,
      notes,
    }),
    [form, notes]
  );
  const dirty = lastSavedRef.current !== null && lastSavedRef.current !== currentSaved;
  // Initialize the snapshot once after first render
  useEffect(() => {
    if (lastSavedRef.current === null) lastSavedRef.current = currentSaved;
    // eslint-disable-next-line
  }, []);

  // ---------------------------------------------------------------------
  // Autosave — debounced 2s after the last form change. Writes to the
  // currently selected slot (set when the user does "Save to browser…").
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!currentSlot) return;
    if (disclaimerOpen) return; // don't autosave behind the disclaimer
    if (isPreviewing) return;   // don't autosave a preview snapshot
    const timer = setTimeout(() => {
      // Check the slot still exists (user may have deleted it).
      const slots = loadSlots();
      if (!slots[currentSlot]) {
        // Slot deleted externally — drop the pointer.
        setCurrentSlot(null);
        setCurrentSlotName(null);
        setAutosaveAt(null);
        return;
      }
      const ok = saveToSlot(currentSlot, formRef.current, notesRef.current);
      if (ok) {
        const s = getSlot(currentSlot);
        setAutosaveAt(s && s.savedAt ? s.savedAt : new Date().toISOString());
      }
    }, 2000);
    return () => clearTimeout(timer);
    // formRef changes whenever form changes; track currentSaved as the signal.
    // eslint-disable-next-line
  }, [currentSaved, currentSlot, disclaimerOpen, isPreviewing]);

  // ---------------------------------------------------------------------
  // Restore offer — once on mount, after disclaimer dismissal, check if the
  // current slot has content that differs from the freshly-loaded demo form.
  // If so, surface a non-blocking modal offering to restore it.
  // ---------------------------------------------------------------------
  const restoreCheckedRef = useRef(false);
  useEffect(() => {
    if (disclaimerOpen) return;
    if (restoreCheckedRef.current) return;
    restoreCheckedRef.current = true;
    if (!currentSlot) return;
    const slot = getSlot(currentSlot);
    if (!slot || !Array.isArray(slot.blocks)) return;
    const slotBlocksStr = JSON.stringify(slot.blocks);
    if (slotBlocksStr === currentSaved) return; // already matches the demo form
    setRestoreOffer({ slotName: currentSlot, savedAt: slot.savedAt, slot });
    // eslint-disable-next-line
  }, [disclaimerOpen]);

  // ---------------------------------------------------------------------
  // Save / Open handlers
  // ---------------------------------------------------------------------
  const markSaved = () => {
    lastSavedRef.current = JSON.stringify({
      blocks: serializeDesign(formRef.current, notesRef.current).blocks,
      notes: notesRef.current,
    });
  };

  const handleSaveFile = () => {
    downloadDesignFile(formRef.current, lastSaveName, notesRef.current);
    markSaved();
  };

  const loadDesign = (design, sourceName) => {
    const newForm = { title: design.title || formRef.current.title, blocks: design.blocks };
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
    // Reset dirty baseline
    setTimeout(() => {
      lastSavedRef.current = JSON.stringify({
        blocks: serializeDesign(newForm, newNotes).blocks,
        notes: newNotes,
      });
    }, 0);
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

  const handleSaveSlot = () => setSaveSlotOpen(true);
  const handleOpenSlot = () => setOpenSlotOpen(true);
  const handlePickSlot = (name, payload) => {
    try {
      const design = deserializeDesign(payload);
      loadDesign(design, name);
      setOpenSlotOpen(false);
    } catch (e) {
      alert('Could not load slot:\n\n' + (e.message || String(e)));
    }
  };
  const onResizeStart = (block, e) => {
    if (!editLayoutOn || isPreviewing) return;
    const startX = e.clientX, startY = e.clientY;
    const startW = block.width || 220;
    const startH = block.height || 22;
    const MIN_W = 80, MIN_H = 22;
    const onMove = (ev) => {
      let nw = Math.max(MIN_W, startW + (ev.clientX - startX));
      let nh = Math.max(MIN_H, startH + (ev.clientY - startY));
      if (gridStep) {
        nw = Math.round(nw / gridStep) * gridStep;
        nh = Math.round(nh / gridStep) * gridStep;
      }
      updateBlock(block.id, { width: nw, height: nh });
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
      desc = "Edited text → '" + newValue.slice(0, 24) + "'";
    } else if (isHeadingType(block.type)) {
      // Spec: heading labels start with a space — preserve if user didn't add one
      let v = newValue;
      if (v && v[0] !== ' ') v = ' ' + v;
      patch = { label: v };
      desc = "Edited heading → '" + v.trim() + "'";
    } else if (block.type === 'field') {
      patch = { label: newValue };
      desc = "Edited field label → '" + newValue.trim() + "'";
    } else if (block.type === 'sticky') {
      patch = { text: newValue };
      desc = "Edited sticky note → '" + (newValue || '').slice(0, 24).trim() + "'";
    }
    if (patch) {
      const newForm = { ...form, blocks: form.blocks.map((b) => b.id === block.id ? { ...b, ...patch } : b) };
      commit(newForm, desc);
    }
  };
  const cancelInlineEdit = () => setEditingId(null);

  // Special: editing the form title (in the form-heading bar). Use the formHeading block.

  // -------------------------------------------------------------------------
  // Delete / duplicate / context menu
  // -------------------------------------------------------------------------
  const deleteSelected = () => {
    if (!selectedIds.length || isPreviewing) return;
    const targets = form.blocks.filter((b) => selectedIds.includes(b.id));
    const desc = targets.length === 1
      ? "Deleted " + describeBlock(targets[0])
      : "Deleted " + targets.length + ' blocks';
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
    if (action === 'edit') startInlineEdit(block);
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
  // Keyboard
  // -------------------------------------------------------------------------
  useEffect(() => {
    const onKey = (e) => {
      // Don't hijack typing
      const tag = (e.target.tagName || '').toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
      if (isTyping) {
        if (e.key === 'Escape' && activeTool) setActiveTool(null);
        return;
      }
      if (e.key === 'Escape') {
        if (activeTool) { setActiveTool(null); return; }
        if (editingId) { setEditingId(null); return; }
        if (contextMenu) { setContextMenu(null); return; }
        if (isPreviewing) { setPreviewIndex(null); return; }
      }
      // Cmd/Ctrl+S = save to file
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && !e.shiftKey) {
        e.preventDefault();
        if (!isPreviewing) handleSaveFile();
        return;
      }
      // Cmd/Ctrl+Z = undo
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
      // Delete
      if ((e.key === 'Delete' || e.key === 'Backspace') && editLayoutOn && !isPreviewing) {
        if (selectedIds.length) { e.preventDefault(); deleteSelected(); }
        return;
      }
      // Arrow nudge
      if (editLayoutOn && !isPreviewing && selectedIds.length && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        const newForm = { ...form, blocks: form.blocks.map((b) => {
          if (!selectedIds.includes(b.id)) return b;
          if (isHeadingType(b.type)) return { ...b, y: Math.max(0, b.y + dy) };
          return { ...b, x: Math.max(0, b.x + dx), y: Math.max(FIELD_LABEL_HEIGHT, b.y + dy) };
        }) };
        commit(newForm, "Nudged " + (selectedIds.length === 1 ? describeBlock(form.blocks.find((b) => b.id === selectedIds[0])) : selectedIds.length + ' blocks'));
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
    const newHistory = history.slice(0, i + 1);
    setHistory(newHistory);
    setHistoryIndex(i);
    setForm(cloneForm(target.form));
    setPreviewIndex(null);
  };
  const onCancelPreview = () => setPreviewIndex(null);

  // Reset all
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
      setTimeout(() => {
        lastSavedRef.current = JSON.stringify({
          blocks: serializeDesign(fresh, '').blocks,
          notes: '',
        });
      }, 0);
    };
    if (dirty) {
      setPendingDestructive({ message: 'Reset all will discard your unsaved changes and reload the demo form.', confirmLabel: 'Discard and reset', run: doReset });
    } else {
      if (!confirm('Reset form and clear all history?')) return;
      doReset();
    }
  };

  // JSON — form blocks (sans sticky) plus a separate array for sticky notes,
  // plus the freeform docs `notes` field saved with the form.
  const exportForm = useMemo(() => {
    const formBlocks = [];
    const stickyNotes = [];
    effectiveForm.blocks.forEach((b) => {
      if (b.type === 'sticky') {
        stickyNotes.push({
          x: b.x, y: b.y,
          width: b.width || STICKY_DEFAULTS.width,
          height: b.height || STICKY_DEFAULTS.height,
          text: b.text || '',
        });
      } else {
        const out = { ...b };
        delete out.id;
        formBlocks.push(out);
      }
    });
    return {
      title: effectiveForm.title,
      blocks: formBlocks,
      configurationNotes: stickyNotes,
      notes: notes,
    };
  }, [effectiveForm, notes]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const selectedBlock = selectedIds.length === 1
    ? effectiveForm.blocks.find((b) => b.id === selectedIds[0])
    : null;

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
        height: 48,
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 16,
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 6,
            background: 'linear-gradient(135deg, rgb(0, 48, 135), #4060d0)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', font: 'bold 11px Verdana, sans-serif',
          }}>PF</div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            PowerForm Mockup Tool{dirty && <span title="Unsaved changes" style={{ marginLeft: 6, color: '#dc2626', fontSize: 16, fontWeight: 700 }}>•</span>}
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
          showGrid={showGrid} setShowGrid={setShowGrid}
          showElements={showElementsPane} setShowElements={setShowElementsPane}
          showHistory={showHistoryPane} setShowHistory={setShowHistoryPane}
          showNotes={showNotesPane} setShowNotes={setShowNotesPane}
          onShowDisclaimer={() => setDisclaimerOpen(true)}
          onShowStyleGuide={() => setShowStyleGuide(true)}
          isPreviewing={isPreviewing}
        />
        <AutosaveIndicator
          slotName={currentSlot}
          lastSavedAt={autosaveAt}
          onClickSave={handleSaveSlot}
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
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
          {editLayoutOn ? '✎ Edit Layout: ON' : 'Edit Layout: OFF'}
        </button>
      </div>

      {/* Banner */}
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
        <NotesPane
          committed={notes}
          onSave={(draft) => setNotes(draft)}
          onClose={() => setShowNotesPane(false)}
        />
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

      {showPrintOptions && (
        <PrintOptionsDialog form={effectiveForm} onClose={() => setShowPrintOptions(false)} />
      )}

      {showStyleGuide && <StyleGuideModal onClose={() => setShowStyleGuide(false)} />}

      {saveSlotOpen && (
        <SaveSlotModal
          form={formRef.current}
          notes={notesRef.current}
          onClose={() => setSaveSlotOpen(false)}
          onSaved={(name) => {
            markSaved();
            setLastSaveName(name);
            setSaveSlotOpen(false);
            // From now on, autosave writes to this slot.
            setCurrentSlot(name);
            setCurrentSlotName(name);
            const s = getSlot(name);
            setAutosaveAt(s && s.savedAt ? s.savedAt : new Date().toISOString());
          }}
        />
      )}

      {restoreOffer && (
        <ConfirmDiscardModal
          message={(
            <span>
              Found autosaved work in slot <strong>{restoreOffer.slotName}</strong>
              {restoreOffer.savedAt && <> · last saved {relativeTime(restoreOffer.savedAt)}</>}.
              Restore it instead of the demo form?
            </span>
          )}
          confirmLabel="Restore"
          onCancel={() => setRestoreOffer(null)}
          onConfirm={() => {
            const slot = restoreOffer.slot;
            setRestoreOffer(null);
            try {
              const design = deserializeDesign(slot);
              loadDesign(design, restoreOffer.slotName);
              // Keep autosave bound to this slot (already set).
              setAutosaveAt(slot.savedAt || new Date().toISOString());
            } catch (e) {
              alert('Could not restore: ' + (e.message || String(e)));
            }
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
          onConfirm={() => {
            const run = pendingDestructive.run;
            setPendingDestructive(null);
            run && run();
          }}
        />
      )}

      {disclaimerOpen && <DisclaimerModal onAcknowledge={() => setDisclaimerOpen(false)} />}

      {/* Tweaks */}
      <TweaksPanel title="Tweaks" defaultOpen={false}>
        <TweakSection title="Layout">
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

const topBtn = {
  padding: '6px 12px', fontSize: 12, fontWeight: 500,
  background: '#fff', color: '#374151',
  border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
};

function toolName(key) {
  if (key.startsWith('field:')) return 'Placing ' + key.split(':')[1] + ' field';
  if (key.startsWith('text:'))  return 'Placing text';
  return 'Placing ' + key.replace(/([A-Z])/g, ' $1').toLowerCase();
}

function cloneForm(form) {
  return {
    title: form.title,
    blocks: form.blocks.map((b) => ({ ...b, options: b.options ? [...b.options] : undefined })),
  };
}

// ---------------------------------------------------------------------------
// FormCanvas — the scrollable form area
// ---------------------------------------------------------------------------
function FormCanvas(props) {
  const {
    form, editLayoutOn, selectedIds, editingId, activeTool, gridStep,
    showGuides, showGrid,
    fieldValues, setFieldValue, guides,
    onCanvasClick, onBlockMouseDown, onBlockClick, onBlockContextMenu,
    onDoubleClickLabel, onCommitLabel, onCancelLabel, onResizeStart, onStickyAutoGrow,
  } = props;

  // Effective grid line step — View > Show grid uses 10px when on; the
  // grid-snap Tweak may also show its own snap step. Pick the smaller of
  // whichever is active so the lines aren't fighting each other.
  const visualGridStep = (showGrid ? 10 : 0);
  const lineGridStep = (gridStep && visualGridStep)
    ? Math.min(gridStep, visualGridStep)
    : (gridStep || visualGridStep);

  // Compute canvas height from content (+padding)
  const maxBottom = form.blocks.reduce((m, b) => {
    const r = getBlockRect(b);
    return Math.max(m, r.y + r.h);
  }, 0);
  const canvasH = Math.max(maxBottom + 80, 700);
  const canvasW = 1000;

  return (
    <div style={{ minWidth: canvasW + 80, padding: '24px 40px 60px' }}>
      <div style={{
        position: 'relative',
        width: canvasW,
        minHeight: canvasH,
        background: '#fff',
        boxShadow: '0 2px 14px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.04)',
        borderRadius: 4,
        cursor: activeTool ? 'crosshair' : 'default',
        margin: '0 auto',
      }}
      onClick={onCanvasClick}
      >
        {/* Grid overlay — driven by View > Show grid or by active grid-snap */}
        {lineGridStep > 0 && (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage:
              'linear-gradient(to right, rgba(15,23,42,0.05) 1px, transparent 1px),' +
              'linear-gradient(to bottom, rgba(15,23,42,0.05) 1px, transparent 1px)',
            backgroundSize: lineGridStep + 'px ' + lineGridStep + 'px',
          }} />
        )}

        {/* Blocks */}
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

        {/* Alignment guides (pink). Toggle via View > Show guidelines. */}
        {showGuides && guides.map((g, i) => (
          g.kind === 'v' ? (
            <div key={i} style={{
              position: 'absolute', top: 0, bottom: 0, left: g.value,
              width: 1, background: GUIDE_PINK, pointerEvents: 'none', zIndex: 20,
            }} />
          ) : (
            <div key={i} style={{
              position: 'absolute', left: 0, right: 0, top: g.value,
              height: 1, background: GUIDE_PINK, pointerEvents: 'none', zIndex: 20,
            }} />
          )
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Disclaimer — shown on every page load. Single 'I acknowledge' to dismiss.
// ---------------------------------------------------------------------------
function DisclaimerModal({ onAcknowledge }) {
  // Trap focus on the button so Enter / Space dismisses too.
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
        background: '#ffffff',
        borderRadius: 12,
        boxShadow: '0 24px 64px rgba(15, 23, 42, 0.35)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid #ececef',
          background: 'linear-gradient(180deg, rgba(0,48,135,0.04), transparent)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: '#fef3c7', color: '#92400e',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>⚠</div>
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
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid #ececef',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          background: '#fafafa',
        }}>
          <button
            ref={btnRef}
            onClick={onAcknowledge}
            style={{
              padding: '8px 18px',
              fontSize: 13, fontWeight: 600,
              background: 'rgb(0, 48, 135)', color: '#fff',
              border: 'none', borderRadius: 6, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            I acknowledge
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
