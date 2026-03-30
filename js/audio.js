const Audio = (() => {
  let ctx = null;
  // buffers[instrumentId][soundIndex] = AudioBuffer
  const buffers = {};

  function getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  async function blobToAudioBuffer(blob) {
    const ac = getCtx();
    const arrayBuffer = await blob.arrayBuffer();
    return await ac.decodeAudioData(arrayBuffer);
  }

  // Sons disponibles dans le dossier /sounds/ du projet
  const SERVER_SOUNDS = {
    'surdo1':     ['surdo1.mp3'],
    'surdo2':     ['surdo2.mp3'],
    'surdo3':     ['surdo3.mp3'],
    'caixa':      ['caixa.mp3'],
    'repinique':  ['repinique.mp3'],
    'agogo_low':  ['agogo_G.mp3'],
    'agogo_high': ['agogo_A.mp3'],
    'ganza':      ['ganza.mp3'],
  };

  async function fetchAndStoreSound(instrumentId, index, filename) {
    try {
      const res = await fetch(`sounds/${filename}`);
      if (!res.ok) return null;
      const blob = await res.blob();
      await Storage.saveSound(instrumentId, index, blob, filename);
      return blob;
    } catch(e) {
      console.warn(`Impossible de charger sounds/${filename}`, e);
      return null;
    }
  }

  async function loadAllSounds() {
    const meta = Storage.getSoundMeta();
    for (const inst of INSTRUMENTS) {
      buffers[inst.id] = [];

      // 1. Charger depuis IndexedDB
      const names = meta[inst.id] || [];
      for (let i = 0; i < names.length; i++) {
        const blob = await Storage.getSound(inst.id, i);
        if (blob) {
          try { buffers[inst.id][i] = await blobToAudioBuffer(blob); }
          catch(e) { console.warn(`Erreur chargement son ${inst.id}[${i}]`, e); }
        }
      }

      // 2. Si aucun son chargé → tenter le chargement depuis /sounds/
      const serverFiles = SERVER_SOUNDS[inst.id];
      if (serverFiles && buffers[inst.id].length === 0) {
        for (let i = 0; i < serverFiles.length; i++) {
          const blob = await fetchAndStoreSound(inst.id, i, serverFiles[i]);
          if (blob) {
            try { buffers[inst.id][i] = await blobToAudioBuffer(blob); }
            catch(e) { console.warn(`Erreur décodage ${serverFiles[i]}`, e); }
          }
        }
      }
    }
  }

  async function loadSound(instrumentId, index) {
    const blob = await Storage.getSound(instrumentId, index);
    if (!blob) return;
    if (!buffers[instrumentId]) buffers[instrumentId] = [];
    try {
      buffers[instrumentId][index] = await blobToAudioBuffer(blob);
    } catch(e) {
      console.warn(`Erreur chargement son ${instrumentId}[${index}]`, e);
    }
  }

  // Sons G partagent les fichiers du D correspondant si aucun son propre
  const SOUND_FALLBACK = {
    'surdo3_g':    'surdo3',
    'caixa_g':     'caixa',
    'repinique_g': 'repinique',
  };

  // when: Web Audio timestamp (ac.currentTime). 0 = now. volume: 0.0–1.0.
  function playSound(instrumentId, soundIndex = 0, when = 0, volume = 1.0) {
    const ac = getCtx();
    let instBufs = buffers[instrumentId];
    // Fallback vers le son D si le son G n'est pas chargé
    if ((!instBufs || !instBufs[soundIndex]) && SOUND_FALLBACK[instrumentId]) {
      instBufs = buffers[SOUND_FALLBACK[instrumentId]];
    }
    if (!instBufs || !instBufs[soundIndex]) return;
    const source = ac.createBufferSource();
    source.buffer = instBufs[soundIndex];
    const gain = ac.createGain();
    gain.gain.value = Math.max(0, Math.min(1, volume));
    source.connect(gain);
    gain.connect(ac.destination);
    source.start(when > 0 ? when : ac.currentTime);
  }

  function hasSound(instrumentId, soundIndex = 0) {
    return !!(buffers[instrumentId] && buffers[instrumentId][soundIndex]);
  }

  function getCurrentTime() {
    return getCtx().currentTime;
  }

  function resume() {
    getCtx();
  }

  return { loadAllSounds, loadSound, playSound, hasSound, getCurrentTime, getCtx, resume };
})();
