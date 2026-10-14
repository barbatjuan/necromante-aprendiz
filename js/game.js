const SAVE_KEY = 'necromante_aprendiz_save';

G.state = 'title';
G.time = 0;
G.shake = 0;
G.cam = { x: 0, y: 0 };
G.mw = { x: 0, y: 0 };
G.net = null; // multijugador (net.js)

G.resetProgress = () => {
  G.up = {};
  for (const u of G.UPGRADES) G.up[u.id] = 0;
  G.essence = 0;
  G.stats = { kills: 0, raised: 0 };
  G.seen = { book: false, q: false, f: false, v: false, intro: false, victory: false };
  G.zoneAllies = [];
  G.zone = -1;
  G.maxZone = 0;
  G.cleared = [];
};
G.resetProgress();

G.isGuest = () => !!(G.net && G.net.role === 'guest');
G.isHost = () => !!(G.net && G.net.role === 'host');

G.save = () => {
  if (G.isGuest()) return; // la partida es del anfitrión
  try {
    const mine = G.zoneAllies.filter(a => G.player && a[1] === G.player.id).map(a => a[0]);
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 3, maxZone: G.maxZone, cleared: G.cleared, up: G.up, essence: G.essence,
      stats: G.stats, seen: G.seen, allies: mine,
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
  G.player = null;
  G.players = [];
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
    G.loadLobby((s.allies || []).filter(t => typeof t === 'string' && G.ENEMIES[t] && G.ENEMIES[t].look));
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

G.fleeToLobby = (list = G.zoneAllies) => {
  G.loadLobby(list);
  G.state = 'play';
};

// Empuja unidades superpuestas entre sí (más pesadas se mueven menos)
function separate() {
  const all = [...G.players, ...G.allies, ...G.enemies].filter(u => !u.dead);
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const min = a.r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min || d2 === 0) continue;
      const d = Math.sqrt(d2), ov = min - d;
      const heavy = u => u.boss || u.dummy || u.remote;
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

G.commandAllies = (p = G.player) => {
  const e = G.nearest(p.inp.mw, G.enemiesAlive(), 50);
  if (e) {
    p.focus = e;
    e.alert && e.alert();
    G.book.tell(p, 'Siervos: ¡atacad!', 1);
  } else {
    p.focus = null;
    G.book.tell(p, 'Siervos: seguidme', 1);
  }
};

// Teclas que solo afectan a la interfaz local
function handleLocalKeys() {
  if (G.wasPressed('escape')) { G.state = 'paused'; return; }
  if (G.wasPressed('b') || G.wasPressed('tab')) {
    G.state = 'book';
    G.seen.book = true;
    return;
  }
  if (G.DEBUG && !G.isGuest()) {
    if (G.wasPressed('f8')) G.essence += 200;
    if (G.wasPressed('f9')) {
      if (G.world.lobby) G.loadZone(G.maxZone, G.currentAllies());
      else if (G.zone < G.ZONES.length - 1) G.nextZone();
    }
  }
}

// Controles del jugador local -> su objeto de entrada
function gatherLocalInput(active) {
  const I = G.player.inp;
  I.keys = active ? G.keys : {};
  I.mw = { x: G.mw.x, y: G.mw.y };
  I.down = active && G.mouse.down;
  if (active) for (const k of ['e', 'q', 'f', 'v', 'r']) if (G.wasPressed(k)) I.ev.push(k);
}

// Simulación del mundo (un jugador o anfitrión)
function simulate(dt) {
  for (const p of G.players) {
    if (!p.dead) { p.update(dt); continue; }
    // compañero caído: reaparece junto a otro jugador vivo
    if (p.respawn > 0) {
      p.respawn -= dt;
      const buddy = G.alivePlayers()[0];
      if (p.respawn <= 0 && buddy) {
        p.dead = false;
        p.hp = Math.round(p.maxHp * 0.5);
        p.x = buddy.x + 20; p.y = buddy.y;
        p.tp++;
        G.fx.burst(p.x, p.y, '#b57cff', 20, 140, 0.6);
      }
    }
  }
  for (const a of G.allies) if (!a.dead) a.update(dt);
  for (const e of G.enemies) if (!e.dead) e.update(dt);
  separate();
  for (const p of G.projs) p.update(dt);
  for (const o of G.orbs) o.update(dt);
  for (const c of G.corpses) c.timer -= dt;
  G.updateHazards(dt);

  G.allies = G.allies.filter(a => !a.dead);
  G.enemies = G.enemies.filter(e => !e.dead);
  G.projs = G.projs.filter(p => !p.dead);
  G.orbs = G.orbs.filter(o => !o.dead);
  G.corpses = G.corpses.filter(c => c.timer > 0);
  for (const p of G.players) if (p.focus && p.focus.dead) p.focus = null;

  if (G.state === 'dead') return; // cayeron todos este frame

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
  if (!p || !wd) return;
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
  const units = [...G.players, ...G.allies, ...G.enemies].filter(u => !u.dead).sort((a, b) => a.y - b.y);
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
    if (G.isGuest()) { G.net.leave(); return; }
    try { G.startGame(G.hasSave()); } catch (e) { G.fatal = String(e && e.message || e); }
  } else if (G.wasPressed('delete')) {
    G.fatal = null;
    if (G.net) G.net.leave();
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

const OVERLAYS = ['dialog', 'book', 'paused'];

function step(now) {
  const dt = G.U.clamp((now - last) / 1000, 0, 0.05);
  last = now;
  G.time += dt;
  G.shake = Math.max(0, G.shake - dt);
  if (G.bannerMsg) G.bannerMsg.time -= dt;
  const ctx = G.ctx;

  if (G.state === 'title') {
    if (G.wasPressed('enter') || G.mouse.clicked) G.startGame(G.hasSave());
    else if (G.wasPressed('n')) G.startGame(false);
    else if (G.wasPressed('h')) G.netHost();
    else if (G.wasPressed('u')) { G.joinCode = ''; G.state = 'join'; }
    G.ui.drawTitle(ctx);
    G.ui.drawCursor(ctx);
    return;
  }
  if (G.state === 'join' || G.state === 'connecting') {
    G.updateJoinScreen();
    G.ui.drawJoin(ctx);
    G.ui.drawCursor(ctx);
    return;
  }

  // Invitado: su propio bucle (recibe el mundo del anfitrión)
  if (G.isGuest()) {
    G.net.guestStep(dt);
    G.ui.drawCursor(ctx);
    return;
  }

  // Un jugador o anfitrión
  const st0 = G.state;
  if (G.state === 'play') {
    updateCamera();
    handleLocalKeys();
    if (G.state === 'play') {
      gatherLocalInput(true);
      simulate(dt);
    }
  } else if (OVERLAYS.includes(G.state) && G.isHost()) {
    // en multijugador el mundo no se pausa
    updateCamera();
    gatherLocalInput(false);
    simulate(dt);
  }
  G.fx.update(dt);
  updateCamera();
  drawScene(ctx);
  if (G.state !== 'dead' && G.state !== 'victory') G.ui.drawHUD(ctx);
  const fresh = G.state !== st0; // se abrió este frame: no reutilizar la misma tecla

  switch (G.state) {
    case 'dialog':
      if (!fresh) G.updateDialog(dt);
      G.ui.drawDialog(ctx);
      break;
    case 'book':
      if (fresh) { /* nada */ } else if (G.wasPressed('b') || G.wasPressed('tab') || G.wasPressed('escape')) G.state = 'play';
      else G.book.update();
      G.book.draw(ctx);
      break;
    case 'paused':
      if (fresh) { /* nada */ } else if (G.wasPressed('escape')) G.state = 'play';
      else if (G.wasPressed('t')) { G.save(); if (G.net) G.net.leave(); G.state = 'title'; }
      else if (G.wasPressed('l') && !G.world.lobby) G.fleeToLobby();
      G.ui.drawPaused(ctx);
      break;
    case 'dead':
      if (G.wasPressed('enter')) G.retryZone();
      else if (G.wasPressed('l')) {
        G.essence = Math.floor(G.essence / 2);
        G.fleeToLobby();
      }
      G.ui.drawDead(ctx);
      break;
    case 'victory':
      if (G.wasPressed('enter')) G.fleeToLobby(G.currentAllies());
      G.ui.drawVictory(ctx);
      break;
  }
  if (G.isHost()) G.net.hostTick(dt);
  G.ui.drawCursor(ctx);
}

window.addEventListener('load', () => {
  const canvas = document.getElementById('game');
  G.ctx = canvas.getContext('2d');
  G.initMouse(canvas);
  requestAnimationFrame(frame);
});
