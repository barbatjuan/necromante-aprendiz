// Multijugador cooperativo P2P (PeerJS / WebRTC).
// El anfitrión simula el mundo; los invitados envían sus controles y dibujan lo que reciben.

const PEER_LIB = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
const ID_PREFIX = 'necroap-';
const MAX_PLAYERS = 4;
const SNAP_RATE = 0.05; // 20 envíos/s
const INPUT_RATE = 0.033;
const PEER_OPTS = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' },
      { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
    ],
  },
};

let peerLibPromise = null;
function loadPeerLib() {
  if (window.Peer) return Promise.resolve();
  if (!peerLibPromise) {
    peerLibPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = PEER_LIB;
      s.onload = resolve;
      s.onerror = () => { peerLibPromise = null; reject(new Error('No se pudo cargar la librería de red (¿sin internet?)')); };
      document.head.appendChild(s);
    });
  }
  return peerLibPromise;
}

function makeCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}

const r1 = v => Math.round(v);
const r2 = v => Math.round(v * 100) / 100;

// ---------- Eventos visuales que el anfitrión reenvía ----------
function hookFx() {
  if (G.fx._hooked) return;
  G.fx._hooked = true;
  const { burst, text, ring } = G.fx;
  G.fx.burst = function (x, y, color, n = 10, spd = 120, life = 0.5, size = 3) {
    if (G.isHost()) G.net.events.push(['b', r1(x), r1(y), color, n, spd, life, size]);
    return burst.call(this, x, y, color, n, spd, life, size);
  };
  G.fx.text = function (x, y, s, color = '#fff') {
    if (G.isHost()) G.net.events.push(['t', r1(x), r1(y), String(s), color]);
    return text.call(this, x, y, s, color);
  };
  G.fx.ring = function (x, y, r, color, life = 0.4) {
    if (G.isHost()) G.net.events.push(['r', r1(x), r1(y), r, color, life]);
    return ring.call(this, x, y, r, color, life);
  };
}

function applyEvents(evs) {
  for (const e of evs) {
    if (e[0] === 'b') G.fx.burst(e[1], e[2], e[3], e[4], e[5], e[6], e[7]);
    else if (e[0] === 't') G.fx.text(e[1], e[2], e[3], e[4]);
    else if (e[0] === 'r') G.fx.ring(e[1], e[2], e[3], e[4], e[5]);
    else if (e[0] === 'n') G.banner(e[1], e[2], true);
  }
}

// ============================ ANFITRIÓN ============================
G.netHost = async () => {
  G.state = 'connecting';
  G.joinMsg = 'Creando sala...';
  try {
    await loadPeerLib();
  } catch (e) {
    G.joinMsg = e.message;
    return;
  }
  const tryOpen = attempt => {
    const code = makeCode();
    const peer = new Peer(ID_PREFIX + code, PEER_OPTS);
    peer.on('open', () => {
      hookFx();
      G.net = {
        role: 'host', code, peer, conns: [], events: [], acc: 0,
        tell(p, text, time) {
          const c = this.conns.find(k => k.player === p);
          if (c && c.conn.open) c.conn.send({ t: 'tell', text, time });
        },
        leave() { hostLeave(); },
        hostTick: dt => G.netHostTick(dt),
      };
      G.startGame(G.hasSave());
      G.banner(`Sala creada. Código: ${code}`, 4, true);
    });
    peer.on('connection', conn => onGuestConnection(conn));
    peer.on('error', err => {
      if (err.type === 'unavailable-id' && attempt < 3) { peer.destroy(); tryOpen(attempt + 1); return; }
      if (!G.net) { G.joinMsg = 'Error de red: ' + err.type; return; }
      console.warn('peer', err);
    });
    peer.on('disconnected', () => { if (G.net && G.net.peer === peer && !peer.destroyed) peer.reconnect(); });
  };
  tryOpen(0);
};

