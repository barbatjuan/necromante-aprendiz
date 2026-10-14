const WALL = 20;
const DOOR_HALF = 70;

function borderWalls(w, h, door) {
  const walls = [
    { x: 0, y: 0, w, h: WALL, k: 'border' },
    { x: 0, y: h - WALL, w, h: WALL, k: 'border' },
    { x: 0, y: 0, w: WALL, h, k: 'border' },
  ];
  if (door) {
    walls.push({ x: w - WALL, y: 0, w: WALL, h: h / 2 - DOOR_HALF, k: 'border' });
    walls.push({ x: w - WALL, y: h / 2 + DOOR_HALF, w: WALL, h: h / 2 - DOOR_HALF, k: 'border' });
  } else {
    walls.push({ x: w - WALL, y: 0, w: WALL, h, k: 'border' });
  }
  return walls;
}

function resetEntities(allyTypes, px, py) {
  G.allies = [];
  G.corpses = [];
  G.orbs = [];
  G.projs = [];
  G.hazards = [];
  G.focus = null;
  G.frenzy = 0;
  G.fx.clear();
  G.victoryTimer = 0;
  G.player = new Player(px, py);
  G.player.name = 'Necromante';
  G.players = [G.player];
  allyTypes.forEach((type, k) => {
    const a = new Unit(type, px - 20 - (k % 3) * 22, py - 30 + Math.floor(k / 3) * 30 + (k % 2) * 16, 'ally');
    G.allies.push(a);
  });
  G.zoneAllies = allyTypes.slice();
}

G.currentAllyTypes = () => G.allies.filter(a => !a.dead).map(a => a.type);

G.loadZone = (i, allyTypes = []) => {
  const z = G.ZONES[i];
  G.zone = i;
  G.maxZone = Math.max(G.maxZone, i);
  const { w, h } = z;
  const hasDoor = i < G.ZONES.length - 1;
  G.world = {
    w, h, zone: z, lobby: false,
    walls: [...borderWalls(w, h, hasDoor), ...z.walls],
    door: hasDoor ? { x: w - WALL, y: h / 2 - DOOR_HALF, w: WALL, h: DOOR_HALF * 2 } : null,
    open: false,
    home: { x: 110, y: h / 2 - 120, r: 28 }, // portal de regreso (activo al limpiar)
  };
  G.enemies = z.spawns.map(([type, x, y]) =>
    type === 'paladin' ? new Boss(x, y)
      : type === 'reysol' ? new KingBoss(x, y)
        : type === 'arcangel' ? new ArchangelBoss(x, y)
          : new Unit(type, x, y, 'enemy'));
  resetEntities(allyTypes, 70, h / 2);
  G.save();
  G.banner(z.name, 2.5);
  if (i === 1 && !G.seen.q) {
    G.seen.q = true;
    setTimeout(() => G.banner('Nuevo hechizo: [Q] Explosión de Cadáver', 3), 2600);
  }
  if (i === 4 && !G.seen.f) {
    G.seen.f = true;
    setTimeout(() => G.banner('Nuevo hechizo: [F] Cosecha de Almas', 3), 2600);
  }
  if (i === 7 && !G.seen.v) {
    G.seen.v = true;
    setTimeout(() => G.banner('Nuevo hechizo: [V] Furia Necrótica', 3), 2600);
  }
};

G.loadLobby = (allyTypes = G.currentAllyTypes()) => {
  const L = G.LOBBY;
  G.zone = -1;
  G.world = {
    w: L.w, h: L.h, zone: L, lobby: true,
    walls: [...borderWalls(L.w, L.h, false), ...L.walls],
    door: null, open: false,
    portals: G.ZONES.map((z, i) => ({ i, x: L.portalX(i), y: L.portalY, r: 30, z })),
  };
  G.enemies = [new Dummy(L.dummy.x, L.dummy.y)];
  resetEntities(allyTypes, L.start.x, L.start.y);
  G.mentor = { x: L.mentor.x, y: L.mentor.y, face: Math.PI / 2 };
  G.save();
  G.banner(L.name, 2);
};

G.nextZone = () => G.loadZone(G.zone + 1, G.currentAllyTypes());

G.portalUnlocked = i => i <= G.maxZone;

G.lobbyInteract = () => {
  const p = G.player;
  if (G.U.dist(p, G.mentor) < 70) return G.talkMentor();
  if (G.nearAltar()) {
    G.state = 'book';
    G.seen.book = true;
  }
};

G.nearAltar = () => {
  if (!G.world.lobby) return false;
  const altar = G.LOBBY.walls.find(w => w.k === 'altar');
  return G.U.dist(G.player, { x: altar.x + altar.w / 2, y: altar.y + altar.h / 2 }) < 110;
};

