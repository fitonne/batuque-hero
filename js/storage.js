const Storage = (() => {
  const RHYTHMS_KEY = 'batuque_rhythms';
  const SOUND_META_KEY = 'batuque_sound_meta';
  let db = null;

  async function init() {
    return new Promise((resolve, reject) => {
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
  }

  // --- Rythmes ---
  function getRhythms() {
    try { return JSON.parse(localStorage.getItem(RHYTHMS_KEY)) || []; }
    catch { return []; }
  }

  function saveRhythm(rhythm) {
    const list = getRhythms();
    if (!rhythm.id) rhythm.id = Date.now().toString();
    const idx = list.findIndex(r => r.id === rhythm.id);
    if (idx >= 0) list[idx] = rhythm; else list.push(rhythm);
    localStorage.setItem(RHYTHMS_KEY, JSON.stringify(list));
    return rhythm;
  }

  function deleteRhythm(id) {
    const list = getRhythms().filter(r => r.id !== id);
    localStorage.setItem(RHYTHMS_KEY, JSON.stringify(list));
  }

  function getRhythm(id) {
    return getRhythms().find(r => r.id === id) || null;
  }

  // --- Métadonnées des sons ---
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

  // --- Sons (blobs dans IndexedDB) ---
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

  function updateSoundName(instrumentId, index, name) {
    const meta = getSoundMeta();
    if (!meta[instrumentId]) meta[instrumentId] = [];
    meta[instrumentId][index] = name;
    setSoundMeta(meta);
  }

  // --- Arrangements ---
  const ARRANGEMENTS_KEY = 'batuque_arrangements';

  function getArrangements() {
    try { return JSON.parse(localStorage.getItem(ARRANGEMENTS_KEY)) || []; }
    catch { return []; }
  }

  function saveArrangement(arr) {
    const list = getArrangements();
    if (!arr.id) arr.id = 'arr_' + Date.now();
    const idx = list.findIndex(a => a.id === arr.id);
    if (idx >= 0) list[idx] = arr; else list.push(arr);
    localStorage.setItem(ARRANGEMENTS_KEY, JSON.stringify(list));
    return arr;
  }

  function deleteArrangement(id) {
    const list = getArrangements().filter(a => a.id !== id);
    localStorage.setItem(ARRANGEMENTS_KEY, JSON.stringify(list));
  }

  function getArrangement(id) {
    return getArrangements().find(a => a.id === id) || null;
  }

  return {
    init, getRhythms, saveRhythm, deleteRhythm, getRhythm,
    saveSound, getSound, deleteSound, getSoundNames, getSoundMeta, updateSoundName,
    getArrangements, saveArrangement, deleteArrangement, getArrangement
  };
})();