function hostLeave() {
  const n = G.net;
  if (!n) return;
  for (const c of n.conns) { try { c.conn.send({ t: 'bye' }); } catch (e) { /* nada */ } }
  setTimeout(() => n.peer.destroy(), 200);
  for (const c of n.conns) removeRemote(c.player);
  G.net = null;
}

function onGuestConnection(conn) {
  const n = G.net;
  conn.on('open', () => {
    if (!n || G.players.length >= MAX_PLAYERS) {
      conn.send({ t: 'full' });
      setTimeout(() => conn.close(), 300);
      return;
    }
    const used = G.players.map(p => p.color);
    const color = [0, 1, 2, 3].find(c => !used.includes(c));
    const base = G.alivePlayers()[0] || G.player;
    const p = new Player(base.x + 30, base.y + 20);
    p.remote = true;
    p.color = color;
    p.name = 'Jugador ' + (color + 1);
    p.maxHp = p.hp = G.playerMaxHp();
    G.players.push(p);
    const entry = { conn, player: p };
    n.conns.push(entry);
    conn.send({ t: 'welcome', id: p.id, code: n.code });
    G.banner(`${p.name} se unió a la partida`, 2.5);
  });
  conn.on('data', msg => {
    const entry = n.conns.find(c => c.conn === conn);
    if (!entry || !msg) return;
    const p = entry.player;
    if (msg.t === 'in') {
      if (!p.dead && msg.tp === p.tp && Number.isFinite(msg.x) && Number.isFinite(msg.y)) {
        p.x = msg.x; p.y = msg.y;
      }
      p.inp.mw = { x: +msg.mx || p.x, y: +msg.my || p.y };
      p.inp.down = !!msg.down;
      p.inp.keys = { j: !!msg.j };
      for (const ev of msg.ev || []) {
        if (typeof ev === 'string' && (/^[eqfvr]$/.test(ev) || /^buy:\d$/.test(ev))) p.inp.ev.push(ev);
      }
    } else if (msg.t === 'hello' && typeof msg.name === 'string') {
      p.name = msg.name.slice(0, 14) || p.name;
    }
  });
  const drop = () => {
    const i = n.conns.findIndex(c => c.conn === conn);
    if (i < 0) return;
    const p = n.conns[i].player;
    n.conns.splice(i, 1);
    removeRemote(p);
    G.banner(`${p.name} salió de la partida`, 2.5);
  };
  conn.on('close', drop);
  conn.on('error', drop);
}

function removeRemote(p) {
  G.players = G.players.filter(q => q !== p);
  for (const a of G.allies) if (a.owner === p) a.owner = G.player;
  if (G.state === 'play' && G.alivePlayers().length === 0) G.state = 'dead';
}

function snapshot() {
  const ent = u => [u.id, u.type, r1(u.x), r1(u.y), r2(u.facing), Math.ceil(u.hp), u.maxHp, r2(u.atk), r2(u.windup), u.flash > 0 ? 1 : 0];
  const st = OVERLAYS_HOST.includes(G.state) ? 'play' : G.state;
  return {
    t: 'snap',
    st, z: G.zone, zs: G.zoneSeq, wo: G.world.open ? 1 : 0,
    e: G.essence, mz: G.maxZone, cl: G.cleared, up: G.up,
    sv: { intro: true, victory: G.seen.victory },
    pl: G.players.map(p => [p.id, r1(p.x), r1(p.y), r2(p.facing), Math.ceil(p.hp), p.maxHp, p.dead ? 1 : 0,
      r2(p.swing), p.color, p.tp, r2(p.frenzy), p.name, r2(p.qCd), r2(p.fCd), r2(p.vCd), r2(p.respawn), p.flash > 0 ? 1 : 0]),
    al: G.allies.filter(a => !a.dead).map(a => [...ent(a), a.owner ? a.owner.id : 0]),
    en: G.enemies.filter(e => !e.dead).map(e => [...ent(e), e.aggro ? 1 : 0,
      e.boss ? [e.state, r2(e.timer), r2(e.chargeAng), e.phase] : 0]),
    co: G.corpses.map(c => [c.type, r1(c.x), r1(c.y), r2(c.rot), c.side, r2(c.timer)]),
    or: G.orbs.map(o => [r1(o.x), r1(o.y), o.v]),
    pr: G.projs.filter(p => !p.dead).map(p => [r1(p.x), r1(p.y), r1(p.vx), r1(p.vy), p.team === 'enemy' ? 1 : 0, p.holy ? 1 : 0, p.fire]),
    hz: G.hazards.map(h => [r1(h.x), r1(h.y), h.r, r2(h.t), h.max, h.color]),
    ev: G.net.events,
  };
}
const OVERLAYS_HOST = ['dialog', 'book', 'paused'];

