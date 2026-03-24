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

  async function loadAllSounds() {
    const meta = Storage.getSoundMeta();
    for (const inst of INSTRUMENTS) {
      buffers[inst.id] = [];
      const names = meta[inst.id] || [];
      for (let i = 0; i < names.length; i++) {
        const blob = await Storage.getSound(inst.id, i);
        if (blob) {
          try {
            buffers[inst.id][i] = await blobToAudioBuffer(blob);
          } catch(e) {
            console.warn(`Erreur chargement son ${inst.id}[${i}]`, e);
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

  // when: Web Audio timestamp (ac.currentTime). 0 = now. volume: 0.0–1.0.
  function playSound(instrumentId, soundIndex = 0, when = 0, volume = 1.0) {
    const ac = getCtx();
    const instBufs = buffers[instrumentId];
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
