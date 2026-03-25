const Storage = (() => {
  const FB_URL = 'https://batuque-hero-default-rtdb.europe-west1.firebasedatabase.app';
  const SOUND_META_KEY = 'batuque_sound_meta';
  let db = null;

  // Cache local (chargé depuis Firebase au démarrage)
  let rhythmsCache = [];
  let arrangementsCache = [];

  // ── Helpers Firebase REST ────────────────────────────────────────────────

  async function fbGet(path) {
    try {
      const res = await fetch(`${FB_URL}/${path}.json`);
      return res.ok ? await res.json() : null;
    } catch { return null; }
  }

  async function fbSet(path, data) {
    try {
      await fetch(`${FB_URL}/${path}.json`, {
        method: 'PUT',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) { console.warn('Firebase write:', e); }
  }

  async function fbDelete(path) {
    try {
      await fetch(`${FB_URL}/${path}.json`, { method: 'DELETE' });
    } catch (e) { console.warn('Firebase delete:', e); }
  }

  // ── Init ─────────────────────────────────────────────────────────────────

  async function init() {
    // IndexedDB pour les sons
    await new Promise((resolve, reject) => {
      const req = indexedDB.open('BatuqueHeroDB', 2);
      req.onupgradeneeded = e => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('sounds')) {
          d.createObjectStore('sounds', { keyPath: 'key' });
        }
      };
      req.onsuccess = e => { db = e.target.result; resolve(); };
      req.onerror = e => reject(e);
    });

    // Charge les rythmes depuis Firebase
    const rhythmsData = await fbGet('rhythms');
    rhythmsCache = rhythmsData ? Object.values(rhythmsData) : [];

    // Charge les arrangements depuis Firebase
    const arrangementsData = await fbGet('arrangements');
    arrangementsCache = arrangementsData ? Object.values(arrangementsData) : [];

    // Seed des rythmes par défaut si la base est vide
    if (rhythmsCache.length === 0 && typeof DEFAULT_RHYTHMS !== 'undefined') {
      for (const r of DEFAULT_RHYTHMS) {
        await fbSet(`rhythms/${r.id}`, r);
      }
      rhythmsCache = [...DEFAULT_RHYTHMS];
    }
  }

  // ── Rythmes ──────────────────────────────────────────────────────────────

  function getRhythms() { return rhythmsCache; }

  function saveRhythm(rhythm) {
    if (!rhythm.id) rhythm.id = Date.now().toString();
    const idx = rhythmsCache.findIndex(r => r.id === rhythm.id);
    if (idx >= 0) rhythmsCache[idx] = rhythm; else rhythmsCache.push(rhythm);
    fbSet(`rhythms/${rhythm.id}`, rhythm);
    return rhythm;
  }

  function deleteRhythm(id) {
    rhythmsCache = rhythmsCache.filter(r => r.id !== id);
    fbDelete(`rhythms/${id}`);
  }

  function getRhythm(id) {
    return rhythmsCache.find(r => r.id === id) || null;
  }

  // ── Arrangements ─────────────────────────────────────────────────────────

  function getArrangements() { return arrangementsCache; }

  function saveArrangement(arr) {
    if (!arr.id) arr.id = 'arr_' + Date.now();
    const idx = arrangementsCache.findIndex(a => a.id === arr.id);
    if (idx >= 0) arrangementsCache[idx] = arr; else arrangementsCache.push(arr);
    fbSet(`arrangements/${arr.id}`, arr);
    return arr;
  }

  function deleteArrangement(id) {
    arrangementsCache = arrangementsCache.filter(a => a.id !== id);
    fbDelete(`arrangements/${id}`);
  }

  function getArrangement(id) {
    return arrangementsCache.find(a => a.id === id) || null;
  }

  // ── Métadonnées des sons (reste en local) ────────────────────────────────

  function getSoundMeta() {
    try { return JSON.parse(localStorage.getItem(SOUND_META_KEY)) || {}; }
    catch { return {}; }
  }

  function setSoundMeta(meta) {
    localStorage.setItem(SOUND_META_KEY, JSON.stringify(meta));
  }

  function getSoundNames(instrumentId) {
    return getSoundMeta()[instrumentId] || [];
  }

  function updateSoundName(instrumentId, index, name) {
    const meta = getSoundMeta();
    if (!meta[instrumentId]) meta[instrumentId] = [];
    meta[instrumentId][index] = name;
    setSoundMeta(meta);
  }

  // ── Sons (blobs dans IndexedDB, restent en local) ─────────────────────────

  function soundKey(instrumentId, index) {
    return `${instrumentId}_${index}`;
  }

  async function saveSound(instrumentId, index, blob, name) {
    const key = soundKey(instrumentId, index);
    await new Promise((resolve, reject) => {
      const tx = db.transaction('sounds', 'readwrite');
      tx.objectStore('sounds').put({ key, blob });
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
    const meta = getSoundMeta();
    if (!meta[instrumentId]) meta[instrumentId] = [];
    meta[instrumentId][index] = name || `Son ${index + 1}`;
    setSoundMeta(meta);
  }

  async function getSound(instrumentId, index) {
    const key = soundKey(instrumentId, index);
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sounds', 'readonly');
      const req = tx.objectStore('sounds').get(key);
      req.onsuccess = () => resolve(req.result ? req.result.blob : null);
      req.onerror = reject;
    });
  }

  async function deleteSound(instrumentId, index) {
    const key = soundKey(instrumentId, index);
    await new Promise((resolve, reject) => {
      const tx = db.transaction('sounds', 'readwrite');
      tx.objectStore('sounds').delete(key);
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
    const meta = getSoundMeta();
    if (meta[instrumentId]) {
      meta[instrumentId].splice(index, 1);
      setSoundMeta(meta);
    }
  }

  return {
    init, getRhythms, saveRhythm, deleteRhythm, getRhythm,
    saveSound, getSound, deleteSound, getSoundNames, getSoundMeta, updateSoundName,
    getArrangements, saveArrangement, deleteArrangement, getArrangement
  };
})();