G.netHostTick = dt => {
  const n = G.net;
  n.acc += dt;
  if (n.acc < SNAP_RATE) return;
  n.acc = 0;
  if (!n.conns.length) { n.events = []; return; }
  const s = snapshot();
  n.events = [];
  for (const c of n.conns) if (c.conn.open) c.conn.send(s);
};

// ============================ INVITADO ============================
G.joinCode = '';
G.joinMsg = '';

G.updateJoinScreen = () => {
  if (G.wasPressed('escape')) {
    if (G.net) G.net.leave();
    G.state = 'title';
    return;
  }
  if (G.state !== 'join') return;
  for (const k of Object.keys(G.pressed)) {
    if (k === 'backspace') G.joinCode = G.joinCode.slice(0, -1);
    else if (/^[a-z0-9]$/.test(k) && G.joinCode.length < 5) G.joinCode += k.toUpperCase();
  }
  if (G.wasPressed('enter') && G.joinCode.length === 5) G.netJoin(G.joinCode);
};

G.netJoin = async code => {
  G.state = 'connecting';
  G.joinMsg = 'Conectando con la sala ' + code + '...';
  try {
    await loadPeerLib();
  } catch (e) {
    G.joinMsg = e.message;
    G.state = 'join';
    return;
  }
  const peer = new Peer(PEER_OPTS);
  const fail = msg => {
    if (G.state !== 'connecting') return;
    G.joinMsg = msg;
    G.state = 'join';
    try { peer.destroy(); } catch (e) { /* nada */ }
  };
  const timer = setTimeout(() => fail('No se pudo conectar. Revisa el código o pide al anfitrión que cree otra sala.'), 15000);
  peer.on('error', err => {
    clearTimeout(timer);
    if (G.isGuest()) return guestLost('Se perdió la conexión con la sala');
    fail(err.type === 'peer-unavailable' ? 'No existe una sala con ese código.' : 'Error de red: ' + err.type);
  });
  peer.on('open', () => {
    const conn = peer.connect(ID_PREFIX + code, { reliable: true, serialization: 'json' });
    conn.on('open', () => conn.send({ t: 'hello', name: '' }));
    conn.on('data', msg => {
      if (!msg) return;
      if (msg.t === 'full') { clearTimeout(timer); fail('La sala está llena (máximo 4).'); return; }
      if (msg.t === 'welcome') {
        clearTimeout(timer);
        startGuest(peer, conn, msg.id, msg.code);
        return;
      }
      if (!G.isGuest()) return;
      if (msg.t === 'snap') applySnapshot(msg);
      else if (msg.t === 'tell') G.banner(msg.text, msg.time, true);
      else if (msg.t === 'bye') guestLost('El anfitrión cerró la sala');
    });
    conn.on('close', () => guestLost('El anfitrión se desconectó'));
  });
};

function guestLost(msg) {
  if (!G.isGuest()) return;
  try { G.net.peer.destroy(); } catch (e) { /* nada */ }
  G.net = null;
  G.state = 'title';
  G.titleMsg = msg;
}

