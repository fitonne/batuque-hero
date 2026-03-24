const INSTRUMENTS = [
  { id: 'surdo1',       name: 'Surdo 1',      shortName: 'S1',   color: '#e74c3c' },  // 0
  { id: 'surdo2',       name: 'Surdo 2',       shortName: 'S2',   color: '#e67e22' },  // 1
  { id: 'surdo3',       name: 'Surdo 3 D',     shortName: 'S3D',  color: '#f1c40f' },  // 2
  { id: 'caixa',        name: 'Caixa D',        shortName: 'CXD',  color: '#2ecc71' },  // 3
  { id: 'repinique',    name: 'Repinique D',    shortName: 'RPD',  color: '#3498db' },  // 4
  { id: 'agogo_low',    name: 'Agogô ↓',        shortName: 'AG↓',  color: '#9b59b6' },  // 5
  { id: 'agogo_high',   name: 'Agogô ↑',        shortName: 'AG↑',  color: '#e91e63' },  // 6
  { id: 'surdo3_g',     name: 'Surdo 3 G',      shortName: 'S3G',  color: '#c9a800' },  // 7 (nouveau)
  { id: 'caixa_g',      name: 'Caixa G',         shortName: 'CXG',  color: '#27ae60' },  // 8 (nouveau)
  { id: 'repinique_g',  name: 'Repinique G',    shortName: 'RPG',  color: '#2471a3' },  // 9 (nouveau)
];

// Groupes d'instruments pour le sélecteur de jeu.
// Surdo 1+2     = 1 bouton, 2 colonnes (S1 gauche, S2 droite)
// Surdo 3 D+G   = 1 bouton, 2 colonnes (D gauche, G droite)
// Caixa D+G     = 1 bouton, 2 colonnes (D gauche, G droite)
// Repinique D+G = 1 bouton, 2 colonnes (D gauche, G droite)
// Agogô ↓+↑    = 1 bouton, 2 colonnes (↓ gauche, ↑ droite)
const INSTRUMENT_GROUPS = [
  {
    id: 'surdos12',
    name: 'Surdo 1 & 2',
    shortName: 'S1·S2',
    lanes: [0, 1],
    color: '#e74c3c',
  },
  {
    id: 'surdo3',
    name: 'Surdo 3',
    shortName: 'S3',
    lanes: [2, 7],          // D (col gauche), G (col droite)
    color: '#f1c40f',
  },
  {
    id: 'caixa',
    name: 'Caixa',
    shortName: 'CX',
    lanes: [3, 8],          // D (col gauche), G (col droite)
    color: '#2ecc71',
  },
  {
    id: 'repinique',
    name: 'Repinique',
    shortName: 'RP',
    lanes: [4, 9],          // D (col gauche), G (col droite)
    color: '#3498db',
  },
  {
    id: 'agogo',
    name: 'Agogô',
    shortName: 'AG↓↑',
    lanes: [5, 6],
    color: '#9b59b6',
  },
];
