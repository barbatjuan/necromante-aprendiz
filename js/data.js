// Datos del juego: tipos de enemigo, zonas y mejoras.
window.G = {};
G.W = 960;
G.H = 640;
G.DEBUG = location.search.includes('debug');

const SKIN = '#e0b48a';

// r: radio, range: alcance extra de golpe (melee) o distancia de disparo (ranged)
// essence: esencia que suelta al morir, cost: esencia para revivirlo
// look: apariencia del sprite humanoide (ver sprites.js)
G.ENEMIES = {
  aldeano: {
    name: 'Aldeano', r: 12, hp: 20, dmg: 4, speed: 70, range: 8, cd: 1.0,
    color: '#c9a27a', essence: 4, cost: 5, sight: 240,
    look: { skin: SKIN, shirt: '#8a6a4a', pants: '#4a3a2a', hat: 'hair', hair: '#5a3a1a', weapon: 'pitchfork' },
  },
  guardia: {
    name: 'Guardia', r: 15, hp: 45, dmg: 8, speed: 85, range: 10, cd: 0.9,
    color: '#8a9bb0', essence: 7, cost: 12, sight: 300, armor: 0.3,
    look: { skin: SKIN, shirt: '#5a6a88', pants: '#33334a', hat: 'helmet', metal: '#a8b4c4', weapon: 'sword', shield: '#7a5a3a' },
  },
  arquero: {
    name: 'Arquero', r: 13, hp: 30, dmg: 7, speed: 90, range: 260, cd: 1.4,
    color: '#6fae5a', essence: 8, cost: 15, sight: 380, ranged: true, projSpeed: 340, keepDist: 170,
    look: { skin: '#d8a878', shirt: '#4a7a3a', pants: '#3a4a2a', hat: 'hood', hood: '#3a6a2a', weapon: 'bow' },
  },
  bruto: {
    name: 'Bruto', r: 22, hp: 140, dmg: 18, speed: 55, range: 14, cd: 1.8,
    color: '#a0603a', essence: 15, cost: 30, sight: 300, aoe: 64,
    look: { skin: '#c89070', shirt: '#6a4a2a', pants: '#3a2a1a', hat: 'bald', weapon: 'club', beard: '#4a2a1a' },
  },
  sacerdote: {
    name: 'Sacerdote', r: 14, hp: 40, dmg: 6, speed: 75, range: 220, cd: 1.6,
    color: '#e8c95a', essence: 12, cost: 25, sight: 360, ranged: true, projSpeed: 300, keepDist: 150,
    healer: true, holy: true,
    look: { skin: '#f0c8a0', shirt: '#f0e8d0', robe: true, trim: '#e8c95a', hat: 'mitre', weapon: 'holystaff' },
  },
  capitan: {
    name: 'Capitán de la Guardia', r: 20, hp: 420, dmg: 16, speed: 100, range: 12, cd: 0.8,
    color: '#5a6f99', essence: 45, cost: 60, sight: 420, armor: 0.3, miniboss: true, dash: true,
    look: { skin: SKIN, shirt: '#3a4a7a', pants: '#2a2a3a', hat: 'plume', metal: '#c0c8d8', plume: '#c03030', weapon: 'sword', shield: '#3a4a8a', cape: '#8a2020' },
  },
  paladin: {
    name: 'Paladín Sagrado', r: 26, hp: 1500, dmg: 22, speed: 105, range: 18, cd: 1.1,
    color: '#f0e6c0', essence: 120, cost: 0, sight: 380, holy: true,
    look: { skin: '#f0c8a0', shirt: '#e8e0c0', pants: '#b8a870', hat: 'greathelm', metal: '#e8d890', weapon: 'greatsword', cape: '#f0f0ff', halo: true },
  },
  // ---- Acto II ----
  caballero: {
    name: 'Caballero', r: 17, hp: 95, dmg: 14, speed: 95, range: 12, cd: 1.1,
    color: '#8a2a2a', essence: 13, cost: 28, sight: 340, armor: 0.35, dash: true,
    look: { skin: SKIN, shirt: '#8a2a2a', pants: '#3a2a2a', hat: 'greathelm', metal: '#b0b8c8', weapon: 'lance', shield: '#8a2a2a' },
  },
  mago: {
    name: 'Mago de Fuego', r: 13, hp: 38, dmg: 14, speed: 80, range: 280, cd: 2.2,
    color: '#3a3aa0', essence: 13, cost: 26, sight: 380, ranged: true, projSpeed: 260, keepDist: 200, fire: 50,
    look: { skin: SKIN, shirt: '#3a3aa0', robe: true, trim: '#e8a030', hat: 'wizard', hatc: '#2a2a80', beard: '#dddddd', weapon: 'firestaff' },
  },
  inquisidor: {
    name: 'Inquisidor', r: 16, hp: 85, dmg: 12, speed: 100, range: 10, cd: 0.9,
    color: '#6a1a1a', essence: 15, cost: 32, sight: 340, armor: 0.15, holy: true,
    look: { skin: SKIN, shirt: '#6a1a1a', robe: true, trim: '#e8c95a', hat: 'hood', hood: '#3a0a0a', weapon: 'mace' },
  },
  angel: {
    name: 'Ángel', r: 15, hp: 75, dmg: 10, speed: 120, range: 260, cd: 1.2,
    color: '#ffffff', essence: 18, cost: 40, sight: 400, ranged: true, projSpeed: 330, keepDist: 170, holy: true,
    look: { skin: '#fff0e0', shirt: '#ffffff', robe: true, trim: '#e8c95a', hat: 'hair', hair: '#f0d870', weapon: 'holystaff', wings: true, halo: true, float: true },
  },
  archimago: {
    name: 'Archimago Ignis', r: 19, hp: 650, dmg: 16, speed: 90, range: 300, cd: 1.1,
    color: '#6a1a8a', essence: 60, cost: 70, sight: 440, ranged: true, projSpeed: 280, keepDist: 220,
    fire: 60, spread: 3, blink: true, miniboss: true,
    look: { skin: SKIN, shirt: '#6a1a8a', robe: true, trim: '#e8c95a', hat: 'wizard', hatc: '#4a0a6a', beard: '#eeeeee', weapon: 'firestaff', cape: '#2a0a3a' },
  },
  reysol: {
    name: 'Rey Sol Aurelio', r: 28, hp: 3200, dmg: 26, speed: 110, range: 20, cd: 1.0,
    color: '#e8b830', essence: 0, cost: 0, sight: 420, holy: true,
    look: { skin: '#f0c8a0', shirt: '#e8b830', robe: true, trim: '#ffffff', hat: 'crown', hair: '#f0d870', beard: '#f0d870', weapon: 'greatsword', cape: '#c02020', halo: true },
  },
  // ---- Acto III ----
  querubin: {
    name: 'Querubín', r: 10, hp: 30, dmg: 7, speed: 150, range: 6, cd: 0.7,
    color: '#ffe8d0', essence: 7, cost: 16, sight: 360, holy: true,
    look: { skin: '#ffe8d0', shirt: '#ffffff', robe: true, trim: '#ffd84a', hat: 'hair', hair: '#ffd84a', weapon: 'sword', wings: true, float: true, halo: true },
  },
  centinela: {
    name: 'Centinela de Luz', r: 22, hp: 240, dmg: 24, speed: 62, range: 14, cd: 2.0,
    color: '#c8d0e8', essence: 24, cost: 48, sight: 320, armor: 0.4, holy: true, aoe: 72,
    look: { skin: '#f0d8c0', shirt: '#c8d0e8', pants: '#8890a8', hat: 'greathelm', metal: '#e8e8f8', weapon: 'greatsword', shield: '#e8d890', halo: true },
  },
  serafin: {
    name: 'Serafín', r: 15, hp: 95, dmg: 11, speed: 110, range: 280, cd: 1.6,
    color: '#ffb070', essence: 22, cost: 46, sight: 400, ranged: true, projSpeed: 300, keepDist: 190, holy: true, spread: 3,
    look: { skin: '#fff4e8', shirt: '#ffd8a0', robe: true, trim: '#ff8a4a', hat: 'hair', hair: '#ff9a4a', weapon: 'holystaff', wings: true, float: true, halo: true },
  },
  juez: {
    name: 'Juez Celestial Uriel', r: 22, hp: 1200, dmg: 22, speed: 115, range: 14, cd: 1.0,
    color: '#ffd84a', essence: 90, cost: 95, sight: 440, armor: 0.25, holy: true, aoe: 80, dash: true, miniboss: true,
    look: { skin: '#f0d8c0', shirt: '#f0f0ff', pants: '#c0c8e0', hat: 'greathelm', metal: '#ffd84a', weapon: 'greatsword', cape: '#4a7aff', wings: true, halo: true },
  },
  arcangel: {
    name: 'Arcángel Seraphiel', r: 30, hp: 5200, dmg: 30, speed: 120, range: 22, cd: 1.0,
    color: '#fff8e0', essence: 0, cost: 0, sight: 440, holy: true,
    look: { skin: '#fff4e8', shirt: '#f8f8ff', robe: true, trim: '#ffd84a', hat: 'crown', hair: '#ffe070', weapon: 'greatsword', cape: '#ffd84a', wings: true, halo: true },
  },
  muneco: {
    name: 'Muñeco de práctica', r: 14, hp: 200, dmg: 0, speed: 0, range: 0, cd: 99,
    color: '#c8a860', essence: 0, cost: 0, sight: 0,
  },
};

