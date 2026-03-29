const VOL_ALPHA = { 3: 1.0, 2: 0.6, 1: 0.3 };

function editorHexRgba(hex, a) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

const Editor = (() => {
  let rhythm = null;
  let isPlaying = false;
  let playInterval = null;
  let playStep = 0;

  function createNew() {
    rhythm = { id: null, name: '', bpm: 100, measures: 2, subdivision: 16, notes: [], trackVolumes: {} };
    INSTRUMENTS.forEach(inst => { rhythm.trackVolumes[inst.id] = 1.0; });
  }

  function load(r) {
    rhythm = JSON.parse(JSON.stringify(r));
    if (!rhythm.trackVolumes) rhythm.trackVolumes = {};
    INSTRUMENTS.forEach(inst => {
      if (rhythm.trackVolumes[inst.id] === undefined) rhythm.trackVolumes[inst.id] = 1.0;
    });
  }

  function getTotalSteps() {
    return rhythm.measures * rhythm.subdivision;
  }

  function getStepsPerBeat() {
    return rhythm.subdivision / 4;
  }

  function render() {
    renderGrid();
    updateToolbar();
  }

  function updateToolbar() {
    document.getElementById('rhythm-name').value = rhythm.name;
    document.getElementById('bpm-slider').value = rhythm.bpm;
    document.getElementById('bpm-display').textContent = rhythm.bpm;
    document.getElementById('measures-select').value = rhythm.measures;
    document.getElementById('subdivision-select').value = rhythm.subdivision;
  }

  function renderGrid() {
    const container = document.getElementById('editor-grid');
    container.innerHTML = '';

    const totalSteps = getTotalSteps();
    const spb = getStepsPerBeat(); // steps per beat

    // Largeur de cellule selon densité
    const cellW = spb >= 8 ? 24 : spb >= 4 ? 30 : 36;
    container.style.setProperty('--cell-w', cellW + 'px');

    // Beat markers row
    const markerRow = document.createElement('div');
    markerRow.className = 'editor-beat-row';
    const spacer = document.createElement('div');
    spacer.className = 'editor-row-label editor-label-spacer';
    markerRow.appendChild(spacer);
    for (let s = 0; s < totalSteps; s++) {
      const m = document.createElement('div');
      m.className = 'editor-beat-marker';
      if (s % rhythm.subdivision === 0) {
        m.classList.add('marker-measure');
        m.textContent = `M${s / rhythm.subdivision + 1}`;
      } else if (s % spb === 0) {
        m.textContent = (s / spb % 4) + 1;
      } else if (spb >= 4 && s % (spb / 2) === 0) {
        // binary: demi-temps | ternaire sextolet: séparateur de triolet
        m.textContent = spb === 6 ? '·' : '+';
      } else if (spb >= 8 && s % (spb / 4) === 0) {
        // 32ème : quart de temps
        m.textContent = '·';
      }
      markerRow.appendChild(m);
    }
    container.appendChild(markerRow);

    // Instrument rows — ordonnées par groupe pour garder D et G côte à côte
    INSTRUMENT_GROUPS.forEach(group => {
      group.lanes.forEach(laneIndex => {
      const inst = INSTRUMENTS[laneIndex];
      const row = document.createElement('div');
      row.className = 'editor-row';

      const label = document.createElement('div');
      label.className = 'editor-row-label';
      label.style.borderLeft = `4px solid ${inst.color}`;

      const nameEl = document.createElement('span');
      nameEl.className = 'arr-label-name';
      nameEl.textContent = inst.shortName;
      label.appendChild(nameEl);

      const vol = rhythm.trackVolumes && rhythm.trackVolumes[inst.id] !== undefined ? rhythm.trackVolumes[inst.id] : 1.0;
      const volSlider = document.createElement('input');
      volSlider.type = 'range';
      volSlider.className = 'arr-vol-slider';
      volSlider.min = 0; volSlider.max = 100;
      volSlider.value = Math.round(vol * 100);
      volSlider.title = `Volume ${inst.shortName}`;
      volSlider.addEventListener('input', e => {
        if (!rhythm.trackVolumes) rhythm.trackVolumes = {};
        rhythm.trackVolumes[inst.id] = parseInt(e.target.value) / 100;
      });
      volSlider.addEventListener('click', e => e.stopPropagation());
      volSlider.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
      label.appendChild(volSlider);

      row.appendChild(label);

      for (let s = 0; s < totalSteps; s++) {
        const cell = document.createElement('div');
        cell.className = 'editor-cell';

        if (s % rhythm.subdivision === 0) {
          cell.classList.add('cell-measure');
        } else if (s % spb === 0) {
          cell.classList.add('cell-beat');
        } else if (spb >= 4 && s % (spb / 2) === 0) {
          // 16ème demi-temps / sextolet séparateur triolet / 32ème demi-temps
          cell.classList.add('cell-half');
        } else if (spb >= 8 && s % (spb / 4) === 0) {
          // 32ème : quart de temps
          cell.classList.add('cell-quarter');
        }

        const note = rhythm.notes.find(n => n.lane === laneIndex && n.step === s);
        setCellVolume(cell, inst, note || null);

        const handler = (e) => {
          e.preventDefault();
          toggleCell(cell, laneIndex, s, inst);
        };
        cell.addEventListener('touchstart', handler, { passive: false });
        cell.addEventListener('mousedown', handler);
        row.appendChild(cell);
      }
      container.appendChild(row);
      }); // fin group.lanes.forEach
    }); // fin INSTRUMENT_GROUPS.forEach
  }

  function setCellVolume(cell, inst, note) {
    if (!note) {
      cell.style.background = '';
      cell.dataset.active = '0';
      cell.dataset.vol = '0';
      return;
    }
    const v = note.volume || 3;
    cell.style.background = editorHexRgba(inst.color, VOL_ALPHA[v]);
    cell.dataset.active = '1';
    cell.dataset.si = note.soundIndex || 0;
    cell.dataset.vol = v;
  }

  function toggleCell(cell, lane, step, inst) {
    Audio.resume();
    const existing = rhythm.notes.find(n => n.lane === lane && n.step === step);
    if (!existing) {
      // Ajouter à forte
      const note = { lane, step, soundIndex: 0, volume: 3 };
      rhythm.notes.push(note);
      setCellVolume(cell, inst, note);
      Audio.playSound(inst.id, 0, 0, 1.0);
    } else if (existing.volume > 1) {
      // Réduire le volume
      existing.volume--;
      setCellVolume(cell, inst, existing);
      Audio.playSound(inst.id, existing.soundIndex || 0, 0, existing.volume / 3);
    } else {
      // Supprimer
      rhythm.notes = rhythm.notes.filter(n => !(n.lane === lane && n.step === step));
      setCellVolume(cell, inst, null);
    }
  }

  function startPlayback() {
    if (isPlaying) { stopPlayback(); return; }
    Audio.resume();
    isPlaying = true;
    document.getElementById('btn-play-editor').textContent = '⏹ Stop';

    const totalSteps = getTotalSteps();
    // stepDuration in ms: 1 beat = 60000/bpm ms, step = beat / (subdivision/4)
    const stepDuration = (60000 / rhythm.bpm) / (rhythm.subdivision / 4);
    playStep = 0;

    const tick = () => {
      rhythm.notes
        .filter(n => n.step === playStep)
        .forEach(n => {
          const trackVol = rhythm.trackVolumes && rhythm.trackVolumes[INSTRUMENTS[n.lane].id] !== undefined
            ? rhythm.trackVolumes[INSTRUMENTS[n.lane].id] : 1.0;
          Audio.playSound(INSTRUMENTS[n.lane].id, n.soundIndex || 0, 0, ((n.volume || 3) / 3) * trackVol);
        });
      highlightStep(playStep);
      playStep = (playStep + 1) % totalSteps;
    };

    tick();
    playInterval = setInterval(tick, stepDuration);
  }

  function stopPlayback() {
    if (playInterval) { clearInterval(playInterval); playInterval = null; }
    isPlaying = false;
    playStep = 0;
    const btn = document.getElementById('btn-play-editor');
    if (btn) btn.textContent = '▶ Écouter';
    clearHighlight();
  }

  function highlightStep(step) {
    clearHighlight();
    document.querySelectorAll('.editor-row').forEach(row => {
      // +1 because first child is the label
      const cell = row.children[step + 1];
      if (cell) cell.classList.add('cell-playing');
    });
    // Also highlight beat marker
    const markerRow = document.querySelector('.editor-beat-row');
    if (markerRow) {
      const marker = markerRow.children[step + 1];
      if (marker) marker.classList.add('cell-playing');
    }
  }

  function clearHighlight() {
    document.querySelectorAll('.cell-playing').forEach(c => c.classList.remove('cell-playing'));
  }

  function save() {
    const name = document.getElementById('rhythm-name').value.trim();
    if (!name) { alert('Donne un nom au morceau !'); return; }
    rhythm.name = name;
    rhythm.bpm = parseInt(document.getElementById('bpm-slider').value);
    rhythm.measures = parseInt(document.getElementById('measures-select').value);
    rhythm.subdivision = parseInt(document.getElementById('subdivision-select').value);
    Storage.saveRhythm(rhythm);
    stopPlayback();
    App.showHome();
  }

  function clearNotes() {
    if (!confirm('Effacer toutes les notes ?')) return;
    rhythm.notes = [];
    renderGrid();
  }

  function initEvents() {
    document.getElementById('bpm-slider').addEventListener('input', e => {
      rhythm.bpm = parseInt(e.target.value);
      document.getElementById('bpm-display').textContent = e.target.value;
      if (isPlaying) { stopPlayback(); startPlayback(); }
    });

    document.getElementById('measures-select').addEventListener('change', e => {
      stopPlayback();
      rhythm.measures = parseInt(e.target.value);
      const total = getTotalSteps();
      rhythm.notes = rhythm.notes.filter(n => n.step < total);
      renderGrid();
    });

    document.getElementById('subdivision-select').addEventListener('change', e => {
      stopPlayback();
      const oldSub = rhythm.subdivision;
      const newSub = parseInt(e.target.value);
      if (newSub !== oldSub) {
        const newTotal = rhythm.measures * newSub;
        rhythm.notes = rhythm.notes
          .map(n => ({ ...n, step: Math.round(n.step * newSub / oldSub) }))
          .filter(n => n.step < newTotal);
        rhythm.subdivision = newSub;
      }
      renderGrid();
    });

    document.getElementById('btn-play-editor').addEventListener('click', startPlayback);
    document.getElementById('btn-save-rhythm').addEventListener('click', save);
    document.getElementById('btn-clear-editor').addEventListener('click', clearNotes);
  }

  return {
    createNew, load, render, initEvents, stopPlayback,
    get current() { return rhythm; }
  };
})();
