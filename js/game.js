const Game = (() => {
  let selectedGroupIndices = []; // indices dans INSTRUMENT_GROUPS
  let columns = [];              // liste plate des lanes actives, dans l'ordre des groupes
  let laneToCol = {};            // lane index → colonne canvas
  let speedMultiplier = 1;
  let currentBpm = 100;          // BPM effectif (après speed multiplier)
  let score = 0, combo = 0, maxCombo = 0;
  let countPerfect = 0, countGood = 0, countMiss = 0;
  let animFrame = null;
  let gameStartTime = null;
  let acStartTime = null;
  let notes = [];
  let canvas, canvasCtx;
  let feedbackTimer = null;
  let gameEnded = false;
  let countdownEndTime = 0;  // performance.now() quand le décompte se termine

  const FALL_DURATION = 1800;
  const HIT_ZONE_RATIO = 0.82;
  const PERFECT_MS = 75;
  const GOOD_MS = 150;
  const VOL_ALPHA = { 1: 0.35, 2: 0.65, 3: 1.0 };

  // ── Construction du layout colonnes ─────────────────────────────────────

  function buildLayout(groupIndices) {
    // columns = lanes des groupes sélectionnés, dans l'ordre
    columns = groupIndices.flatMap(gi => INSTRUMENT_GROUPS[gi].lanes);
    laneToCol = {};
    columns.forEach((lane, idx) => { laneToCol[lane] = idx; });
  }

  function activeLanes() {
    return columns; // = toutes les lanes des groupes sélectionnés
  }

  // ── Setup depuis un loop ─────────────────────────────────────────────────

  function setup(rhythmData, groupIndices, speed) {
    selectedGroupIndices = groupIndices;
    buildLayout(groupIndices);
    speedMultiplier = speed;
    currentBpm = rhythmData.bpm * speed;
    score = 0; combo = 0; maxCombo = 0;
    countPerfect = 0; countGood = 0; countMiss = 0;
    gameEnded = false;

    const bpm = currentBpm;
    const stepMs = (60000 / bpm) / (rhythmData.subdivision / 4);

    notes = rhythmData.notes.map(n => ({
      lane: n.lane,
      timestamp: n.step * stepMs,
      soundIndex: n.soundIndex || 0,
      volume: n.volume || 3,
      hit: false,
      missed: false,
      active: laneToCol[n.lane] !== undefined,
    }));
  }

  // ── Setup depuis un arrangement ──────────────────────────────────────────

  function setupArrangement(arrangementData, groupIndices, speed) {
    selectedGroupIndices = groupIndices;
    buildLayout(groupIndices);
    speedMultiplier = speed;
    currentBpm = arrangementData.bpm * speed;
    score = 0; combo = 0; maxCombo = 0;
    countPerfect = 0; countGood = 0; countMiss = 0;
    gameEnded = false;

    const scaledBpm = arrangementData.bpm * speed;
    const rawNotes = Arrangement.buildNotes(scaledBpm, arrangementData);

    notes = rawNotes.map(n => ({
      ...n,
      active: laneToCol[n.lane] !== undefined,
      hit: false,
      missed: false,
    }));
  }

  // ── Construction de l'UI (canvas + boutons) ──────────────────────────────

  function buildUI() {
    canvas = document.getElementById('game-canvas');
    canvasCtx = canvas.getContext('2d');
    const btnContainer = document.getElementById('game-buttons');
    btnContainer.innerHTML = '';

    const hudH = document.getElementById('game-hud').offsetHeight;
    const btnH = Math.max(80, Math.floor(window.innerHeight * 0.18));
    const canvasH = window.innerHeight - hudH - btnH;

    canvas.width = window.innerWidth;
    canvas.height = canvasH;
    canvas.style.height = canvasH + 'px';

    const totalCols = columns.length;
    const colW = canvas.width / (totalCols || 1);

    // Un bouton par groupe sélectionné
    selectedGroupIndices.forEach(gi => {
      const group = INSTRUMENT_GROUPS[gi];
      const btn = document.createElement('button');
      btn.className = 'game-btn';
      btn.style.height = btnH + 'px';
      btn.style.flex = 'none';
      btn.style.width = (group.lanes.length * colW) + 'px';

      // Dégradé si 2 lanes, couleur simple si 1
      if (group.lanes.length > 1) {
        const c1 = INSTRUMENTS[group.lanes[0]].color;
        const c2 = INSTRUMENTS[group.lanes[1]].color;
        btn.style.background = `linear-gradient(135deg, ${c1} 50%, ${c2} 50%)`;
      } else {
        btn.style.background = group.color;
      }

      btn.innerHTML = `
        <span class="game-btn-short">${group.shortName}</span>
        <span class="game-btn-label">${group.name}</span>`;

      const onHit = (e) => {
        e.preventDefault();
        Audio.resume();
        handleHit(gi);
        btn.classList.add('pressed');
        setTimeout(() => btn.classList.remove('pressed'), 100);
      };
      btn.addEventListener('touchstart', onHit, { passive: false });
      btn.addEventListener('mousedown', onHit);
      btnContainer.appendChild(btn);
    });
  }

  // ── Click de décompte (Web Audio) ────────────────────────────────────────

  function scheduleClick(when, isAccent) {
    const ac = Audio.getCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = 'sine';
    osc.frequency.value = isAccent ? 1000 : 700;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(isAccent ? 0.35 : 0.22, when + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.07);
    osc.start(when);
    osc.stop(when + 0.08);
  }

  // ── Overlay décompte (dessiné PAR-DESSUS les notes) ─────────────────────

  function drawCountdownOverlay(elapsed, beatMs) {
    const W = canvas.width;
    const H = canvas.height;
    const ctx = canvasCtx;

    // Voile semi-transparent pour assombrir les notes en arrière-plan
    ctx.fillStyle = 'rgba(13,13,20,0.55)';
    ctx.fillRect(0, 0, W, H);

    const beatIndex = Math.min(3, Math.floor(elapsed / beatMs)); // 0-3
    const beatProgress = (elapsed % beatMs) / beatMs;            // 0-1
    const beatNum = beatIndex + 1;                                // 1-4

    // Pulse : grand au début du beat, rétrécit ensuite
    const pulse = Math.max(0, 1 - beatProgress * 2.2);
    const scale = 1 + pulse * 0.45;
    const alpha = 0.55 + pulse * 0.45;

    // Texte "PRÊT ?"
    ctx.font = `700 ${Math.min(W * 0.055, 22)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.shadowBlur = 0;
    ctx.fillText('PRÊT ?', W / 2, H * 0.32);

    // Chiffre principal
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(scale, scale);
    ctx.font = `900 ${Math.min(W * 0.38, H * 0.42)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.shadowColor = beatNum === 1 ? '#e94560' : '#ffffff';
    ctx.shadowBlur = 40 * pulse + 8;
    ctx.fillText(String(beatNum), 0, 0);
    ctx.restore();
    ctx.shadowBlur = 0;

    // Points indicateurs des 4 temps en bas
    const dotR = Math.min(W * 0.025, 10);
    const spacing = dotR * 3.2;
    const dotsStartX = W / 2 - spacing * 1.5;
    const dotsY = H * 0.75;
    for (let i = 0; i < 4; i++) {
      const active = i < beatNum;
      ctx.beginPath();
      ctx.arc(dotsStartX + i * spacing, dotsY, dotR, 0, Math.PI * 2);
      ctx.fillStyle = active ? 'rgba(233,69,96,0.9)' : 'rgba(255,255,255,0.2)';
      ctx.fill();
    }
  }

  // ── Démarrage : notes en arrière-plan + décompte en overlay ─────────────

  function start() {
    buildUI();
    document.getElementById('game-over').classList.add('hidden');
    updateHUD();

    const ac = Audio.getCtx();
    const beatMs = 60000 / currentBpm;
    const countdownMs = 4 * beatMs;
    const preDelay = 0.08;

    // Compensation latence audio (outputLatency = délai réel haut-parleurs)
    const latencyMs = ((ac.outputLatency || 0) + (ac.baseLatency || 0)) * 1000;

    // Son schedulé à acStartTime, visuels décalés de latencyMs → sync parfaite
    acStartTime = ac.currentTime + preDelay;
    gameStartTime = performance.now() + preDelay * 1000 + latencyMs;
    countdownEndTime = gameStartTime + countdownMs;

    // Décale tous les timestamps pour que les notes démarrent après le décompte
    notes.forEach(n => { n.timestamp += countdownMs; });

    // Planifie les 4 clicks
    for (let i = 0; i < 4; i++) {
      scheduleClick(ac.currentTime + preDelay + i * (beatMs / 1000), i === 0);
    }

    // Auto-play des groupes inactifs (timestamps déjà décalés)
    const inactive = new Set(
      INSTRUMENT_GROUPS
        .filter((_, gi) => !selectedGroupIndices.includes(gi))
        .flatMap(g => g.lanes)
    );
    notes.forEach(note => {
      if (inactive.has(note.lane)) {
        const when = acStartTime + note.timestamp / 1000;
        const vol = (note.volume / 3) * (note.trackVolume !== undefined ? note.trackVolume : 1.0);
        Audio.playSound(INSTRUMENTS[note.lane].id, note.soundIndex, when, vol);
      }
    });

    // Lance la boucle de jeu immédiatement
    animFrame = requestAnimationFrame(gameLoop);
  }

  // ── Détection de frappe ───────────────────────────────────────────────────

  function handleHit(groupIndex) {
    if (!gameStartTime || gameEnded) return;
    // Bloquer les frappes pendant le décompte
    if (performance.now() < countdownEndTime) return;
    const now = performance.now() - gameStartTime;
    const group = INSTRUMENT_GROUPS[groupIndex];

    let closest = null;
    let closestDist = Infinity;

    notes.forEach(note => {
      if (!note.active || note.hit || note.missed) return;
      if (!group.lanes.includes(note.lane)) return;
      const dist = Math.abs(note.timestamp - now);
      if (dist < closestDist && dist < GOOD_MS) {
        closestDist = dist;
        closest = note;
      }
    });

    if (closest) {
      closest.hit = true;
      Audio.playSound(INSTRUMENTS[closest.lane].id, closest.soundIndex, 0, closest.volume / 3);
      combo++;
      maxCombo = Math.max(maxCombo, combo);
      if (closestDist <= PERFECT_MS) {
        score += 100 + Math.min(combo, 20) * 5;
        countPerfect++;
        showFeedback('PERFECT !', '#f1c40f');
      } else {
        score += 50 + Math.min(combo, 20) * 2;
        countGood++;
        showFeedback('BIEN !', '#2ecc71');
      }
    } else {
      // Joue quand même le son de l'instrument (frappe dans le vide)
      const defaultLane = group.lanes[0];
      Audio.playSound(INSTRUMENTS[defaultLane].id, 0, 0, 0.7);
      combo = 0;
      showFeedback('RATÉ', '#e74c3c');
    }
    updateHUD();
  }

  // ── Game loop ─────────────────────────────────────────────────────────────

  function gameLoop(ts) {
    if (!gameStartTime) return;
    const now = performance.now();
    const elapsed = now - gameStartTime;
    const inCountdown = now < countdownEndTime;

    // Pas de miss pendant le décompte
    if (!inCountdown) {
      notes.forEach(note => {
        if (note.active && !note.hit && !note.missed && note.timestamp + GOOD_MS < elapsed) {
          note.missed = true;
          countMiss++;
          combo = 0;
          updateHUD();
        }
      });
    }

    // Dessine le canvas (notes uniquement hors décompte)
    draw(elapsed, inCountdown);

    // Overlay décompte par-dessus le fond
    if (inCountdown) {
      const beatMs = 60000 / currentBpm;
      drawCountdownOverlay(elapsed, beatMs);
    }

    const lastTs = notes.length > 0 ? Math.max(...notes.map(n => n.timestamp)) : 0;
    if (!inCountdown && elapsed > lastTs + 2000) {
      gameEnded = true;
      showGameOver();
      return;
    }
    animFrame = requestAnimationFrame(gameLoop);
  }

  // ── Dessin canvas ─────────────────────────────────────────────────────────

  function draw(elapsed, inCountdown) {
    const W = canvas.width;
    const H = canvas.height;
    const totalCols = columns.length;
    if (totalCols === 0) return;
    const colW = W / totalCols;
    const hitY = H * HIT_ZONE_RATIO;
    const noteH = 22;
    const noteR = 8;
    const ctx = canvasCtx;

    ctx.clearRect(0, 0, W, H);

    // Fond des colonnes + séparateurs
    columns.forEach((lane, colIdx) => {
      const inst = INSTRUMENTS[lane];
      const x = colIdx * colW;
      ctx.fillStyle = hexToRgba(inst.color, 0.07);
      ctx.fillRect(x, 0, colW, H);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x + colW - 1, 0, 1, H);
    });

    // Séparateurs entre groupes (plus épais)
    let colIdx = 0;
    selectedGroupIndices.forEach(gi => {
      const group = INSTRUMENT_GROUPS[gi];
      if (colIdx > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(colIdx * colW - 1, 0, 2, H);
      }
      colIdx += group.lanes.length;
    });

    // Ligne de frappe
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(0, hitY - 3, W, 6);

    // Cercles sur la zone de frappe (un par colonne)
    columns.forEach((lane, colIdx) => {
      const inst = INSTRUMENTS[lane];
      const cx = colIdx * colW + colW / 2;
      ctx.beginPath();
      ctx.arc(cx, hitY, colW * 0.28, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(inst.color, 0.5);
      ctx.lineWidth = 3;
      ctx.stroke();
    });

    // Notes
    notes.forEach(note => {
      if (!note.active || note.hit || note.missed) return;
      const colIdx = laneToCol[note.lane];
      if (colIdx === undefined) return;

      const inst = INSTRUMENTS[note.lane];
      const progress = (elapsed - (note.timestamp - FALL_DURATION)) / FALL_DURATION;
      const noteY = progress * hitY;
      if (noteY < -noteH || noteY > H) return;

      const x = colIdx * colW + 4;
      const w = colW - 8;
      const alpha = VOL_ALPHA[note.volume] || 1.0;

      ctx.shadowColor = inst.color;
      ctx.shadowBlur = 18 * alpha;
      ctx.fillStyle = hexToRgba(inst.color, alpha);
      roundRect(ctx, x, noteY - noteH / 2, w, noteH, noteR);
      ctx.fill();
      ctx.shadowBlur = 0;

      const fontSize = Math.min(13, colW * 0.22);
      ctx.fillStyle = `rgba(255,255,255,${0.6 + alpha * 0.35})`;
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(inst.shortName, colIdx * colW + colW / 2, noteY);
    });
  }

  // ── Utilitaires ───────────────────────────────────────────────────────────

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function showFeedback(text, color) {
    const el = document.getElementById('game-feedback');
    el.textContent = text;
    el.style.color = color;
    if (feedbackTimer) clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => { el.textContent = ''; }, 600);
  }

  function updateHUD() {
    document.getElementById('game-score').textContent = `Score: ${score}`;
    document.getElementById('game-combo').textContent = combo > 1 ? `x${combo}` : '';
  }

  function showGameOver() {
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    const total = countPerfect + countGood + countMiss;
    const pct = total > 0 ? Math.round((countPerfect + countGood) / total * 100) : 0;
    document.getElementById('final-score').innerHTML =
      `Score : <strong>${score}</strong><br>
       Perfect : ${countPerfect} &nbsp;·&nbsp; Bien : ${countGood} &nbsp;·&nbsp; Raté : ${countMiss}<br>
       Meilleur combo : x${maxCombo}<br>
       Précision : ${pct}%`;
    document.getElementById('game-over').classList.remove('hidden');
  }

  function stop() {
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    gameStartTime = null;
    acStartTime = null;
    gameEnded = false;
  }

  return { setup, setupArrangement, start, stop };
})();