const trees = pts => pts.map(([x, y]) => ({ x, y, w: 56, h: 56, k: 'tree' }));

// Zonas: walls con k = tipo visual (house, tree, rock, wall, pillar, shelf)
G.ZONES = [
  {
    name: 'Aldea Olvidada', act: 1, w: 1600, h: 1000, bg: '#2f3b2a', bg2: '#344230',
    walls: [
      { x: 350, y: 150, w: 160, h: 120, k: 'house' },
      { x: 350, y: 700, w: 160, h: 130, k: 'house' },
      { x: 760, y: 360, w: 120, h: 190, k: 'house' },
      { x: 1100, y: 150, w: 180, h: 120, k: 'house' },
      { x: 1100, y: 740, w: 180, h: 120, k: 'house' },
      { x: 990, y: 480, w: 40, h: 40, k: 'rock' },
    ],
    spawns: [
      ['aldeano', 600, 300], ['aldeano', 640, 340], ['aldeano', 600, 640],
      ['aldeano', 900, 250], ['aldeano', 950, 820], ['aldeano', 1300, 480], ['aldeano', 1340, 560],
      ['guardia', 1200, 600], ['guardia', 700, 820], ['guardia', 1450, 380],
    ],
  },
  {
    name: 'Bosque de los Susurros', act: 1, w: 1800, h: 1200, bg: '#1d2b1d', bg2: '#213221',
    walls: trees([
      [300, 150], [500, 450], [300, 820], [650, 150], [850, 720], [900, 1020], [1000, 300],
      [1300, 380], [1250, 820], [1550, 250], [1600, 920], [700, 560], [1450, 1060], [420, 1060],
      [1150, 560], [180, 380],
    ]),
    spawns: [
      ['aldeano', 420, 300], ['aldeano', 440, 920], ['aldeano', 900, 420],
      ['guardia', 600, 640], ['guardia', 1100, 700], ['guardia', 1150, 460], ['guardia', 1500, 520],
      ['arquero', 720, 300], ['arquero', 760, 940], ['arquero', 1220, 200], ['arquero', 1320, 1000],
      ['arquero', 1560, 640],
    ],
  },
  {
    name: 'Fortaleza del Alba', act: 1, w: 2000, h: 1200, bg: '#2a2a30', bg2: '#2f2f36',
    walls: [
      { x: 500, y: 0, w: 40, h: 440, k: 'wall' },
      { x: 500, y: 760, w: 40, h: 440, k: 'wall' },
      { x: 1000, y: 300, w: 40, h: 600, k: 'wall' },
      { x: 1500, y: 0, w: 40, h: 440, k: 'wall' },
      { x: 1500, y: 760, w: 40, h: 440, k: 'wall' },
      { x: 250, y: 250, w: 40, h: 40, k: 'pillar' },
      { x: 250, y: 910, w: 40, h: 40, k: 'pillar' },
      { x: 1250, y: 580, w: 40, h: 40, k: 'pillar' },
    ],
    spawns: [
      ['guardia', 320, 380], ['guardia', 320, 820], ['guardia', 760, 520], ['guardia', 760, 700],
      ['arquero', 800, 200], ['arquero', 800, 1000], ['arquero', 1260, 200], ['arquero', 1260, 1000],
      ['bruto', 760, 610], ['bruto', 1300, 420],
      ['sacerdote', 1200, 760], ['sacerdote', 1700, 420], ['sacerdote', 1700, 800],
      ['bruto', 1780, 300], ['capitan', 1780, 600],
    ],
  },
  {
    name: 'Catedral de la Luz', act: 1, w: 1400, h: 1000, bg: '#2c2533', bg2: '#322a3a',
    walls: [
      { x: 400, y: 240, w: 60, h: 60, k: 'pillar' },
      { x: 400, y: 700, w: 60, h: 60, k: 'pillar' },
      { x: 900, y: 240, w: 60, h: 60, k: 'pillar' },
      { x: 900, y: 700, w: 60, h: 60, k: 'pillar' },
    ],
    spawns: [['paladin', 1120, 500]],
    boss: true,
  },
  {
    name: 'Murallas de Solaria', act: 2, w: 2100, h: 1200, bg: '#3a3528', bg2: '#403a2c',
    walls: [
      { x: 420, y: 160, w: 170, h: 130, k: 'house' },
      { x: 420, y: 880, w: 170, h: 130, k: 'house' },
      { x: 800, y: 0, w: 40, h: 480, k: 'wall' },
      { x: 800, y: 720, w: 40, h: 480, k: 'wall' },
      { x: 1100, y: 420, w: 60, h: 60, k: 'pillar' },
      { x: 1100, y: 720, w: 60, h: 60, k: 'pillar' },
      { x: 1400, y: 180, w: 180, h: 130, k: 'house' },
      { x: 1400, y: 880, w: 180, h: 130, k: 'house' },
      { x: 1680, y: 560, w: 60, h: 60, k: 'rock' },
    ],
    spawns: [
      ['guardia', 350, 480], ['guardia', 350, 720], ['arquero', 650, 360], ['arquero', 650, 840],
      ['caballero', 1000, 600], ['caballero', 1300, 450], ['caballero', 1300, 760],
      ['mago', 1250, 250], ['mago', 1250, 1000], ['sacerdote', 1600, 450], ['sacerdote', 1600, 760],
      ['guardia', 1850, 400], ['guardia', 1850, 800], ['caballero', 1900, 600],
    ],
  },
  {
    name: 'Torre Arcana', act: 2, w: 1900, h: 1300, bg: '#241f3a', bg2: '#2a2444',
    walls: [
      { x: 60, y: 150, w: 260, h: 34, k: 'shelf' },
      { x: 60, y: 1116, w: 260, h: 34, k: 'shelf' },
      { x: 500, y: 300, w: 60, h: 60, k: 'pillar' },
      { x: 500, y: 940, w: 60, h: 60, k: 'pillar' },
      { x: 760, y: 600, w: 60, h: 100, k: 'pillar' },
      { x: 1000, y: 0, w: 40, h: 520, k: 'wall' },
      { x: 1000, y: 780, w: 40, h: 520, k: 'wall' },
      { x: 1250, y: 250, w: 280, h: 34, k: 'shelf' },
      { x: 1250, y: 1016, w: 280, h: 34, k: 'shelf' },
      { x: 1400, y: 620, w: 60, h: 60, k: 'pillar' },
    ],
    spawns: [
      ['mago', 420, 450], ['mago', 420, 850], ['inquisidor', 650, 500], ['inquisidor', 650, 800],
      ['sacerdote', 880, 300], ['sacerdote', 880, 1000], ['mago', 1200, 450], ['mago', 1200, 850],
      ['inquisidor', 1300, 650], ['angel', 1600, 350], ['angel', 1600, 950], ['archimago', 1720, 650],
    ],
  },
  {
    name: 'Trono del Rey Sol', act: 2, w: 1600, h: 1100, bg: '#3e3218', bg2: '#46391c',
    walls: [
      { x: 380, y: 240, w: 60, h: 60, k: 'pillar' },
      { x: 380, y: 800, w: 60, h: 60, k: 'pillar' },
      { x: 780, y: 240, w: 60, h: 60, k: 'pillar' },
      { x: 780, y: 800, w: 60, h: 60, k: 'pillar' },
      { x: 1180, y: 240, w: 60, h: 60, k: 'pillar' },
      { x: 1180, y: 800, w: 60, h: 60, k: 'pillar' },
    ],
    spawns: [['reysol', 1300, 550]],
    boss: true,
  },
  {
    name: 'Escalera Celestial', act: 3, w: 2100, h: 1200, bg: '#28314a', bg2: '#2d3752', stars: true,
    walls: [
      { x: 380, y: 140, w: 180, h: 90, k: 'cloud' },
      { x: 380, y: 960, w: 180, h: 90, k: 'cloud' },
      { x: 760, y: 420, w: 140, h: 110, k: 'cloud' },
      { x: 760, y: 700, w: 140, h: 90, k: 'cloud' },
      { x: 1150, y: 180, w: 200, h: 100, k: 'cloud' },
      { x: 1150, y: 900, w: 200, h: 100, k: 'cloud' },
      { x: 1500, y: 520, w: 120, h: 160, k: 'cloud' },
      { x: 1780, y: 250, w: 150, h: 90, k: 'cloud' },
      { x: 1780, y: 880, w: 150, h: 90, k: 'cloud' },
    ],
    spawns: [
      ['querubin', 500, 520], ['querubin', 540, 600], ['querubin', 500, 680],
      ['angel', 700, 250], ['angel', 700, 950], ['inquisidor', 1000, 560], ['inquisidor', 1000, 660],
      ['serafin', 1300, 400], ['serafin', 1300, 800], ['centinela', 1400, 600],
      ['querubin', 1650, 350], ['querubin', 1690, 400], ['querubin', 1650, 820], ['querubin', 1690, 870],
      ['centinela', 1900, 600], ['angel', 1950, 450],
    ],
  },
  {
    name: 'Santuario de Cristal', act: 3, w: 2200, h: 1300, bg: '#1f2a3a', bg2: '#243246', stars: true,
    walls: [
      { x: 350, y: 300, w: 70, h: 70, k: 'crystal' },
      { x: 350, y: 930, w: 70, h: 70, k: 'crystal' },
      { x: 650, y: 0, w: 50, h: 500, k: 'crystalwall' },
      { x: 650, y: 800, w: 50, h: 500, k: 'crystalwall' },
      { x: 950, y: 600, w: 90, h: 90, k: 'crystal' },
      { x: 1250, y: 250, w: 70, h: 70, k: 'crystal' },
      { x: 1250, y: 980, w: 70, h: 70, k: 'crystal' },
      { x: 1500, y: 200, w: 50, h: 380, k: 'crystalwall' },
      { x: 1500, y: 720, w: 50, h: 380, k: 'crystalwall' },
      { x: 1850, y: 360, w: 60, h: 60, k: 'crystal' },
      { x: 1850, y: 880, w: 60, h: 60, k: 'crystal' },
    ],
    spawns: [
      ['serafin', 480, 500], ['serafin', 480, 800], ['querubin', 550, 640], ['querubin', 590, 680],
      ['centinela', 850, 400], ['centinela', 850, 900], ['angel', 1100, 300], ['angel', 1100, 1000],
      ['sacerdote', 1150, 640], ['querubin', 1350, 600], ['querubin', 1390, 660], ['querubin', 1350, 720],
      ['serafin', 1400, 450], ['centinela', 1700, 650], ['serafin', 1750, 300], ['serafin', 1750, 1000],
      ['juez', 2000, 650],
    ],
  },
  {
    name: 'Trono Celestial', act: 3, w: 1700, h: 1150, bg: '#343f5a', bg2: '#3a4664', stars: true,
    walls: [
      { x: 360, y: 230, w: 70, h: 70, k: 'crystal' },
      { x: 360, y: 850, w: 70, h: 70, k: 'crystal' },
      { x: 820, y: 180, w: 70, h: 70, k: 'crystal' },
      { x: 820, y: 900, w: 70, h: 70, k: 'crystal' },
      { x: 1280, y: 230, w: 70, h: 70, k: 'crystal' },
      { x: 1280, y: 850, w: 70, h: 70, k: 'crystal' },
    ],
    spawns: [['arcangel', 1350, 575]],
    boss: true,
  },
];

