const SAVE_KEY = 'necromante_aprendiz_save';

G.state = 'title';
G.time = 0;
G.shake = 0;
G.cam = { x: 0, y: 0 };
G.mw = { x: 0, y: 0 };

G.resetProgress = () => {
  G.up = {};
  for (const u of G.UPGRADES) G.up[u.id] = 0;
  G.essence = 0;
  G.stats = { kills: 0, raised: 0 };
  G.seen = { book: false, q: false, f: false, v: false, intro: false, victory: false };
  G.frenzy = 0;
  G.zoneAllies = [];
  G.zone = -1;
  G.maxZone = 0;
  G.cleared = [];
};
G.resetProgress();

G.save = () => {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 2, maxZone: G.maxZone, cleared: G.cleared, up: G.up, essence: G.essence,
      stats: G.stats, seen: G.seen, allies: G.zoneAllies,
    }));
  } catch (e) { /* sin almacenamiento: se juega igual */ }
};

G.loadSave = () => {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY));
  } catch (e) {
    return null;
  }
};

G.hasSave = () => !!G.loadSave();

G.clearSave = () => {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* nada */ }
};

G.startGame = cont => {
  G.resetProgress();
  const s = cont ? G.loadSave() : null;
  if (s) {
    Object.assign(G.up, s.up);
    G.essence = s.essence || 0;
    Object.assign(G.stats, s.stats);
    Object.assign(G.seen, s.seen);
    // partidas de la versión anterior guardaban "zone"
    G.maxZone = s.maxZone ?? s.zone ?? 0;
    G.cleared = s.cleared || [];
    if (s.zone !== undefined && s.maxZone === undefined) G.seen.intro = true;
    // zonas que antes eran finales ahora tienen continuación
    for (const z of G.cleared) if (z < G.ZONES.length - 1) G.maxZone = Math.max(G.maxZone, z + 1);
    G.maxZone = G.U.clamp(G.maxZone | 0, 0, G.ZONES.length - 1);
    G.loadLobby((s.allies || []).filter(t => G.ENEMIES[t] && G.ENEMIES[t].look));
  } else {
    G.clearSave();
    G.loadLobby([]);
  }
  G.state = 'play';
  if (!G.seen.intro) G.talkMentor();
};

G.retryZone = () => {
  G.essence = Math.floor(G.essence / 2);
  G.loadZone(G.zone, G.zoneAllies);
  G.state = 'play';
};

G.fleeToLobby = (types = G.zoneAllies) => {
  G.loadLobby(types);
  G.state = 'play';
};

// Empuja unidades superpuestas entre sí (más pesadas se mueven menos)
function separate() {
  const all = [G.player, ...G.allies, ...G.enemies].filter(u => !u.dead);
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const min = a.r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min || d2 === 0) continue;
      const d = Math.sqrt(d2), ov = min - d;
      const heavy = u => u.boss || u.dummy;
      const wa = heavy(a) ? 1e4 : a.r * a.r, wb = heavy(b) ? 1e4 : b.r * b.r;
      const ka = wb / (wa + wb), kb = wa / (wa + wb);
      const nx = dx / d, ny = dy / d;
      a.x -= nx * ov * ka; a.y -= ny * ov * ka;
      b.x += nx * ov * kb; b.y += ny * ov * kb;
    }
  }
  for (const u of all) {
    G.collideWalls(u);
    G.animate(u);
  }
}

function commandAllies() {
  const e = G.nearest(G.mw, G.enemiesAlive(), 50);
  if (e) {
    G.focus = e;
    e.alert && e.alert();
    G.banner('Siervos: ¡atacad!', 1);
  } else {
    G.focus = null;
    G.banner('Siervos: seguidme', 1);
  }
}

function updatePlay(dt) {
  if (G.wasPressed('escape')) { G.state = 'paused'; return; }
  if (G.wasPressed('b') || G.wasPressed('tab')) {
    G.state = 'book';
    G.seen.book = true;
    return;
  }
  if (G.wasPressed('r')) commandAllies();
  if (G.DEBUG) {
    if (G.wasPressed('f8')) G.essence += 200;
    if (G.wasPressed('f9')) {
      if (G.world.lobby) G.loadZone(G.maxZone, G.currentAllyTypes());
      else if (G.zone < G.ZONES.length - 1) G.nextZone();
    }
  }

  G.player.update(dt);
  if (G.state !== 'play') return; // abrió diálogo o libro
  for (const a of G.allies) if (!a.dead) a.update(dt);
  for (const e of G.enemies) if (!e.dead) e.update(dt);
  separate();
  for (const p of G.projs) p.update(dt);
  for (const o of G.orbs) o.update(dt);
  for (const c of G.corpses) c.timer -= dt;
  G.updateHazards(dt);
  G.frenzy = Math.max(0, G.frenzy - dt);

  G.allies = G.allies.filter(a => !a.dead);
  G.enemies = G.enemies.filter(e => !e.dead);
  G.projs = G.projs.filter(p => !p.dead);
  G.orbs = G.orbs.filter(o => !o.dead);
  G.corpses = G.corpses.filter(c => c.timer > 0);
  if (G.focus && G.focus.dead) G.focus = null;

  if (G.state !== 'play') return; // murió este frame

  if (G.victoryTimer > 0) {
    G.victoryTimer -= dt;
    if (G.victoryTimer <= 0) {
      G.state = 'victory';
      G.seen.victory = true;
      G.save();
      return;
    }
  }
  G.updateDoor();
}