function startGuest(peer, conn, myId, code) {
  G.resetProgress();
  G.players = [];
  G.player = null;
  G.allies = []; G.enemies = []; G.corpses = []; G.orbs = []; G.projs = []; G.hazards = [];
  G.world = null;
  G.fx.clear();
  G.net = {
    role: 'guest', peer, conn, myId, code, acc: 0, ev: [], zs: -1, hostState: 'play', byId: new Map(),
    sendEvent(ev) { this.ev.push(ev); },
    tell() {},
    leave() {
      try { this.conn.close(); this.peer.destroy(); } catch (e) { /* nada */ }
      G.net = null;
      G.state = 'title';
    },
    guestStep: dt => guestStep(dt),
  };
  G.state = 'play';
}

function makeEnemy(type, x, y) {
  if (type === 'paladin') return new Boss(x, y);
  if (type === 'reysol') return new KingBoss(x, y);
  if (type === 'arcangel') return new ArchangelBoss(x, y);
  if (type === 'muneco') return new Dummy(x, y);
  return new Unit(type, x, y, 'enemy');
}

function syncUnits(list, team, n) {
  const out = [];
  for (const d of list) {
    const [id, type, x, y, f, hp, mhp, atk, windup, flash] = d;
    if (!G.ENEMIES[type]) continue;
    let u = n.byId.get(id);
    if (!u || u.type !== type) {
      u = team === 'ally' ? new Unit(type, x, y, 'ally') : makeEnemy(type, x, y);
      u.netId = id;
      n.byId.set(id, u);
    }
    u.tx = x; u.ty = y;
    u.facing = f; u.hp = hp; u.maxHp = mhp; u.atk = atk; u.windup = windup;
    if (flash) u.flash = 0.12;
    if (team === 'ally') {
      u.owner = G.players.find(p => p.id === d[10]) || null;
    } else {
      u.aggro = !!d[10];
      if (d[11]) [u.state, u.timer, u.chargeAng, u.phase] = d[11];
    }
    u.seen = true;
    out.push(u);
  }
  return out;
}

function applySnapshot(s) {
  const n = G.net;
  if (s.zs !== n.zs) {
    n.zs = s.zs;
    G.zone = s.z;
    G.buildWorld(s.z);
    n.byId.clear();
    G.allies = []; G.enemies = []; G.corpses = []; G.orbs = []; G.projs = []; G.hazards = [];
  }
  n.hostState = s.st;
  G.world.open = !!s.wo;
  G.essence = s.e; G.maxZone = s.mz; G.cleared = s.cl;
  Object.assign(G.up, s.up);
  Object.assign(G.seen, s.sv);

  // jugadores
  const players = [];
  for (const d of s.pl) {
    const [id, x, y, f, hp, mhp, dead, swing, color, tp, frz, name, qCd, fCd, vCd, resp, flash] = d;
    let p = G.players.find(q => q.id === id);
    if (!p) {
      p = new Player(x, y);
      p.id = id;
      p.tp = tp;
    }
    const mine = id === n.myId;
    if (!mine || p.tp !== tp) { // los demás o un teletransporte del anfitrión
      if (mine) { p.x = x; p.y = y; p.tp = tp; }
    }
    p.tx = x; p.ty = y;
    if (!mine) { p.facing = f; p.swing = swing; }
    p.hp = hp; p.maxHp = mhp; p.dead = !!dead; p.color = color; p.frenzy = frz; p.name = name;
    p.qCd = qCd; p.fCd = fCd; p.vCd = vCd; p.respawn = resp;
    if (flash) p.flash = 0.12;
    players.push(p);
  }
  G.players = players;
  G.player = players.find(p => p.id === n.myId) || G.player;

  for (const u of n.byId.values()) u.seen = false;
  G.allies = syncUnits(s.al, 'ally', n);
  G.enemies = syncUnits(s.en, 'enemy', n);
  for (const [id, u] of n.byId) if (!u.seen) n.byId.delete(id);

  G.corpses = s.co.filter(c => G.ENEMIES[c[0]]).map(([type, x, y, rot, side, timer]) =>
    ({ type, t: G.ENEMIES[type], x, y, r: G.ENEMIES[type].r, rot, side, timer }));
  G.orbs = s.or.map(([x, y, v]) => {
    const o = Object.create(Orb.prototype);
    Object.assign(o, { x, y, v, phase: x % 6, dead: false });
    return o;
  });
  G.projs = s.pr.map(([x, y, vx, vy, enemy, holy, fire]) => {
    const p = Object.create(Proj.prototype);
    Object.assign(p, { x, y, vx, vy, ang: Math.atan2(vy, vx), team: enemy ? 'enemy' : 'friend', holy: !!holy, fire, dead: false });
    return p;
  });
  G.hazards = s.hz.map(([x, y, r, t, max, color]) => ({ x, y, r, t, max, color }));
  applyEvents(s.ev || []);
}