// Guarida del necromante (lobby)
G.LOBBY = {
  name: 'Guarida del Necromante', w: 1600, h: 800, bg: '#1c1622', bg2: '#211a28',
  walls: [
    { x: 20, y: 250, w: 34, h: 300, k: 'shelf' },
    { x: 1546, y: 250, w: 34, h: 300, k: 'shelf' },
    { x: 330, y: 380, w: 100, h: 50, k: 'altar' },
    { x: 1150, y: 640, w: 80, h: 36, k: 'sarco' },
    { x: 1280, y: 640, w: 80, h: 36, k: 'sarco' },
    { x: 200, y: 640, w: 80, h: 36, k: 'sarco' },
    { x: 640, y: 520, w: 30, h: 30, k: 'candle' },
    { x: 930, y: 520, w: 30, h: 30, k: 'candle' },
  ],
  start: { x: 800, y: 660 },
  mentor: { x: 800, y: 330 },
  dummy: { x: 1250, y: 420 },
  circle: { x: 800, y: 480 },
  portalY: 120,
  portalX: i => 130 + i * 148,
};

G.UPGRADES = [
  { id: 'legion', name: 'Legión', desc: '+1 siervo máximo', base: 25, max: 10 },
  { id: 'vigor', name: 'Vigor Profano', desc: '+20% vida y daño de siervos', base: 20, max: 10 },
  { id: 'hoz', name: 'Hoz Afilada', desc: '+25% daño de tu hoz', base: 15, max: 10 },
  { id: 'carne', name: 'Carne Robada', desc: '+20 vida máxima', base: 15, max: 10 },
  { id: 'pacto', name: 'Pacto Barato', desc: '-10% costo de alzar muertos', base: 30, max: 4 },
  { id: 'hechizo', name: 'Magia Negra', desc: '+30% daño de Explosión y Cosecha', base: 25, max: 6 },
  { id: 'alma', name: 'Avaricia de Almas', desc: '+20% esencia obtenida', base: 40, max: 5 },
  { id: 'coraza', name: 'Coraza de Hueso', desc: 'Siervos reciben -8% de daño', base: 60, max: 5 },
];

G.upCost = u => Math.round(u.base * Math.pow(1.55, G.up[u.id]));
G.maxAllies = () => 2 + G.up.legion;
G.allyMult = () => 1 + 0.2 * G.up.vigor;
G.meleeDmg = () => 12 * (1 + 0.25 * G.up.hoz);
G.playerMaxHp = () => 100 + 20 * G.up.carne;
G.reviveCost = t => Math.max(1, Math.round(t.cost * (1 - 0.1 * G.up.pacto)));
G.spellMult = () => 1 + 0.3 * G.up.hechizo;
G.essenceMult = () => 1 + 0.2 * G.up.alma;
G.qUnlocked = () => G.maxZone >= 1;
G.fUnlocked = () => G.maxZone >= 4;
G.vUnlocked = () => G.maxZone >= 7;
