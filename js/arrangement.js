// Palette de couleurs pour identifier les loops dans la grille
const LOOP_PALETTE = [
  '#e74c3c','#e67e22','#f1c40f','#2ecc71','#3498db',
  '#9b59b6','#e91e63','#1abc9c','#d35400','#2980b9',
  '#8e44ad','#27ae60','#c0392b','#16a085','#f39c12'
];

const Arrangement = (() => {
  let current = null;
  let isPlaying = false;
  let playTimeouts = [];
  let playheadRAF = null;
  let playStartWall = null;
  let pickerCallback = null; // { instId, cellIndex }

  // ─── Création / Chargement ────────────────────────────────────────────────

  function createNew() {
    current = {
      id: null,
      name: '',
      bpm: 100,
      cellSize: 2,    // mesures par case
      totalCells: 8,  // nombre de cases
      grid: {},
      trackVolumes: {}
    };
    INSTRUMENTS.forEach(inst => {
      current.grid[inst.id] = new Array(current.totalCells).fill(null);
      current.trackVolumes[inst.id] = 1.0;
    });
  }

  function load(arr) {
    current = JSON.parse(JSON.stringify(arr));
    if (!current.trackVolumes) current.trackVolumes = {};
    INSTRUMENTS.forEach(inst => {
      if (!current.grid[inst.id]) current.grid[inst.id] = [];
      while (current.grid[inst.id].length < current.totalCells) current.grid[inst.id].push(null);
      if (current.grid[inst.id].length > current.totalCells)
        current.grid[inst.id] = current.grid[inst.id].slice(0, current.totalCells);
      if (current.trackVolumes[inst.id] === undefined) current.trackVolumes[inst.id] = 1.0;
    });
  }

  // ─── Moteur : construction des notes à partir de la grille ───────────────

  // Retourne toutes les notes de l'arrangement avec timestamps absolus (ms)
  // bpmOverride permet de passer un BPM modifié (ex: x0.5 pour apprentissage)
  function buildNotes(bpmOverride, arrangementData) {
    const arr = arrangementData || current;
    const bpm = bpmOverride || arr.bpm;
    const loops = Storage.getRhythms();
    const notes = [];

    INSTRUMENTS.forEach((inst, laneIndex) => {
      const track = arr.grid[inst.id] || [];

      track.forEach((loopId, cellIndex) => {
        if (!loopId) return;
        const loop = loops.find(l => l.id === loopId);
        if (!loop) return;

        // Durées en ms (toujours calculées avec le bpm de l'arrangement)
        const msPerBeat = 60000 / bpm;
        const cellDurationMs = arr.cellSize * 4 * msPerBeat;
        const loopDurationMs = loop.measures * 4 * msPerBeat;
        const stepMs = msPerBeat / (loop.subdivision / 4);
        const cellStartMs = cellIndex * cellDurationMs;

        // Nombre de répétitions du loop pour remplir la case
        const repeats = Math.ceil(cellDurationMs / loopDurationMs);

        for (let r = 0; r < repeats; r++) {
          const repeatOffsetMs = r * loopDurationMs;

          loop.notes.forEach(note => {
            if (note.lane !== laneIndex) return;

            const noteAbsMs = cellStartMs + repeatOffsetMs + note.step * stepMs;
            // Ne pas dépasser la fin de la case
            if (noteAbsMs >= cellStartMs + cellDurationMs) return;

            const trackVol = (arr.trackVolumes && arr.trackVolumes[inst.id] !== undefined)
              ? arr.trackVolumes[inst.id] : 1.0;
            notes.push({
              lane: laneIndex,
              timestamp: noteAbsMs,
              soundIndex: note.soundIndex || 0,
              volume: note.volume || 3,
              trackVolume: trackVol,
              hit: false,
              missed: false,
              active: true,
            });
          });
        }
      });
    });

    notes.sort((a, b) => a.timestamp - b.timestamp);
    return notes;
  }

  function getTotalMs(bpm) {
    const useBpm = bpm || current.bpm;
    return current.cellSize * current.totalCells * 4 * (60000 / useBpm);
  }

  // ─── Rendu ───────────────────────────────────────────────────────────────

  function render() {
    renderToolbar();
    renderGrid();
  }

  function renderToolbar() {
    document.getElementById('arr-name').value = current.name;
    document.getElementById('arr-bpm-slider').value = current.bpm;
    document.getElementById('arr-bpm-display').textContent = current.bpm;
    document.getElementById('arr-cell-size').value = current.cellSize;
    document.getElementById('arr-total-cells').value = current.totalCells;
  }

  function loopColorMap() {
    const loops = Storage.getRhythms();
    const map = {};
    loops.forEach((l, i) => { map[l.id] = LOOP_PALETTE[i % LOOP_PALETTE.length]; });
    return map;
  }

  function renderGrid() {
    const grid = document.getElementById('arr-grid');
    grid.innerHTML = '';

    const loops = Storage.getRhythms();
    const colorMap = loopColorMap();

    // ── Ligne d'en-tête (numéros de mesures) ──
    const headerRow = document.createElement('div');
    headerRow.className = 'arr-row arr-header-row';
    const hLabel = document.createElement('div');
    hLabel.className = 'arr-row-label arr-header-label';
    hLabel.textContent = 'M.';
    headerRow.appendChild(hLabel);

    for (let c = 0; c < current.totalCells; c++) {
      const hCell = document.createElement('div');
      hCell.className = 'arr-header-cell';
      hCell.textContent = c * current.cellSize + 1;
      headerRow.appendChild(hCell);
    }
    grid.appendChild(headerRow);

    // ── Lignes instruments ──
    INSTRUMENTS.forEach((inst, laneIndex) => {
      const row = document.createElement('div');
      row.className = 'arr-row';

      const label = document.createElement('div');
      label.className = 'arr-row-label';
      label.style.borderLeft = `4px solid ${inst.color}`;

      const nameEl = document.createElement('span');
      nameEl.className = 'arr-label-name';
      nameEl.textContent = inst.shortName;
      label.appendChild(nameEl);

      const vol = current.trackVolumes[inst.id] !== undefined ? current.trackVolumes[inst.id] : 1.0;
      const volSlider = document.createElement('input');
      volSlider.type = 'range';
      volSlider.className = 'arr-vol-slider';
      volSlider.min = 0; volSlider.max = 100;
      volSlider.value = Math.round(vol * 100);
      volSlider.title = `Volume ${inst.shortName}`;
      volSlider.addEventListener('input', e => {
        current.trackVolumes[inst.id] = parseInt(e.target.value) / 100;
      });
      volSlider.addEventListener('click', e => e.stopPropagation());
      volSlider.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
      label.appendChild(volSlider);

      row.appendChild(label);

      const track = current.grid[inst.id] || [];

      for (let c = 0; c < current.totalCells; c++) {
        const cell = document.createElement('div');
        cell.className = 'arr-cell';
        cell.dataset.inst = inst.id;
        cell.dataset.col = c;

        const loopId = track[c];
        if (loopId) {
          const loop = loops.find(l => l.id === loopId);
          if (loop) {
            cell.classList.add('arr-cell-filled');
            cell.style.background = colorMap[loopId];
            cell.innerHTML = `<span class="arr-cell-name">${loop.name}</span>
              <span class="arr-cell-meta">${loop.measures}M</span>`;
          }
        }

        // Tap → picker
        let touchMoved = false;
        cell.addEventListener('touchstart', () => { touchMoved = false; }, { passive: true });
        cell.addEventListener('touchmove', () => { touchMoved = true; }, { passive: true });
        cell.addEventListener('touchend', (e) => {
          if (!touchMoved) { e.preventDefault(); openPicker(inst.id, c); }
        });
        cell.addEventListener('click', () => openPicker(inst.id, c));

        row.appendChild(cell);
      }
      grid.appendChild(row);
    });
  }

  // ─── Picker de loop ──────────────────────────────────────────────────────

  function openPicker(instId, cellIndex) {
    pickerCallback = { instId, cellIndex };
    const loops = Storage.getRhythms();
    const list = document.getElementById('arr-picker-list');
    const inst = INSTRUMENTS.find(i => i.id === instId);
    const colorMap = loopColorMap();

    document.getElementById('arr-picker-title').textContent = `Loop pour ${inst ? inst.name : instId}`;
    list.innerHTML = '';

    // Silence
    const silenceBtn = document.createElement('button');
    silenceBtn.className = 'picker-item picker-silence';
    silenceBtn.textContent = '🔇 Silence';
    silenceBtn.addEventListener('click', () => { applyPick(null); });
    list.appendChild(silenceBtn);

    if (loops.length === 0) {
      const msg = document.createElement('p');
      msg.className = 'picker-empty';
      msg.textContent = 'Aucun loop — crée-en un dans l\'éditeur ✏️';
      list.appendChild(msg);
    } else {
      loops.forEach(loop => {
        const btn = document.createElement('button');
        btn.className = 'picker-item';
        btn.style.borderLeft = `5px solid ${colorMap[loop.id]}`;
        btn.innerHTML = `<strong>${loop.name}</strong><span>${loop.bpm} BPM · ${loop.measures} mes.</span>`;
        btn.addEventListener('click', () => applyPick(loop.id));
        list.appendChild(btn);
      });
    }

    document.getElementById('arr-loop-picker').classList.remove('hidden');
  }

  function applyPick(loopId) {
    if (pickerCallback) {
      const { instId, cellIndex } = pickerCallback;
      if (!current.grid[instId]) current.grid[instId] = new Array(current.totalCells).fill(null);
      current.grid[instId][cellIndex] = loopId;
      pickerCallback = null;
    }
    closePicker();
    renderGrid();
  }

  function closePicker() {
    document.getElementById('arr-loop-picker').classList.add('hidden');
  }

  // ─── Prévisualisation audio ───────────────────────────────────────────────

  function startPreview() {
    if (isPlaying) { stopPreview(); return; }
    Audio.resume();
    isPlaying = true;
    document.getElementById('btn-arr-play').textContent = '⏹ Stop';

    const notes = buildNotes();
    const ac = Audio.getCtx();
    const acStart = ac.currentTime + 0.1;
    playStartWall = performance.now() + 100;

    notes.forEach(note => {
      const vol = (note.volume / 3) * (note.trackVolume !== undefined ? note.trackVolume : 1.0);
      Audio.playSound(INSTRUMENTS[note.lane].id, note.soundIndex, acStart + note.timestamp / 1000, vol);
    });

    const totalMs = getTotalMs();
    playTimeouts.push(setTimeout(stopPreview, totalMs + 300));

    // Playhead
    function animPlayhead() {
      const elapsed = performance.now() - playStartWall;
      const pct = Math.min(1, elapsed / totalMs) * 100;
      const ph = document.getElementById('arr-playhead');
      if (ph) ph.style.left = pct + '%';
      if (elapsed < totalMs) playheadRAF = requestAnimationFrame(animPlayhead);
    }
    playheadRAF = requestAnimationFrame(animPlayhead);
  }

  function stopPreview() {
    isPlaying = false;
    playTimeouts.forEach(clearTimeout);
    playTimeouts = [];
    if (playheadRAF) { cancelAnimationFrame(playheadRAF); playheadRAF = null; }
    const ph = document.getElementById('arr-playhead');
    if (ph) ph.style.left = '0%';
    const btn = document.getElementById('btn-arr-play');
    if (btn) btn.textContent = '▶ Écouter';
  }

  // ─── Sauvegarde ──────────────────────────────────────────────────────────

  function save() {
    const name = document.getElementById('arr-name').value.trim();
    if (!name) { alert('Donne un nom à l\'arrangement !'); return; }
    current.name = name;
    current.bpm = parseInt(document.getElementById('arr-bpm-slider').value);
    current.cellSize = parseInt(document.getElementById('arr-cell-size').value);
    current.totalCells = parseInt(document.getElementById('arr-total-cells').value);
    Storage.saveArrangement(current);
    stopPreview();
    App.showHome();
  }

  // ─── Événements ──────────────────────────────────────────────────────────

  function initEvents() {
    document.getElementById('arr-bpm-slider').addEventListener('input', e => {
      current.bpm = parseInt(e.target.value);
      document.getElementById('arr-bpm-display').textContent = e.target.value;
    });

    document.getElementById('arr-cell-size').addEventListener('change', e => {
      current.cellSize = parseInt(e.target.value);
    });

    document.getElementById('arr-total-cells').addEventListener('change', e => {
      const newTotal = parseInt(e.target.value);
      current.totalCells = newTotal;
      INSTRUMENTS.forEach(inst => {
        if (!current.grid[inst.id]) current.grid[inst.id] = [];
        while (current.grid[inst.id].length < newTotal) current.grid[inst.id].push(null);
        if (current.grid[inst.id].length > newTotal)
          current.grid[inst.id] = current.grid[inst.id].slice(0, newTotal);
      });
      renderGrid();
    });

    document.getElementById('btn-arr-play').addEventListener('click', startPreview);
    document.getElementById('btn-arr-save').addEventListener('click', save);

    document.getElementById('btn-arr-close-picker').addEventListener('click', closePicker);
    document.getElementById('arr-picker-overlay').addEventListener('click', closePicker);
  }

  return {
    createNew, load, render, initEvents, stopPreview,
    buildNotes, getTotalMs,
    get current() { return current; }
  };
})();