function guestStep(dt) {
  const n = G.net;
  const ctx = G.ctx;
  if (!G.world || !G.player) {
    ctx.fillStyle = '#0d0a12';
    ctx.fillRect(0, 0, G.W, G.H);
    G.U.text(ctx, 'Uniéndose a la sala...', G.W / 2, G.H / 2, 22, '#d8b8ff', 'center', true);
    return;
  }
  const me = G.player;
  updateCamera();

  // interfaz local
  const st0 = G.state;
  if (G.state === 'play') {
    if (G.wasPressed('escape')) G.state = 'paused';
    else if (G.wasPressed('b') || G.wasPressed('tab')) G.state = 'book';
  }
  const active = G.state === 'play' && n.hostState === 'play' && !me.dead;
  if (active) {
    for (const k of ['e', 'q', 'f', 'v', 'r']) {
      if (!G.wasPressed(k)) continue;
      if (k === 'e' && G.world.lobby) {
        if (G.U.dist(me, G.mentor) < 70) G.talkMentor();
        else if (G.nearAltar(me)) G.state = 'book';
      } else n.ev.push(k);
    }
    // movimiento local inmediato (sin esperar al anfitrión)
    me.move(dt, G.keys);
    G.collideWalls(me);
    me.facing = G.U.angle(me, G.mw);
    me.atkCd -= dt;
    if ((G.mouse.down || G.keys['j']) && me.atkCd <= 0) { me.atkCd = 0.42; me.swing = 0.2; }
  }
  me.swing -= dt;

  // suavizar al resto
  const k = Math.min(1, dt * 14);
  for (const p of G.players) {
    if (p !== me && p.tx !== undefined) { p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k; }
  }
  for (const u of [...G.allies, ...G.enemies]) {
    if (u.tx === undefined) continue;
    if (Math.hypot(u.tx - u.x, u.ty - u.y) > 200) { u.x = u.tx; u.y = u.ty; }
    u.x += (u.tx - u.x) * k; u.y += (u.ty - u.y) * k;
    u.flash = Math.max(0, (u.flash || 0) - dt);
  }
  for (const u of [...G.players, ...G.allies, ...G.enemies]) G.animate(u);
  for (const p of G.projs) { p.x += p.vx * dt; p.y += p.vy * dt; }
  for (const h of G.hazards) h.t = Math.max(0.01, h.t - dt);
  for (const c of G.corpses) c.timer -= dt;
  G.fx.update(dt);

  // enviar controles
  n.acc += dt;
  if (n.acc >= INPUT_RATE && n.conn.open) {
    n.acc = 0;
    n.conn.send({
      t: 'in', x: r1(me.x), y: r1(me.y), tp: me.tp, mx: r1(G.mw.x), my: r1(G.mw.y),
      down: active && G.mouse.down, j: active && !!G.keys['j'], ev: n.ev,
    });
    n.ev = [];
  }

  updateCamera();
  drawScene(ctx);
  if (n.hostState === 'dead') {
    G.ui.drawDead(ctx, true);
  } else if (n.hostState === 'victory') {
    G.ui.drawVictory(ctx, true);
  } else {
    G.ui.drawHUD(ctx);
  }
  const fresh = G.state !== st0;
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
      else if (G.wasPressed('t')) n.leave();
      G.ui.drawPaused(ctx);
      break;
  }
}