// Walls + puerta cerrada + límites
G.collideWalls = u => {
  let hit = false;
  for (const w of G.world.walls) if (G.U.circleRect(u, w)) hit = true;
  if (G.world.door && !G.world.open && G.U.circleRect(u, G.world.door)) hit = true;
  if (hit) u.hitWall = true;
};

G.updateDoor = () => {
  const wd = G.world, p = G.player;
  if (wd.lobby) {
    for (const pt of wd.portals) {
      if (G.portalUnlocked(pt.i) && G.U.dist(p, pt) < pt.r) {
        G.loadZone(pt.i, G.currentAllyTypes());
        return;
      }
    }
    return;
  }
  if (!wd.open && G.enemiesAlive().length === 0) {
    wd.open = true;
    if (!G.cleared.includes(G.zone)) {
      G.cleared.push(G.zone);
      const bonus = 20 * (G.zone + 1);
      G.essence += bonus;
      G.banner(`Zona conquistada: +${bonus} esencia. Portal a la guarida abierto.`, 3.5);
    } else {
      G.banner('Zona conquistada. Portal a la guarida abierto.', 3);
    }
    if (wd.door) G.maxZone = Math.max(G.maxZone, G.zone + 1);
    G.save();
  }
  if (wd.open && G.U.dist(p, wd.home) < wd.home.r) {
    G.loadLobby();
    return;
  }
  if (wd.door && wd.open && p.x > wd.w - WALL - p.r - 4 && Math.abs(p.y - wd.h / 2) < DOOR_HALF) {
    G.nextZone();
  }
};

function drawPortal(ctx, x, y, r, color, active, label, sub) {
  ctx.save();
  if (active) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
  }
  ctx.fillStyle = active ? color : '#2a2a30';
  ctx.globalAlpha = active ? 0.35 : 0.8;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 1.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = active ? color : '#555';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 1.2, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (active) {
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const k = ((G.time * 0.8 + i / 3) % 1);
      ctx.globalAlpha = 1 - k;
      ctx.beginPath();
      ctx.ellipse(x, y, r * k, r * 1.2 * k, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else {
    // candado
    ctx.fillStyle = '#777';
    ctx.fillRect(x - 7, y - 2, 14, 11);
    ctx.strokeStyle = '#777';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y - 3, 5, Math.PI, 0);
    ctx.stroke();
  }
  ctx.restore();
  if (label) G.U.text(ctx, label, x, y + r * 1.2 + 14, 12, active ? '#e8e0ff' : '#777', 'center', true);
  if (sub) G.U.text(ctx, sub, x, y + r * 1.2 + 29, 10, active ? '#9d8bc8' : '#555', 'center');
}