function updateCamera() {
  const p = G.player, wd = G.world;
  G.cam.x = wd.w <= G.W ? (wd.w - G.W) / 2 : G.U.clamp(p.x - G.W / 2, 0, wd.w - G.W);
  G.cam.y = wd.h <= G.H ? (wd.h - G.H) / 2 : G.U.clamp(p.y - G.H / 2, 0, wd.h - G.H);
  G.mw.x = G.mouse.x + G.cam.x;
  G.mw.y = G.mouse.y + G.cam.y;
}

function drawScene(ctx) {
  ctx.save();
  let sx = 0, sy = 0;
  if (G.shake > 0) {
    sx = G.U.rand(-1, 1) * G.shake * 18;
    sy = G.U.rand(-1, 1) * G.shake * 18;
  }
  ctx.translate(Math.round(-G.cam.x + sx), Math.round(-G.cam.y + sy));
  G.drawWorld(ctx);
  G.drawHazards(ctx);
  for (const c of G.corpses) G.drawCorpse(ctx, c);
  for (const o of G.orbs) o.draw(ctx);
  G.ui.drawWorldOverlay(ctx);
  if (G.world.lobby) G.drawMentor(ctx);
  const units = [G.player, ...G.allies, ...G.enemies].filter(u => !u.dead).sort((a, b) => a.y - b.y);
  for (const u of units) u.draw(ctx);
  for (const p of G.projs) p.draw(ctx);
  G.fx.draw(ctx);
  ctx.restore();
  // viñeta
  const v = ctx.createRadialGradient(G.W / 2, G.H / 2, G.H * 0.45, G.W / 2, G.H / 2, G.H * 0.95);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, G.W, G.H);
}

let last = performance.now();
G.fatal = null;

// Pantalla de error: evita que el juego se congele sin explicación
function drawFatal(ctx) {
  ctx.fillStyle = '#12060a';
  ctx.fillRect(0, 0, G.W, G.H);
  G.U.text(ctx, 'Algo salió mal', G.W / 2, 150, 34, '#e04560', 'center', true);
  G.U.text(ctx, G.fatal.slice(0, 110), G.W / 2, 210, 14, '#e8d8ff', 'center');
  G.U.text(ctx, '[Enter] Volver a la guarida (conserva tu partida)', G.W / 2, 300, 18, '#7dffb8', 'center', true);
  G.U.text(ctx, '[Supr] Borrar partida y empezar de cero', G.W / 2, 340, 18, '#ff9a9a', 'center', true);
  G.U.text(ctx, 'Si se repite, envía una captura de esta pantalla.', G.W / 2, 400, 14, '#998', 'center');
}

function updateFatal() {
  if (G.wasPressed('enter')) {
    G.fatal = null;
    try { G.startGame(G.hasSave()); } catch (e) { G.fatal = String(e && e.message || e); }
  } else if (G.wasPressed('delete')) {
    G.fatal = null;
    G.clearSave();
    G.state = 'title';
  }
}

function frame(now) {
  try {
    if (G.fatal) {
      updateFatal();
      if (G.fatal) drawFatal(G.ctx);
    } else {
      step(now);
    }
  } catch (e) {
    console.error(e);
    G.fatal = String(e && e.message || e);
  }
  G.endFrameInput();
  requestAnimationFrame(frame);
}

function step(now) {
  const dt = G.U.clamp((now - last) / 1000, 0, 0.05);
  last = now;
  G.time += dt;
  G.shake = Math.max(0, G.shake - dt);
  if (G.bannerMsg) G.bannerMsg.time -= dt;

  const ctx = G.ctx;
  switch (G.state) {
    case 'title':
      if (G.wasPressed('enter') || G.mouse.clicked) G.startGame(G.hasSave());
      else if (G.wasPressed('n')) G.startGame(false);
      G.ui.drawTitle(ctx);
      break;
    case 'play':
      updateCamera();
      updatePlay(dt);
      G.fx.update(dt);
      updateCamera();
      drawScene(ctx);
      G.ui.drawHUD(ctx);
      if (G.state === 'dialog') G.ui.drawDialog(ctx);
      break;
    case 'dialog':
      G.updateDialog(dt);
      G.fx.update(dt);
      drawScene(ctx);
      G.ui.drawHUD(ctx);
      G.ui.drawDialog(ctx);
      break;
    case 'book':
      if (G.wasPressed('b') || G.wasPressed('tab') || G.wasPressed('escape')) G.state = 'play';
      else G.book.update();
      updateCamera();
      drawScene(ctx);
      G.ui.drawHUD(ctx);
      G.book.draw(ctx);
      break;
    case 'paused':
      if (G.wasPressed('escape')) G.state = 'play';
      else if (G.wasPressed('t')) { G.save(); G.state = 'title'; }
      else if (G.wasPressed('l') && !G.world.lobby) G.fleeToLobby();
      drawScene(ctx);
      G.ui.drawHUD(ctx);
      G.ui.drawPaused(ctx);
      break;
    case 'dead':
      G.fx.update(dt);
      if (G.wasPressed('enter')) G.retryZone();
      else if (G.wasPressed('l')) {
        G.essence = Math.floor(G.essence / 2);
        G.fleeToLobby();
      }
      drawScene(ctx);
      G.ui.drawDead(ctx);
      break;
    case 'victory':
      if (G.wasPressed('enter')) G.fleeToLobby(G.currentAllyTypes());
      drawScene(ctx);
      G.ui.drawVictory(ctx);
      break;
  }
  G.ui.drawCursor(ctx);
}

window.addEventListener('load', () => {
  const canvas = document.getElementById('game');
  G.ctx = canvas.getContext('2d');
  G.initMouse(canvas);
  requestAnimationFrame(frame);
});
