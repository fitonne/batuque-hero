// Données par défaut — chargées automatiquement au premier lancement
// Pour ajouter un rythme : ajouter une entrée dans DEFAULT_RHYTHMS

const DEFAULT_RHYTHMS = (() => {
  // X = forte (3), x = mezzo (2), . = silence
  function parse(grid) {
    const notes = [];
    for (const [lane, line] of Object.entries(grid)) {
      line.split(' ').forEach((sym, step) => {
        if (sym === 'X') notes.push({ lane: +lane, step, soundIndex: 0, volume: 3 });
        else if (sym === 'x') notes.push({ lane: +lane, step, soundIndex: 0, volume: 2 });
      });
    }
    return notes;
  }

  // Lanes : 0=S1  1=S2  2=S3D  3=CXD  4=RPD  5=AG↓  6=AG↑  7=S3G  8=CXG  9=RPG
  return [
    {
      id: 'default_samba_reggae',
      name: 'Samba Reggae',
      bpm: 90, measures: 1, subdivision: 16,
      notes: parse({
        0: 'X . . . . . . . X . . . . . . .',   // Surdo 1
        1: '. . . . X . . . . . . . X . . .',   // Surdo 2
        2: '. . . . . . X . . . . . X . X .',   // Surdo 3 D
        7: '. . . . . . . . . . . . . X . X',   // Surdo 3 G
        3: 'x . X . x . X . x . X . x . X .',  // Caixa D
        8: '. x . x . x . x . x . x . x . x',  // Caixa G
        4: 'X . . X . . X . . . X . X . . .',   // Repinique D
        9: 'X . . X . . X . . . X . X . . .',   // Repinique G
      })
    },
    {
      id: 'default_samba_reggae_break1',
      name: 'Samba Reggae Break 1',
      bpm: 90, measures: 4, subdivision: 16,
      notes: parse({
        0: 'X . . X . . X . . . X . X . . . X X X X X X X X X . . . . . . . X . . . . . . . X . . . . . . . X . . . . . . . X . . . . . . .',
        1: 'X . . X . . X . . . X . X . . . X X X X X X X X X . . . . . . . X . . . . . . . X . . . . . . . X . . . . . . . X . . . . . . .',
        2: 'X . . . . . X . . . . . X . . . X . X . X . X . X . . . . . . . X . . . . . . . . . . . . . . . X . . . . . . . . . . . X . X .',
        7: '. . . X . . . . . . X . . . . . . X . X . X . X . . . . . . . . . . . . . . . . X . . . . . . . . . . . . . . . X . . . . X . X',
        3: 'X . . . . . X . . . . . X . . . X . X . X . X . X . . . . . . . X . X . . . X . X . X . . . X . X . X . . . X . X . . . . . . .',
        8: '. . . X . . . . . . X . . . . . . X . X . X . X . . . . . . . . X . . X . X . . X . . X . X . . X . . X . X . . X . . . . . . .',
        4: '. . . . . . . . . . . . . . . . . . . . . . . . . . . . X . . . X . X . . . X . X . X . . . X . X . X . . . X . X . . . . . . .',
        9: '. . . . . . . . . . . . . . . . . . . . . . . . . . . . X . . . X . . X . X . . X . . X . X . . X . . X . X . . X . . . . . . .',
      })
    },
  ];
})();

// Injection automatique au démarrage (une seule fois, ne remplace pas les données existantes)
function seedDefaultData() {
  const KEY = 'batuque_rhythms';
  try {
    const existing = JSON.parse(localStorage.getItem(KEY)) || [];
    const existingIds = new Set(existing.map(r => r.id));
    const toAdd = DEFAULT_RHYTHMS.filter(r => !existingIds.has(r.id));
    if (toAdd.length > 0) {
      localStorage.setItem(KEY, JSON.stringify([...existing, ...toAdd]));
    }
  } catch (e) {
    console.warn('seedDefaultData:', e);
  }
}