G.drawWorld = ctx => {
  const wd = G.world, z = wd.zone;
  const T = 64;
  const x0 = Math.floor(G.cam.x / T), y0 = Math.floor(G.cam.y / T);
  for (let ty = y0; ty <= y0 + Math.ceil(G.H / T); ty++) {
    for (let tx = x0; tx <= x0 + Math.ceil(G.W / T); tx++) {
      const hsh = ((tx * 73856093) ^ (ty * 19349663)) & 3;
      ctx.fillStyle = hsh === 0 ? z.bg2 : z.bg;
      ctx.fillRect(tx * T, ty * T, T, T);
      if (hsh === 1) {
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.fillRect(tx * T + 10, ty * T + 20, 6, 3);
        ctx.fillRect(tx * T + 40, ty * T + 44, 4, 3);
      }
    }
  }
  if (z.stars) {
    // estrellas titilantes sobre el suelo celestial
    for (let i = 0; i < 90; i++) {
      const sx = (i * 397) % wd.w, sy = (i * 211 + (i % 7) * 53) % wd.h;
      if (sx < G.cam.x - 5 || sx > G.cam.x + G.W + 5 || sy < G.cam.y - 5 || sy > G.cam.y + G.H + 5) continue;
      ctx.globalAlpha = 0.3 + 0.3 * Math.sin(G.time * 2 + i);
      ctx.fillStyle = i % 3 ? '#dfe8ff' : '#ffe98a';
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;
  }
  if (wd.lobby) {
    const C = G.LOBBY.circle;
    ctx.strokeStyle = 'rgba(63,207,142,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(C.x, C.y, 120, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(C.x, C.y, 100, 0, Math.PI * 2); ctx.stroke();
    G.U.poly(ctx, C.x, C.y, 100, 5, G.time * 0.1 - Math.PI / 2);
    ctx.stroke();
    const ACT_COLORS = { 1: '#9d6bff', 2: '#ffb04a', 3: '#7ad8ff' };
    for (const pt of wd.portals) {
      const act = G.portalUnlocked(pt.i);
      const sub = G.cleared.includes(pt.i) ? '✓ conquistada' : act ? 'nueva' : 'bloqueada';
      drawPortal(ctx, pt.x, pt.y, pt.r, ACT_COLORS[pt.z.act], act, act ? pt.z.name : '???', sub);
    }
    G.U.text(ctx, 'ACTO I', G.LOBBY.portalX(1.5), 40, 13, ACT_COLORS[1], 'center', true);
    G.U.text(ctx, 'ACTO II', G.LOBBY.portalX(5), 40, 13, ACT_COLORS[2], 'center', true);
    G.U.text(ctx, 'ACTO III', G.LOBBY.portalX(8), 40, 13, ACT_COLORS[3], 'center', true);
  }
  // puerta
  if (wd.door) {
    const d = wd.door;
    if (wd.open) {
      ctx.fillStyle = `rgba(95,255,174,${0.35 + Math.sin(G.time * 4) * 0.15})`;
      ctx.fillRect(d.x - 10, d.y, d.w + 10, d.h);
    } else {
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.fillStyle = '#8a2a2a';
      for (let y = d.y + 8; y < d.y + d.h; y += 18) ctx.fillRect(d.x, y, d.w, 5);
    }
  }
  if (!wd.lobby && wd.open) drawPortal(ctx, wd.home.x, wd.home.y, wd.home.r, '#3fcf8e', true, 'Guarida');
  for (const w of wd.walls) drawWall(ctx, w);
};

function drawWall(ctx, w) {
  switch (w.k) {
    case 'house':
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(w.x + 6, w.y + 8, w.w, w.h);
      ctx.fillStyle = '#6a4a32';
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = '#5a3d2b';
      for (let x = w.x + 10; x < w.x + w.w; x += 20) ctx.fillRect(x, w.y + w.h * 0.5, 2, w.h * 0.5);
      ctx.fillStyle = '#7a2f25';
      ctx.fillRect(w.x - 6, w.y - 6, w.w + 12, w.h * 0.55);
      ctx.fillStyle = '#8f3a2e';
      for (let y = w.y; y < w.y + w.h * 0.5; y += 10) ctx.fillRect(w.x - 6, y, w.w + 12, 3);
      ctx.fillStyle = '#2a1a10';
      ctx.fillRect(w.x + w.w / 2 - 12, w.y + w.h - 30, 24, 30);
      ctx.fillStyle = '#e8c070';
      ctx.fillRect(w.x + 14, w.y + w.h - 34, 14, 12);
      break;
    case 'tree':
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(w.x + w.w / 2 + 8, w.y + w.h / 2 + 14, w.w * 0.7, w.w * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(w.x + w.w / 2 - 8, w.y + w.h / 2 - 8, 16, 26);
      ctx.fillStyle = '#16361c';
      ctx.beginPath();
      ctx.arc(w.x + w.w / 2, w.y + w.h / 2 - 10, w.w * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1f4a26';
      ctx.beginPath();
      ctx.arc(w.x + w.w / 2 - 8, w.y + w.h / 2 - 18, w.w * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a5a30';
      ctx.beginPath();
      ctx.arc(w.x + w.w / 2 - 12, w.y + w.h / 2 - 24, w.w * 0.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'rock':
      ctx.fillStyle = '#555a60';
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = '#1c2a3a';
      ctx.fillRect(w.x + 8, w.y + 8, w.w - 16, w.h - 16);
      ctx.fillStyle = 'rgba(120,160,220,0.4)';
      ctx.fillRect(w.x + 10, w.y + 10, 6, 3);
      break;
    case 'pillar':
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(w.x + 6, w.y + 8, w.w, w.h);
      ctx.fillStyle = '#5b5266';
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = '#6e6480';
      ctx.fillRect(w.x, w.y, w.w, 8);
      ctx.strokeStyle = '#8a7f99';
      ctx.lineWidth = 3;
      ctx.strokeRect(w.x + 4, w.y + 4, w.w - 8, w.h - 8);
      break;
    case 'wall':
      ctx.fillStyle = '#44444f';
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = '#383842';
      for (let y = w.y; y < w.y + w.h; y += 20) ctx.fillRect(w.x, y, w.w, 2);
      ctx.fillStyle = '#50505c';
      ctx.fillRect(w.x, w.y, 4, w.h);
      break;
    case 'shelf':
      ctx.fillStyle = '#3a2416';
      ctx.fillRect(w.x, w.y, w.w, w.h);
      {
        const cols = ['#7a2a2a', '#2a4a7a', '#4a7a2a', '#7a6a2a', '#5a2a6a'];
        const horiz = w.w > w.h;
        const n = Math.floor((horiz ? w.w : w.h) / 8);
        for (let i = 0; i < n; i++) {
          ctx.fillStyle = cols[(i * 7 + (w.x | 0)) % cols.length];
          if (horiz) ctx.fillRect(w.x + 2 + i * 8, w.y + 4, 6, w.h - 8);
          else ctx.fillRect(w.x + 4, w.y + 2 + i * 8, w.w - 8, 6);
        }
      }
      break;
    case 'altar': {
      const cx = w.x + w.w / 2;
      ctx.fillStyle = '#2a2230';
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = '#3a3040';
      ctx.fillRect(w.x - 4, w.y - 6, w.w + 8, 10);
      // libro abierto sobre el altar
      ctx.fillStyle = '#d8c9a3';
      ctx.fillRect(cx - 16, w.y - 14, 15, 11);
      ctx.fillRect(cx + 1, w.y - 14, 15, 11);
      ctx.shadowColor = '#3fcf8e'; ctx.shadowBlur = 15;
      ctx.fillStyle = `rgba(63,207,142,${0.6 + Math.sin(G.time * 3) * 0.3})`;
      ctx.fillRect(cx - 12, w.y - 11, 8, 2);
      ctx.fillRect(cx + 4, w.y - 8, 8, 2);
      ctx.shadowBlur = 0;
      for (const sx of [w.x + 6, w.x + w.w - 12]) drawFlame(ctx, sx + 3, w.y - 8);
      break;
    }
    case 'sarco':
      ctx.fillStyle = '#3a3440';
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = '#4a4452';
      ctx.fillRect(w.x + 4, w.y + 4, w.w - 8, w.h - 8);
      ctx.fillStyle = '#2a2430';
      ctx.fillRect(w.x + w.w / 2 - 2, w.y + 7, 4, w.h - 14);
      ctx.fillRect(w.x + w.w / 2 - 9, w.y + 13, 18, 4);
      break;
    case 'cloud': {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(w.x + 8, w.y + 14, w.w, w.h * 0.8);
      const n = Math.max(3, Math.round(w.w / 40));
      for (let i = 0; i < n; i++) {
        const cx = w.x + ((i + 0.5) / n) * w.w;
        const cy = w.y + w.h * 0.5 + Math.sin(i * 2.3) * w.h * 0.15;
        const rr = Math.min(w.h * 0.55, (w.w / n) * 0.9);
        ctx.fillStyle = '#c8d4ec';
        ctx.beginPath(); ctx.arc(cx, cy + 4, rr, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#eef3ff';
        ctx.beginPath(); ctx.arc(cx - 3, cy - 2, rr * 0.8, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'crystal':
    case 'crystalwall': {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(w.x + 6, w.y + 8, w.w, w.h);
      ctx.shadowColor = '#7ad8ff';
      ctx.shadowBlur = 12 + Math.sin(G.time * 2 + w.x) * 4;
      ctx.fillStyle = '#5aa8d8';
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#8ad8ff';
      const step = w.k === 'crystal' ? w.w / 3 : 25;
      for (let yy = w.y; yy < w.y + w.h; yy += step) {
        for (let xx = w.x; xx < w.x + w.w; xx += step) {
          ctx.beginPath();
          ctx.moveTo(xx + step / 2, yy + 2);
          ctx.lineTo(xx + step - 2, yy + step / 2);
          ctx.lineTo(xx + step / 2, yy + step - 2);
          ctx.lineTo(xx + 2, yy + step / 2);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(w.x + 3, w.y + 3, 3, w.h - 6);
      break;
    }
    case 'candle':
      ctx.fillStyle = '#3a3040';
      ctx.fillRect(w.x, w.y + 10, w.w, w.h - 10);
      ctx.fillStyle = '#e8e0c8';
      ctx.fillRect(w.x + 10, w.y, 10, 14);
      drawFlame(ctx, w.x + 15, w.y - 2);
      break;
    default:
      ctx.fillStyle = '#15121b';
      ctx.fillRect(w.x, w.y, w.w, w.h);
  }
}

function drawFlame(ctx, x, y) {
  const f = Math.sin(G.time * 12 + x) * 1.5;
  ctx.shadowColor = '#7dffb8'; ctx.shadowBlur = 14;
  ctx.fillStyle = '#5fffae';
  ctx.beginPath();
  ctx.ellipse(x, y - 3, 3, 6 + f, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e0fff0';
  ctx.beginPath();
  ctx.ellipse(x, y - 1, 1.5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

G.drawMentor = ctx => {
  const m = G.mentor;
  G.S.shadow(ctx, m.x, m.y, 15);
  const face = G.U.angle(m, G.player);
  G.S.humanoid(ctx, { x: m.x, y: m.y, s: 1.2, face, look: G.MENTOR_LOOK, seed: 3 });
  if (G.U.dist(G.player, m) < 70 && G.state === 'play') {
    G.U.text(ctx, '[E] Hablar', m.x, m.y - 44, 13, '#7dffb8', 'center', true);
  } else {
    G.U.text(ctx, 'Maestro Mortis', m.x, m.y - 44, 12, '#9d8bc8', 'center', true);
  }
};
