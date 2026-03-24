const App = (() => {
  let currentGameSource = null;
  let isAdmin = false;

  // ─── PIN ─────────────────────────────────────────────────────────────────

  const PIN_KEY = 'batuque_pin';
  const DEFAULT_PIN = '1234';
  let pinBuffer = '';
  let pinMode = 'login'; // 'login' | 'change-step1' | 'change-step2'
  let pinNewTemp = '';

  function getPin() { return localStorage.getItem(PIN_KEY) || DEFAULT_PIN; }
  function savePin(p) { localStorage.setItem(PIN_KEY, p); }

  function openPinModal(mode = 'login') {
    pinMode = mode;
    pinBuffer = '';
    pinNewTemp = '';
    updatePinDots(0);
    document.getElementById('pin-error').style.visibility = 'hidden';

    if (mode === 'login') {
      document.getElementById('pin-modal-title').textContent = '🔐 Code Admin';
      document.getElementById('pin-modal-subtitle').textContent = 'Entre le code pour accéder à l\'administration';
    } else if (mode === 'change-step1') {
      document.getElementById('pin-modal-title').textContent = '🔐 Changer le PIN';
      document.getElementById('pin-modal-subtitle').textContent = 'Entre le nouveau code (4 chiffres)';
    }
    document.getElementById('pin-modal').classList.remove('hidden');
  }

  function closePinModal() {
    pinBuffer = '';
    document.getElementById('pin-modal').classList.add('hidden');
  }

  function updatePinDots(count) {
    document.querySelectorAll('.pin-dot').forEach((dot, i) => {
      dot.classList.toggle('filled', i < count);
    });
  }

  function pinError() {
    const dots = document.getElementById('pin-dots');
    dots.classList.add('shake');
    document.getElementById('pin-error').style.visibility = 'visible';
    setTimeout(() => {
      dots.classList.remove('shake');
      pinBuffer = '';
      updatePinDots(0);
    }, 600);
  }

  function handlePinDigit(digit) {
    if (pinBuffer.length >= 4) return;
    pinBuffer += digit;
    updatePinDots(pinBuffer.length);

    if (pinBuffer.length === 4) {
      setTimeout(() => submitPin(), 150);
    }
  }

  function submitPin() {
    if (pinMode === 'login') {
      if (pinBuffer === getPin()) {
        closePinModal();
        enterAdminMode();
      } else {
        pinError();
      }
    } else if (pinMode === 'change-step1') {
      // Premier saisie du nouveau PIN
      pinNewTemp = pinBuffer;
      pinBuffer = '';
      updatePinDots(0);
      pinMode = 'change-step2';
      document.getElementById('pin-modal-subtitle').textContent = 'Confirme le nouveau code';
      document.getElementById('pin-error').style.visibility = 'hidden';
    } else if (pinMode === 'change-step2') {
      if (pinBuffer === pinNewTemp) {
        savePin(pinBuffer);
        closePinModal();
        updatePinDisplay();
        alert('✅ PIN changé avec succès !');
      } else {
        pinNewTemp = '';
        pinMode = 'change-step1';
        document.getElementById('pin-modal-subtitle').textContent = 'Les codes ne correspondent pas.\nEntre le nouveau code :';
        pinError();
      }
    }
  }

  function updatePinDisplay() {
    const el = document.getElementById('pin-display');
    if (el) el.textContent = getPin().replace(/./g, '•');
  }

  function initPinEvents() {
    document.querySelectorAll('.pin-key[data-digit]').forEach(btn => {
      btn.addEventListener('click', () => handlePinDigit(btn.dataset.digit));
    });
    document.getElementById('pin-backspace').addEventListener('click', () => {
      if (pinBuffer.length > 0) {
        pinBuffer = pinBuffer.slice(0, -1);
        updatePinDots(pinBuffer.length);
        document.getElementById('pin-error').style.visibility = 'hidden';
      }
    });
    document.getElementById('pin-cancel').addEventListener('click', closePinModal);
    document.getElementById('pin-overlay').addEventListener('click', closePinModal);
    document.getElementById('btn-open-pin').addEventListener('click', () => openPinModal('login'));
    document.getElementById('btn-lock').addEventListener('click', exitAdminMode);
    document.getElementById('btn-change-pin').addEventListener('click', () => openPinModal('change-step1'));
  }

  // ─── Modes Admin / Public ─────────────────────────────────────────────────

  function enterAdminMode() {
    isAdmin = true;
    document.body.classList.remove('public-mode');
    document.body.classList.add('admin-mode');
    renderHome();
  }

  function exitAdminMode() {
    isAdmin = false;
    document.body.classList.remove('admin-mode');
    document.body.classList.add('public-mode');
    Editor.stopPlayback();
    Arrangement.stopPreview();
    Game.stop();
    showScreen('home');
    setActiveNav('home');
    renderHome();
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  async function init() {
    await Storage.init();
    seedDefaultData();
    await Audio.loadAllSounds();
    Editor.initEvents();
    Arrangement.initEvents();
    initNav();
    initHomeEvents();
    initGameSetupEvents();
    initGameOverEvents();
    initPinEvents();
    updatePinDisplay();
    renderSoundsScreen();
    renderHome();
    showScreen('home');
  }

  // ─── Navigation ───────────────────────────────────────────────────────────

  function initNav() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const screen = btn.dataset.screen;
        if (screen === 'editor') {
          if (!Editor.current) Editor.createNew();
          Editor.render();
        }
        if (screen === 'sounds') {
          renderSoundsScreen();
          updatePinDisplay();
        }
        if (screen === 'arrangement') {
          renderHome();
          showScreen('home');
          setActiveNav('arrangement');
          return;
        }
        showScreen(screen);
        setActiveNav(screen);
      });
    });
  }

  function showScreen(name) {
    Editor.stopPlayback();
    Arrangement.stopPreview();
    Game.stop();
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(`screen-${name}`);
    if (target) target.classList.add('active');
    document.getElementById('nav').style.display = '';
    document.body.classList.remove('in-game');
  }

  function showGameScreen() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-game').classList.add('active');
    document.getElementById('nav').style.display = 'none';
    document.body.classList.add('in-game');
  }

  function setActiveNav(name) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.screen === name);
    });
  }

  // ─── Accueil ──────────────────────────────────────────────────────────────

  function initHomeEvents() {
    document.getElementById('btn-new-rhythm').addEventListener('click', () => {
      Editor.createNew();
      Editor.render();
      showScreen('editor');
      setActiveNav('editor');
    });
    document.getElementById('btn-new-arrangement').addEventListener('click', () => {
      Arrangement.createNew();
      Arrangement.render();
      showScreen('arrangement-editor');
      setActiveNav('arrangement');
    });
  }

  function renderHome() {
    renderRhythmList();
    renderArrangementList();
  }

  function renderRhythmList() {
    const list = document.getElementById('rhythm-list');
    const rhythms = Storage.getRhythms();
    if (rhythms.length === 0) {
      list.innerHTML = '<p class="empty-msg" style="padding:16px 0">Aucun loop — crée-en un avec ✏️</p>';
      return;
    }
    list.innerHTML = '';
    rhythms.forEach(r => {
      const card = document.createElement('div');
      card.className = 'rhythm-card';
      const noteCount = (r.notes || []).length;
      card.innerHTML = `
        <div class="rhythm-card-info">
          <h3>${r.name}</h3>
          <p>${r.bpm} BPM &nbsp;·&nbsp; ${r.measures} mes. &nbsp;·&nbsp; ${noteCount} notes</p>
        </div>
        <div class="rhythm-card-actions">
          <button class="btn-icon" data-id="${r.id}" data-action="play">🎮</button>
          <button class="btn-icon admin-only" data-id="${r.id}" data-action="edit">✏️</button>
          <button class="btn-icon admin-only" data-id="${r.id}" data-action="delete">🗑</button>
        </div>`;
      list.appendChild(card);
    });
    list.querySelectorAll('.btn-icon').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (btn.dataset.action === 'play') openGameSetup('rhythm', id);
        else if (btn.dataset.action === 'edit') openEditor(id);
        else if (btn.dataset.action === 'delete') {
          if (confirm('Supprimer ce loop ?')) { Storage.deleteRhythm(id); renderHome(); }
        }
      });
    });
  }

  function renderArrangementList() {
    const list = document.getElementById('arrangement-list');
    const arrangements = Storage.getArrangements();
    if (arrangements.length === 0) {
      list.innerHTML = '<p class="empty-msg" style="padding:16px 0">Aucun arrangement — crée-en un avec 🎼</p>';
      return;
    }
    list.innerHTML = '';
    arrangements.forEach(a => {
      const card = document.createElement('div');
      card.className = 'rhythm-card';
      const totalMes = a.cellSize * a.totalCells;
      card.innerHTML = `
        <div class="rhythm-card-info">
          <h3>${a.name}</h3>
          <p>${a.bpm} BPM &nbsp;·&nbsp; ${totalMes} mes. &nbsp;·&nbsp; ${a.totalCells} cases</p>
        </div>
        <div class="rhythm-card-actions">
          <button class="btn-icon" data-id="${a.id}" data-action="play">🎮</button>
          <button class="btn-icon admin-only" data-id="${a.id}" data-action="edit">✏️</button>
          <button class="btn-icon admin-only" data-id="${a.id}" data-action="delete">🗑</button>
        </div>`;
      list.appendChild(card);
    });
    list.querySelectorAll('.btn-icon').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (btn.dataset.action === 'play') openGameSetup('arrangement', id);
        else if (btn.dataset.action === 'edit') openArrangementEditor(id);
        else if (btn.dataset.action === 'delete') {
          if (confirm('Supprimer cet arrangement ?')) { Storage.deleteArrangement(id); renderHome(); }
        }
      });
    });
  }

  function showHome() {
    showScreen('home');
    setActiveNav('home');
    renderHome();
  }

  // ─── Éditeur loops ────────────────────────────────────────────────────────

  function openEditor(rhythmId) {
    const r = Storage.getRhythm(rhythmId);
    Editor.load(r);
    Editor.render();
    showScreen('editor');
    setActiveNav('editor');
  }

  // ─── Éditeur arrangement ──────────────────────────────────────────────────

  function openArrangementEditor(arrId) {
    const a = Storage.getArrangement(arrId);
    Arrangement.load(a);
    Arrangement.render();
    showScreen('arrangement-editor');
    setActiveNav('arrangement');
  }

  // ─── Game Setup ───────────────────────────────────────────────────────────

  function openGameSetup(type, id) {
    currentGameSource = { type, id };
    const name = type === 'rhythm'
      ? Storage.getRhythm(id)?.name
      : Storage.getArrangement(id)?.name;
    document.getElementById('game-setup-title').textContent = name || '?';
    document.getElementById('game-setup-type').textContent =
      type === 'arrangement' ? '🎼 Arrangement' : '🎵 Loop';

    const selector = document.getElementById('instrument-selector');
    selector.innerHTML = '';

    // Sélecteur basé sur les groupes (5 boutons au lieu de 7 lanes)
    INSTRUMENT_GROUPS.forEach((group, gi) => {
      const btn = document.createElement('button');
      btn.className = 'inst-toggle'; // Rien de sélectionné par défaut — cliquer pour choisir
      btn.dataset.groupIndex = gi;
      btn.style.setProperty('--inst-color', group.color);

      // Points colorés pour chaque lane du groupe
      const dots = group.lanes
        .map(lane => `<span class="inst-toggle-dot" style="background:${INSTRUMENTS[lane].color}"></span>`)
        .join('');
      btn.innerHTML = `<span class="inst-toggle-dots">${dots}</span>${group.name}`;
      btn.addEventListener('click', () => btn.classList.toggle('selected'));
      selector.appendChild(btn);
    });

    document.getElementById('speed-slider').value = 100;
    document.getElementById('speed-display').textContent = '100';
    showScreen('game-setup');
  }

  function initGameSetupEvents() {
    document.getElementById('speed-slider').addEventListener('input', e => {
      document.getElementById('speed-display').textContent = e.target.value;
    });
    document.getElementById('btn-start-game').addEventListener('click', () => {
      const groupIndices = [...document.querySelectorAll('.inst-toggle.selected')]
        .map(btn => parseInt(btn.dataset.groupIndex));
      if (groupIndices.length === 0) { alert('Sélectionne au moins un instrument !'); return; }
      const speed = parseInt(document.getElementById('speed-slider').value) / 100;
      if (currentGameSource.type === 'rhythm') {
        Game.setup(Storage.getRhythm(currentGameSource.id), groupIndices, speed);
      } else {
        Game.setupArrangement(Storage.getArrangement(currentGameSource.id), groupIndices, speed);
      }
      showGameScreen();
      Game.start();
    });
    document.getElementById('btn-back-home').addEventListener('click', showHome);
  }

  // ─── Game Over ────────────────────────────────────────────────────────────

  function initGameOverEvents() {
    document.getElementById('btn-replay').addEventListener('click', () => {
      const groupIndices = [...document.querySelectorAll('.inst-toggle.selected')]
        .map(btn => parseInt(btn.dataset.groupIndex));
      const speed = parseInt(document.getElementById('speed-slider').value) / 100;
      Game.stop();
      if (currentGameSource.type === 'rhythm') {
        Game.setup(Storage.getRhythm(currentGameSource.id), groupIndices, speed);
      } else {
        Game.setupArrangement(Storage.getArrangement(currentGameSource.id), groupIndices, speed);
      }
      document.getElementById('game-over').classList.add('hidden');
      Game.start();
    });
    document.getElementById('btn-exit-game').addEventListener('click', showHome);
  }

  // ─── Sons ─────────────────────────────────────────────────────────────────

  function renderSoundsScreen() {
    const container = document.getElementById('sounds-list');
    container.innerHTML = '';
    INSTRUMENTS.forEach(inst => {
      const names = Storage.getSoundNames(inst.id);
      const section = document.createElement('div');
      section.className = 'sound-instrument';
      section.innerHTML = `
        <h3><span class="sound-dot" style="background:${inst.color}"></span>${inst.name}</h3>
        <div class="sound-items" id="si-${inst.id}"></div>
        <button class="btn-add-sound" data-inst="${inst.id}">+ Ajouter un son</button>`;
      container.appendChild(section);
      const itemsEl = section.querySelector(`#si-${inst.id}`);
      names.forEach((name, idx) => renderSoundItem(itemsEl, inst, idx, name));
      section.querySelector('.btn-add-sound').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        input.onchange = async () => {
          const file = input.files[0];
          if (!file) return;
          const blob = new Blob([await file.arrayBuffer()], { type: file.type });
          const idx = Storage.getSoundNames(inst.id).length;
          const name = file.name.replace(/\.[^.]+$/, '');
          await Storage.saveSound(inst.id, idx, blob, name);
          await Audio.loadSound(inst.id, idx);
          renderSoundsScreen();
        };
        input.click();
      });
    });
  }

  function renderSoundItem(container, inst, idx, name) {
    const item = document.createElement('div');
    item.className = 'sound-item';
    item.innerHTML = `
      <span class="sound-num">${idx + 1}</span>
      <input type="text" class="sound-name-input" value="${name}" placeholder="Nom du son">
      <button class="btn-icon">▶</button>
      <button class="btn-icon btn-del">🗑</button>`;
    container.appendChild(item);
    item.querySelector('.sound-name-input').addEventListener('change', e => {
      Storage.updateSoundName(inst.id, idx, e.target.value);
    });
    item.querySelectorAll('.btn-icon')[0].addEventListener('click', () => {
      Audio.resume(); Audio.playSound(inst.id, idx);
    });
    item.querySelectorAll('.btn-icon')[1].addEventListener('click', async () => {
      if (!confirm(`Supprimer "${name}" ?`)) return;
      await Storage.deleteSound(inst.id, idx);
      await Audio.loadAllSounds();
      renderSoundsScreen();
    });
  }

  return { init, showHome, renderHome };
})();

window.addEventListener('load', () => App.init());
