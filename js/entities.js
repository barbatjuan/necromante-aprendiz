// ---------- Efectos visuales ----------
G.fx = {
  parts: [], texts: [], rings: [],
  clear() { this.parts = []; this.texts = []; this.rings = []; },
  burst(x, y, color, n = 10, spd = 120, life = 0.5, size = 3) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = Math.random() * spd;
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color, size });
    }
  },
  text(x, y, s, color = '#fff') {
    this.texts.push({ x: x + G.U.rand(-6, 6), y, s: String(s), color, life: 0.9 });
  },
  ring(x, y, r, color, life = 0.4) {
    this.rings.push({ x, y, r, color, life, max: life });
  },
  update(dt) {
    for (const p of this.parts) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.92; p.vy *= 0.92; p.life -= dt;
    }
    for (const t of this.texts) { t.y -= 40 * dt; t.life -= dt; }
    for (const r of this.rings) r.life -= dt;
    this.parts = this.parts.filter(p => p.life > 0);
    this.texts = this.texts.filter(t => t.life > 0);
    this.rings = this.rings.filter(r => r.life > 0);
  },
  draw(ctx) {
    for (const r of this.rings) {
      const k = 1 - r.life / r.max;
      ctx.globalAlpha = r.life / r.max;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r * (0.3 + 0.7 * k), 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const p of this.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const t of this.texts) {
      ctx.globalAlpha = Math.min(1, t.life * 2);
      G.U.text(ctx, t.s, t.x, t.y, 15, t.color, 'center', true);
    }
    ctx.globalAlpha = 1;
  },
};

// ---------- Peligros en el suelo (lluvia solar, etc.) ----------
G.addHazard = (x, y, r, delay, dmg, allyDmg, color = '#ffe98a') => {
  G.hazards.push({ x, y, r, t: delay, max: delay, dmg, allyDmg, color });
};

G.updateHazards = dt => {
  for (const h of G.hazards) {
    h.t -= dt;
    if (h.t <= 0) {
      h.done = true;
      G.fx.ring(h.x, h.y, h.r, h.color, 0.4);
      G.fx.burst(h.x, h.y, h.color, 14, 160, 0.4);
      for (const u of G.friendlies()) {
        if (G.U.dist(h, u) < h.r + u.r) G.damage(u, u.team === 'ally' ? h.allyDmg : h.dmg, null);
      }
    }
  }
  G.hazards = G.hazards.filter(h => !h.done);
};

G.drawHazards = ctx => {
  for (const h of G.hazards) {
    const k = 1 - h.t / h.max;
    ctx.fillStyle = 'rgba(255,233,138,0.15)';
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = h.color;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r * k, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2); ctx.stroke();
  }
};

// ---------- Listas de unidades ----------
G.players = [];
G.enemiesAlive = () => G.enemies.filter(e => !e.dead);
G.alivePlayers = () => G.players.filter(p => !p.dead);
G.friendlies = () => [...G.players, ...G.allies].filter(u => !u.dead);
G.nearestPlayer = from => G.nearest(from, G.alivePlayers());
G.randomPlayer = () => {
  const ps = G.alivePlayers();
  return ps[Math.floor(Math.random() * ps.length)] || G.player;
};

// ids estables para sincronizar entidades por red
G._nid = 1;
G.nid = () => G._nid++;

G.nearest = (from, list, maxD = Infinity) => {
  let best = null, bd = maxD;
  for (const u of list) {
    if (u === from || u.dead) continue;
    const d = G.U.dist(from, u);
    if (d < bd) { bd = d; best = u; }
  }
  return best;
};

// Animación de caminar según desplazamiento real del frame
G.animate = u => {
  if (u.px === undefined) { u.px = u.x; u.py = u.y; u.walk = 0; }
  const moved = Math.hypot(u.x - u.px, u.y - u.py);
  u.moving = moved > 0.4;
  u.walk += Math.min(moved, 6) * 0.35;
  u.px = u.x; u.py = u.y;
};

// ---------- Daño y muerte ----------
G.damage = (tg, amt, src) => {
  if (!tg || tg.dead) return;
  if (tg.t && tg.t.armor) amt *= 1 - tg.t.armor;
  if (src && src.t && src.t.holy && tg.team === 'ally') amt *= 1.6;
  if (tg.team === 'ally') amt *= 1 - 0.08 * G.up.coraza;
  if (src && src.team === 'ally' && src.owner && src.owner.frenzy > 0) amt *= 1.5;
  amt = Math.max(1, Math.round(amt));
  tg.hp -= amt;
  tg.flash = 0.12;
  const color = tg.team === 'player' ? '#ff6b6b' : tg.team === 'ally' ? '#ffb86b' : '#ffffff';
  G.fx.text(tg.x, tg.y - tg.r - 14, amt, color);
  if (tg.team === 'player') {
    tg.lastHurt = 0;
    if (tg === G.player) G.shake = Math.min(0.35, G.shake + 0.12);
  }
  if (tg.dummy) {
    if (tg.hp <= 0) tg.hp = tg.maxHp;
    return;
  }
  if (tg.team === 'enemy' && !tg.aggro && tg.alert) tg.alert();
  if (tg.hp <= 0) G.kill(tg);
  return amt;
};

G.kill = u => {
  u.dead = true;
  if (u.team === 'player') {
    G.fx.burst(u.x, u.y, '#8a4fe0', 30, 200, 1);
    if (G.alivePlayers().length === 0) G.state = 'dead';
    else {
      u.respawn = 8;
      G.banner(`${u.name} ha caído. Volverá en 8 s`, 2);
    }
    return;
  }
  if (u.team === 'ally') {
    G.fx.burst(u.x, u.y, '#3fcf8e', 16, 150, 0.7);
    return;
  }
  // enemigo
  G.stats.kills++;
  G.fx.burst(u.x, u.y, u.t.color, 18, 170, 0.6);
  let ess = Math.round(u.t.essence * G.essenceMult());
  while (ess > 0) {
    const v = Math.min(u.boss ? 10 : 3, ess);
    ess -= v;
    G.orbs.push(new Orb(u.x, u.y, v));
  }
  if (u.boss) {
    G.shake = 0.6;
    if (u.final) {
      G.victoryTimer = 2.5;
      G.banner(`¡${u.t.name} ha caído!`, 3);
    } else {
      G.banner(`¡${u.t.name} ha caído! Acto ${'I'.repeat(u.act)} completado`, 3.5);
    }
  } else {
    G.corpses.push({ type: u.type, t: u.t, x: u.x, y: u.y, r: u.r, rot: u.facing, timer: 45, side: Math.random() < 0.5 ? -1 : 1 });
  }
};

G.drawCorpse = (ctx, c) => {
  ctx.globalAlpha = c.timer < 5 ? c.timer / 5 : 1;
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate((Math.PI / 2) * c.side);
  G.S.humanoid(ctx, { x: 0, y: 0, s: c.r / 14, face: 0, look: G.corpseLook(c.type, c.t.look), noAura: true });
  ctx.restore();
  ctx.globalAlpha = 1;
};

// ---------- Orbe de esencia ----------
class Orb {
  constructor(x, y, v) {
    const a = Math.random() * Math.PI * 2, s = G.U.rand(60, 160);
    this.x = x; this.y = y; this.v = v;
    this.vx = Math.cos(a) * s; this.vy = Math.sin(a) * s;
    this.dead = false;
    this.phase = Math.random() * 6;
  }
  update(dt) {
    const p = G.nearestPlayer(this);
    if (!p) return;
    const d = G.U.dist(this, p);
    if (d < 150) {
      const a = G.U.angle(this, p), pull = 900 * (1 - d / 170);
      this.vx += Math.cos(a) * pull * dt;
      this.vy += Math.sin(a) * pull * dt;
    }
    this.vx *= 0.9; this.vy *= 0.9;
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (d < p.r + 8) {
      this.dead = true;
      G.essence += this.v;
      G.fx.text(p.x, p.y - 30, '+' + this.v, '#c89bff');
    }
  }
  draw(ctx) {
    const s = 4 + Math.min(this.v, 6) + Math.sin(G.time * 6 + this.phase) * 1.2;
    ctx.fillStyle = '#b57cff';
    ctx.shadowColor = '#b57cff';
    ctx.shadowBlur = 10;
    G.U.poly(ctx, this.x, this.y, s, 4, 0);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

// ---------- Proyectil ----------
class Proj {
  constructor(src, ang, speed) {
    this.x = src.x + Math.cos(ang) * src.r;
    this.y = src.y + Math.sin(ang) * src.r - 4;
    this.vx = Math.cos(ang) * speed;
    this.vy = Math.sin(ang) * speed;
    this.ang = ang;
    this.team = src.team === 'enemy' ? 'enemy' : 'friend';
    this.src = src;
    this.dmg = src.dmg;
    this.holy = !!src.t.holy;
    this.fire = src.t.fire || 0;
    this.life = 1.6;
    this.r = this.fire ? 6 : 4;
    this.dead = false;
  }
  targets() {
    return this.team === 'enemy' ? G.friendlies() : G.enemiesAlive();
  }
  explode() {
    this.dead = true;
    if (!this.fire) return;
    G.fx.ring(this.x, this.y, this.fire, '#ff8a2a', 0.35);
    G.fx.burst(this.x, this.y, '#ffb050', 16, 160, 0.4);
    for (const u of this.targets()) {
      if (G.U.dist(this, u) < this.fire + u.r) G.damage(u, this.dmg, this.src);
    }
  }
  update(dt) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.life -= dt;
    if (this.fire && Math.random() < 0.7) G.fx.burst(this.x, this.y, '#ff8a2a', 1, 30, 0.3, 3);
    if (this.life <= 0) return this.explode();
    for (const w of G.world.walls) {
      if (G.U.pointInRect(this.x, this.y, w)) return this.explode();
    }
    for (const u of this.targets()) {
      if (G.U.dist(this, u) < u.r + this.r) {
        if (this.fire) return this.explode();
        G.damage(u, this.dmg, this.src);
        this.dead = true;
        return;
      }
    }
  }
  draw(ctx) {
    const friend = this.team !== 'enemy';
    if (this.fire) {
      ctx.fillStyle = friend ? '#7dffb8' : '#ff8a2a';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff3c0';
      ctx.beginPath();
      ctx.arc(this.x, this.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (this.holy) {
      ctx.fillStyle = friend ? '#9dffcf' : '#ffe98a';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      ctx.strokeStyle = friend ? '#7dffb8' : '#e8d9b0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x - Math.cos(this.ang) * 14, this.y - Math.sin(this.ang) * 14);
      ctx.stroke();
      ctx.fillStyle = '#ccc';
      ctx.fillRect(this.x - 1.5, this.y - 1.5, 3, 3);
    }
  }
}

// ---------- Jugador ----------
class Player {
  constructor(x, y) {
    this.x = x; this.y = y; this.r = 14;
    this.team = 'player';
    this.maxHp = G.playerMaxHp();
    this.hp = this.maxHp;
    this.speed = 190;
    this.atkCd = 0; this.swing = 0; this.qCd = 0; this.fCd = 0; this.vCd = 0;
    this.facing = 0; this.flash = 0; this.lastHurt = 99;
    this.dead = false;
  }
  update(dt) {
    let mx = 0, my = 0;
    if (G.keys['w'] || G.keys['arrowup']) my -= 1;
    if (G.keys['s'] || G.keys['arrowdown']) my += 1;
    if (G.keys['a'] || G.keys['arrowleft']) mx -= 1;
    if (G.keys['d'] || G.keys['arrowright']) mx += 1;
    if (mx || my) {
      const l = Math.hypot(mx, my);
      this.x += (mx / l) * this.speed * dt;
      this.y += (my / l) * this.speed * dt;
    }
    this.facing = G.U.angle(this, G.mw);
    this.atkCd -= dt; this.swing -= dt; this.qCd -= dt; this.fCd -= dt; this.vCd -= dt;
    this.flash = Math.max(0, this.flash - dt);
    this.lastHurt += dt;
    const regen = G.world.lobby ? 40 : 4;
    if (this.lastHurt > 4 || G.world.lobby) this.hp = Math.min(this.maxHp, this.hp + regen * dt);

    if ((G.mouse.down || G.keys['j']) && this.atkCd <= 0) this.attack();
    if (G.wasPressed('e')) {
      if (G.world.lobby) G.lobbyInteract();
      else G.book.raise();
    }
    if (G.wasPressed('q')) G.book.explode();
    if (G.wasPressed('f')) G.book.harvest();
    if (G.wasPressed('v')) G.book.frenzy();
  }
  attack() {
    this.atkCd = 0.42;
    this.swing = 0.2;
    const dmg = G.meleeDmg();
    let hit = false;
    for (const e of G.enemiesAlive()) {
      const d = G.U.dist(this, e);
      if (d > 58 + e.r) continue;
      if (Math.abs(G.U.angDiff(this.facing, G.U.angle(this, e))) > 1.05) continue;
      G.damage(e, dmg, this);
      hit = true;
      if (!e.boss && !e.dummy) {
        const a = G.U.angle(this, e), push = 260 * (14 / e.r);
        e.kx += Math.cos(a) * push;
        e.ky += Math.sin(a) * push;
      }
    }
    if (hit) G.fx.burst(this.x + Math.cos(this.facing) * 40, this.y + Math.sin(this.facing) * 40, '#d8c8ff', 6, 90, 0.25);
  }
  draw(ctx) {
    const { x, y, facing } = this;
    if (this.swing > 0) {
      ctx.fillStyle = `rgba(190,140,255,${this.swing * 2})`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, 62, facing - 1.05, facing + 1.05);
      ctx.closePath();
      ctx.fill();
    }
    // aura
    const g = ctx.createRadialGradient(x, y + 12, 2, x, y + 12, 22);
    g.addColorStop(0, 'rgba(157,107,255,0.45)');
    g.addColorStop(1, 'rgba(157,107,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y + 12, 22, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    G.S.shadow(ctx, x, y, this.r);
    G.S.humanoid(ctx, {
      x, y, s: 1.1, face: facing, walk: this.walk, moving: this.moving,
      flash: this.flash > 0, atk: this.swing, look: G.PLAYER_LOOK,
    });
    // libro flotante
    const ba = G.time * 1.5;
    const bx = x + Math.cos(ba) * 22, by = y - 8 + Math.sin(ba) * 8 + Math.sin(G.time * 3) * 2;
    ctx.fillStyle = '#3b1f14';
    ctx.fillRect(bx - 6, by - 7, 12, 14);
    ctx.fillStyle = '#d8c9a3';
    ctx.fillRect(bx - 5, by - 6, 10, 12);
    ctx.fillStyle = '#3b1f14';
    ctx.fillRect(bx - 0.5, by - 6, 1, 12);
    ctx.shadowColor = '#7dffb8'; ctx.shadowBlur = 8;
    ctx.fillStyle = '#3fcf8e';
    ctx.fillRect(bx - 4, by - 2, 3, 1);
    ctx.fillRect(bx + 1, by - 2, 3, 1);
    ctx.shadowBlur = 0;
  }
}

// ---------- Unidad genérica (enemigo o siervo) ----------
class Unit {
  constructor(type, x, y, team) {
    const t = G.ENEMIES[type];
    this.type = type; this.t = t;
    this.x = x; this.y = y; this.r = t.r;
    this.team = team;
    const mult = team === 'ally' ? G.allyMult() : 1;
    this.maxHp = Math.round(t.hp * mult);
    this.hp = this.maxHp;
    this.dmg = t.dmg * mult;
    this.speed = t.speed * (team === 'ally' ? 1.25 : 1);
    this.cd = Math.random() * t.cd;
    this.dashCd = 3; this.blinkCd = 4;
    this.facing = Math.random() * Math.PI * 2;
    this.aggro = false;
    this.target = null; this.retarget = 0;
    this.flash = 0; this.kx = 0; this.ky = 0;
    this.windup = 0; this.atk = 0;
    this.dead = false;
    this.seed = Math.random() * 10;
    this.home = { x, y }; this.wander = Math.random() * 3; this.wx = x; this.wy = y;
  }

  alert() {
    if (this.aggro) return;
    this.aggro = true;
    for (const e of G.enemies) {
      if (!e.dead && !e.aggro && e !== this && !e.dummy && G.U.dist(this, e) < 220) e.aggro = true;
    }
  }

  moveToward(tx, ty, spd, dt) {
    if (this.team === 'ally' && G.frenzy > 0) spd *= 1.3;
    const a = Math.atan2(ty - this.y, tx - this.x);
    this.x += Math.cos(a) * spd * dt;
    this.y += Math.sin(a) * spd * dt;
    this.facing = a;
  }

  hostiles() {
    return this.team === 'enemy' ? G.friendlies() : G.enemiesAlive();
  }

  update(dt) {
    this.flash = Math.max(0, this.flash - dt);
    this.atk = Math.max(0, this.atk - dt);
    this.cd -= dt * (this.team === 'ally' && G.frenzy > 0 ? 1.5 : 1);
    this.dashCd -= dt;
    this.blinkCd -= dt;
    this.x += this.kx * dt; this.y += this.ky * dt;
    const f = Math.pow(0.002, dt);
    this.kx *= f; this.ky *= f;
    if (this.team === 'enemy') this.thinkEnemy(dt);
    else this.thinkAlly(dt);
  }

  thinkEnemy(dt) {
    if (!this.aggro) {
      for (const f of G.friendlies()) {
        if (G.U.dist(this, f) < this.t.sight) { this.alert(); break; }
      }
    }
    if (!this.aggro) {
      this.wander -= dt;
      if (this.wander <= 0) {
        this.wander = G.U.rand(2, 4);
        this.wx = this.home.x + G.U.rand(-60, 60);
        this.wy = this.home.y + G.U.rand(-60, 60);
      }
      if (Math.hypot(this.wx - this.x, this.wy - this.y) > 6) this.moveToward(this.wx, this.wy, this.speed * 0.3, dt);
      return;
    }
    this.retarget -= dt;
    if (this.retarget <= 0 || !this.target || this.target.dead) {
      this.target = G.nearest(this, this.hostiles());
      this.retarget = 0.5;
    }
    if (this.target) this.combat(dt);
  }

  thinkAlly(dt) {
    const p = G.player;
    const dp = G.U.dist(this, p);
    if (dp > 900) { // atascado: teletransportar
      this.x = p.x + G.U.rand(-30, 30); this.y = p.y + G.U.rand(-30, 30);
      G.fx.burst(this.x, this.y, '#3fcf8e', 8, 80, 0.4);
    }
    this.retarget -= dt;
    if (dp > 520) {
      this.target = null;
    } else if (G.focus && !G.focus.dead) {
      this.target = G.focus;
    } else if (this.retarget <= 0 || !this.target || this.target.dead) {
      this.retarget = 0.4;
      const cands = G.enemiesAlive().filter(e => G.U.dist(e, p) < 420);
      this.target = G.nearest(this, cands, 320);
    }
    if (this.target && !this.target.dead) {
      this.combat(dt);
      return;
    }
    // seguir detrás del jugador
    const alive = G.allies.filter(a => !a.dead);
    const n = alive.length, i = alive.indexOf(this);
    const a = p.facing + Math.PI + (i - (n - 1) / 2) * 0.5;
    const rad = 55 + (i % 3) * 20;
    const sx = p.x + Math.cos(a) * rad, sy = p.y + Math.sin(a) * rad;
    const ds = Math.hypot(sx - this.x, sy - this.y);
    if (ds > 10) {
      const spd = dp > 140 ? Math.max(this.speed, 230) : Math.max(this.speed, 120);
      this.moveToward(sx, sy, Math.min(spd, ds / dt), dt);
    } else {
      this.facing = p.facing;
    }
  }

  shoot() {
    const t = this.t;
    const n = t.spread || 1;
    for (let i = 0; i < n; i++) {
      const a = this.facing + (i - (n - 1) / 2) * 0.22;
      G.projs.push(new Proj(this, a, t.projSpeed));
    }
    this.atk = 0.2;
  }

  combat(dt) {
    const t = this.t, tg = this.target;
    const d = G.U.dist(this, tg);
    this.facing = G.U.angle(this, tg);

    if (this.windup > 0) {
      this.windup -= dt;
      if (this.windup <= 0) this.doAoe();
      return;
    }

    if (t.healer && this.cd <= 0) {
      const mates = this.team === 'enemy' ? G.enemiesAlive() : G.allies.filter(a => !a.dead);
      const hurt = mates.find(m => m !== this && !m.dummy && m.hp < m.maxHp * 0.7 && G.U.dist(this, m) < t.range);
      if (hurt) {
        const amt = Math.round(18 * (this.team === 'ally' ? G.allyMult() : 1));
        hurt.hp = Math.min(hurt.maxHp, hurt.hp + amt);
        G.fx.text(hurt.x, hurt.y - hurt.r - 14, '+' + amt, this.team === 'enemy' ? '#ffe98a' : '#7dffb8');
        G.fx.burst(hurt.x, hurt.y, this.team === 'enemy' ? '#ffe98a' : '#7dffb8', 8, 60, 0.5);
        this.cd = t.cd;
        this.atk = 0.2;
        return;
      }
    }

    if (t.dash && this.dashCd <= 0 && d > 90 && d < 300) {
      this.dashCd = 4;
      this.kx = Math.cos(this.facing) * 700;
      this.ky = Math.sin(this.facing) * 700;
      G.fx.burst(this.x, this.y, '#aab8d8', 10, 100, 0.3);
    }

    if (t.blink && this.blinkCd <= 0 && d < 140) {
      this.blinkCd = 5;
      G.fx.burst(this.x, this.y, '#c050ff', 18, 140, 0.4);
      const a = Math.random() * Math.PI * 2;
      this.x = tg.x + Math.cos(a) * 240;
      this.y = tg.y + Math.sin(a) * 240;
      G.collideWalls(this);
      G.fx.burst(this.x, this.y, '#c050ff', 18, 140, 0.4);
      this.cd = Math.min(this.cd, 0.3);
      return;
    }

    if (t.ranged) {
      if (d < t.keepDist) this.moveToward(this.x - (tg.x - this.x), this.y - (tg.y - this.y), this.speed, dt);
      else if (d > t.range * 0.9) this.moveToward(tg.x, tg.y, this.speed, dt);
      this.facing = G.U.angle(this, tg);
      if (d <= t.range && this.cd <= 0) {
        this.shoot();
        this.cd = t.cd;
      }
    } else {
      const reach = this.r + tg.r + t.range;
      if (d > reach) {
        this.moveToward(tg.x, tg.y, this.speed, dt);
      } else if (this.cd <= 0) {
        this.atk = 0.2;
        if (t.aoe) this.windup = 0.6;
        else {
          G.damage(tg, this.dmg, this);
          G.fx.burst((this.x + tg.x) / 2, (this.y + tg.y) / 2, '#ffffff', 4, 60, 0.2, 2);
        }
        this.cd = t.cd;
      }
    }
  }

  doAoe() {
    const color = this.team === 'enemy' ? '#ff7a4a' : '#5fffae';
    G.fx.ring(this.x, this.y, this.t.aoe, color, 0.35);
    for (const h of this.hostiles()) {
      if (G.U.dist(this, h) < this.t.aoe + h.r) G.damage(h, this.dmg, this);
    }
    if (this.team === 'enemy') G.shake = Math.min(0.4, G.shake + 0.15);
  }

  draw(ctx) {
    const ally = this.team === 'ally';
    const t = this.t;
    if (this.windup > 0) {
      ctx.fillStyle = ally ? 'rgba(95,255,174,0.2)' : 'rgba(255,80,40,0.25)';
      ctx.beginPath();
      ctx.arc(this.x, this.y, Math.max(0, t.aoe * (1 - this.windup / 0.6)), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = ally ? 'rgba(95,255,174,0.6)' : 'rgba(255,80,40,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, t.aoe, 0, Math.PI * 2);
      ctx.stroke();
    }
    G.S.shadow(ctx, this.x, this.y, this.r, t.look.float ? 0.2 : 0.35);
    if (ally && G.frenzy > 0) {
      ctx.fillStyle = `rgba(255,60,60,${0.25 + Math.sin(G.time * 10 + this.seed) * 0.1})`;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + this.r * 0.9, this.r * 1.2, this.r * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (t.miniboss && !ally) {
      ctx.strokeStyle = 'rgba(232,201,90,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + this.r * 0.95, this.r, this.r * 0.35, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    G.S.humanoid(ctx, {
      x: this.x, y: this.y, s: this.r / 13, face: this.facing, walk: this.walk, moving: this.moving,
      flash: this.flash > 0, atk: this.atk, seed: this.seed,
      look: ally ? G.undeadLook(this.type, t.look) : t.look,
    });
    if (this.hp < this.maxHp) {
      G.U.bar(ctx, this.x - this.r, this.y + this.r + 6, this.r * 2, 4, this.hp / this.maxHp, ally ? '#5fffae' : '#e04545');
    }
    if (G.focus === this) {
      ctx.strokeStyle = '#5fffae';
      ctx.lineWidth = 2;
      const s = this.r + 10 + Math.sin(G.time * 8) * 2;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + G.time;
        ctx.moveTo(this.x + Math.cos(a) * s, this.y + Math.sin(a) * s);
        ctx.lineTo(this.x + Math.cos(a) * (s - 7), this.y + Math.sin(a) * (s - 7));
      }
      ctx.stroke();
    }
  }
}

// ---------- Muñeco de práctica (lobby) ----------
class Dummy extends Unit {
  constructor(x, y) {
    super('muneco', x, y, 'enemy');
    this.dummy = true;
    this.aggro = false;
  }
  alert() {}
  update(dt) {
    this.flash = Math.max(0, this.flash - dt);
    this.kx = this.ky = 0;
    this.x = this.home.x; this.y = this.home.y;
  }
  draw(ctx) {
    G.S.dummy(ctx, this.x, this.y, this.flash > 0);
  }
}

// ---------- Paladín Sagrado (jefe Acto I) ----------
class Boss extends Unit {
  constructor(x, y) {
    super('paladin', x, y, 'enemy');
    this.boss = true;
    this.act = 1;
    this.state = 'chase';
    this.timer = 0;
    this.chargeCd = 4; this.novaCd = 5; this.summonCd = 9;
    this.phase = 1;
    this.chargeAng = 0;
    this.hitSet = new Set();
  }

  wake() {
    if (G.U.dist(this, G.player) < this.t.sight) {
      this.aggro = true;
      G.banner(`¡${this.t.name} despierta!`, 2.5);
    }
  }

  pickTarget(dt) {
    this.retarget -= dt;
    if (this.retarget <= 0 || !this.target || this.target.dead) {
      const p = G.player;
      const near = G.nearest(this, G.friendlies());
      this.target = (near && G.U.dist(this, near) < G.U.dist(this, p) * 0.6) ? near : p;
      this.retarget = 1;
    }
  }

  swordSwing(reach) {
    this.cd = this.t.cd;
    this.atk = 0.2;
    for (const h of G.friendlies()) {
      if (G.U.dist(this, h) < reach + 20 && Math.abs(G.U.angDiff(this.facing, G.U.angle(this, h))) < 0.9) {
        G.damage(h, this.dmg, this);
      }
    }
    G.fx.burst(this.x + Math.cos(this.facing) * 35, this.y + Math.sin(this.facing) * 35, '#fff6c0', 10, 120, 0.3);
  }

  updateCharge(dt) {
    if (this.state === 'chargeWind') {
      this.timer -= dt;
      this.facing = this.chargeAng;
      if (this.timer <= 0) { this.state = 'charging'; this.timer = 0.55; this.hitSet.clear(); }
      return true;
    }
    if (this.state === 'charging') {
      this.timer -= dt;
      this.x += Math.cos(this.chargeAng) * 620 * dt;
      this.y += Math.sin(this.chargeAng) * 620 * dt;
      for (const h of G.friendlies()) {
        if (!this.hitSet.has(h) && G.U.dist(this, h) < this.r + h.r + 4) {
          this.hitSet.add(h);
          G.damage(h, 26, this);
          const a = G.U.angle(this, h);
          if (h.team === 'ally') { h.kx = Math.cos(a) * 400; h.ky = Math.sin(a) * 400; }
        }
      }
      if (Math.random() < 0.6) G.fx.burst(this.x, this.y, '#fff6c0', 2, 40, 0.3);
      if (this.timer <= 0 || this.hitWall) {
        this.state = 'chase';
        this.chargeCd = this.phase >= 2 ? 3.5 : 5;
        if (this.hitWall) G.shake = 0.3;
      }
      return true;
    }
    return false;
  }

  update(dt) {
    this.flash = Math.max(0, this.flash - dt);
    this.atk = Math.max(0, this.atk - dt);
    this.cd -= dt;
    if (!this.aggro) return this.wake();
    if (this.phase === 1 && this.hp < this.maxHp * 0.5) {
      this.phase = 2;
      this.speed *= 1.2;
      G.banner('¡Fase 2: la Luz Sagrada arde!', 2.5);
      G.shake = 0.5;
      G.fx.ring(this.x, this.y, 200, '#fff6c0', 0.8);
    }
    this.pickTarget(dt);
    const tg = this.target;
    if (!tg) return;
    const d = G.U.dist(this, tg);

    if (this.updateCharge(dt)) { this.hitWall = false; return; }

    if (this.state === 'chase') {
      this.facing = G.U.angle(this, tg);
      const reach = this.r + tg.r + this.t.range;
      if (d > reach) this.moveToward(tg.x, tg.y, this.speed, dt);
      else if (this.cd <= 0) this.swordSwing(reach);
      this.chargeCd -= dt;
      if (this.chargeCd <= 0 && d > 110) {
        this.state = 'chargeWind';
        this.timer = 0.75;
        this.chargeAng = G.U.angle(this, G.player);
      }
      if (this.phase === 2) {
        this.novaCd -= dt;
        this.summonCd -= dt;
        if (this.novaCd <= 0) { this.state = 'novaWind'; this.timer = 1.3; }
        if (this.summonCd <= 0) this.summon('guardia', 2, 13);
      }
    } else if (this.state === 'novaWind') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'chase';
        this.novaCd = 8;
        G.fx.ring(this.x, this.y, 240, '#fff6c0', 0.6);
        G.fx.burst(this.x, this.y, '#fff6c0', 40, 300, 0.6);
        G.shake = 0.4;
        for (const h of G.friendlies()) {
          if (G.U.dist(this, h) < 230 + h.r) G.damage(h, h.team === 'ally' ? 45 : 20, null);
        }
      }
    }
    this.hitWall = false;
  }

  summon(type, n, cd) {
    this.summonCd = cd;
    G.banner(`${this.t.name} invoca refuerzos`, 1.8);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const g = new Unit(type, this.x + Math.cos(a) * 80, this.y + Math.sin(a) * 80, 'enemy');
      g.aggro = true;
      G.enemies.push(g);
      G.fx.burst(g.x, g.y, '#fff6c0', 14, 120, 0.5);
    }
  }

  drawTelegraphs(ctx) {
    if (this.state === 'chargeWind') {
      ctx.strokeStyle = 'rgba(255,240,170,0.6)';
      ctx.lineWidth = this.r * 2;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + Math.cos(this.chargeAng) * 340, this.y + Math.sin(this.chargeAng) * 340);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (this.state === 'novaWind') {
      const k = 1 - this.timer / 1.3;
      ctx.fillStyle = `rgba(255,240,170,${0.1 + 0.25 * k})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 230, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff6c0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 230 * k, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  draw(ctx) {
    this.drawTelegraphs(ctx);
    const glow = ctx.createRadialGradient(this.x, this.y, 4, this.x, this.y, this.r * 2.2);
    glow.addColorStop(0, `rgba(255,240,170,${this.phase >= 2 ? 0.45 : 0.25})`);
    glow.addColorStop(1, 'rgba(255,240,170,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r * 2.2, 0, Math.PI * 2);
    ctx.fill();
    G.S.shadow(ctx, this.x, this.y, this.r, 0.45);
    G.S.humanoid(ctx, {
      x: this.x, y: this.y, s: this.r / 13, face: this.facing, walk: this.walk, moving: this.moving,
      flash: this.flash > 0, atk: this.atk, look: this.t.look,
    });
  }
}

// ---------- Rey Sol Aurelio (jefe final) ----------
class KingBoss extends Boss {
  constructor(x, y) {
    super(x, y);
    this.type = 'reysol';
    this.t = G.ENEMIES.reysol;
    this.r = this.t.r;
    this.maxHp = this.hp = this.t.hp;
    this.dmg = this.t.dmg;
    this.speed = this.t.speed;
    this.act = 2;
    this.beamCd = 3; this.rainCd = 4; this.summonCd = 6;
    this.volleys = 0;
  }

  update(dt) {
    this.flash = Math.max(0, this.flash - dt);
    this.atk = Math.max(0, this.atk - dt);
    this.cd -= dt;
    if (!this.aggro) return this.wake();
    const frac = this.hp / this.maxHp;
    if (this.phase === 1 && frac < 0.65) {
      this.phase = 2;
      G.banner('¡El Rey llama a sus ángeles!', 2.5);
      G.shake = 0.5;
      this.summonCd = 1;
    }
    if (this.phase === 2 && frac < 0.3) {
      this.phase = 3;
      this.speed *= 1.2;
      G.banner('¡Fase final: el Sol cae sobre ti!', 2.5);
      G.shake = 0.6;
      G.fx.ring(this.x, this.y, 260, '#ffe98a', 0.8);
    }
    this.pickTarget(dt);
    const tg = this.target;
    if (!tg) return;
    const d = G.U.dist(this, tg);
    if (this.updateCharge(dt)) { this.hitWall = false; return; }

    if (this.state === 'beam') {
      this.timer -= dt;
      this.facing = G.U.angle(this, G.player);
      if (this.timer <= 0) {
        // abanico de rayos solares
        const n = this.phase >= 2 ? 9 : 7;
        for (let i = 0; i < n; i++) {
          const a = this.facing + (i - (n - 1) / 2) * 0.2;
          const pr = new Proj(this, a, 300);
          pr.dmg = 10;
          G.projs.push(pr);
        }
        this.atk = 0.2;
        this.volleys--;
        this.timer = 0.45;
        if (this.volleys <= 0) { this.state = 'chase'; this.beamCd = 5; }
      }
      this.hitWall = false;
      return;
    }

    this.facing = G.U.angle(this, tg);
    const reach = this.r + tg.r + this.t.range;
    if (d > reach) this.moveToward(tg.x, tg.y, this.speed * (d > 250 ? 1 : 0.7), dt);
    else if (this.cd <= 0) this.swordSwing(reach);

    this.beamCd -= dt;
    this.chargeCd -= dt;
    if (this.beamCd <= 0 && d > 90) {
      this.state = 'beam';
      this.timer = 0.6;
      this.volleys = this.phase >= 2 ? 3 : 2;
    } else if (this.chargeCd <= 0 && d > 140) {
      this.state = 'chargeWind';
      this.timer = 0.7;
      this.chargeAng = G.U.angle(this, G.player);
    }
    if (this.phase >= 2) {
      this.summonCd -= dt;
      if (this.summonCd <= 0) this.summon('angel', 2, 16);
    }
    if (this.phase >= 3) {
      this.rainCd -= dt;
      if (this.rainCd <= 0) {
        this.rainCd = 3.2;
        const p = G.player;
        for (let i = 0; i < 6; i++) {
          const a = Math.random() * Math.PI * 2, rr = i === 0 ? 0 : G.U.rand(40, 200);
          G.addHazard(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr, 60, 1.3 + i * 0.1, 22, 50);
        }
      }
    }
    this.hitWall = false;
  }

  drawTelegraphs(ctx) {
    super.drawTelegraphs(ctx);
    if (this.state === 'beam') {
      ctx.strokeStyle = 'rgba(255,233,138,0.25)';
      ctx.lineWidth = 3;
      const n = this.phase >= 2 ? 9 : 7;
      for (let i = 0; i < n; i++) {
        const a = this.facing + (i - (n - 1) / 2) * 0.16;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + Math.cos(a) * 120, this.y + Math.sin(a) * 120);
        ctx.stroke();
      }
    }
  }
}

// ---------- Arcángel Seraphiel (jefe final, Acto III) ----------
class ArchangelBoss extends Boss {
  constructor(x, y) {
    super(x, y);
    this.type = 'arcangel';
    this.t = G.ENEMIES.arcangel;
    this.r = this.t.r;
    this.maxHp = this.hp = this.t.hp;
    this.dmg = this.t.dmg;
    this.speed = this.t.speed;
    this.final = true;
    this.act = 3;
    this.lanceCd = 3; this.ringCd = 2; this.summonCd = 2; this.judgeCd = 2;
    this.chargeCd = 6;
  }

  // lanzas de luz: filas de círculos que estallan desde el arcángel hacia el objetivo
  lances() {
    const n = this.phase >= 2 ? 5 : 3;
    const base = G.U.angle(this, G.player);
    for (let j = 0; j < n; j++) {
      const a = base + (j - (n - 1) / 2) * 0.35;
      for (let k = 1; k <= 8; k++) {
        G.addHazard(this.x + Math.cos(a) * k * 55, this.y + Math.sin(a) * k * 55, 32, 0.8 + k * 0.06, 18, 35, '#bfe8ff');
      }
    }
    this.atk = 0.2;
    this.lanceCd = this.phase >= 3 ? 3.5 : 5;
  }

  ring() {
    const n = this.phase >= 3 ? 20 : 14;
    const off = Math.random();
    for (let i = 0; i < n; i++) {
      const pr = new Proj(this, (i / n) * Math.PI * 2 + off, 240);
      pr.dmg = 10;
      pr.life = 2.2;
      G.projs.push(pr);
    }
    G.fx.ring(this.x, this.y, 60, '#fff8e0', 0.4);
    this.ringCd = this.phase >= 3 ? 4 : 6;
  }

  update(dt) {
    this.flash = Math.max(0, this.flash - dt);
    this.atk = Math.max(0, this.atk - dt);
    this.cd -= dt;
    if (!this.aggro) return this.wake();
    const frac = this.hp / this.maxHp;
    if (this.phase === 1 && frac < 0.6) {
      this.phase = 2;
      this.summonCd = 0.5;
      G.banner('¡Seraphiel despliega sus alas!', 2.5);
      G.shake = 0.5;
      G.fx.ring(this.x, this.y, 240, '#bfe8ff', 0.8);
    }
    if (this.phase === 2 && frac < 0.3) {
      this.phase = 3;
      this.speed *= 1.2;
      G.banner('¡El Juicio Final ha comenzado!', 2.5);
      G.shake = 0.6;
      G.fx.ring(this.x, this.y, 300, '#fff8e0', 0.9);
      G.fx.burst(this.x, this.y, '#fff8e0', 60, 320, 0.8);
    }
    this.pickTarget(dt);
    const tg = this.target;
    if (!tg) return;
    const d = G.U.dist(this, tg);
    if (this.updateCharge(dt)) { this.hitWall = false; return; }

    this.facing = G.U.angle(this, tg);
    const reach = this.r + tg.r + this.t.range;
    if (d > reach) this.moveToward(tg.x, tg.y, this.speed * (d > 250 ? 1 : 0.75), dt);
    else if (this.cd <= 0) this.swordSwing(reach);

    this.lanceCd -= dt;
    this.chargeCd -= dt;
    if (this.lanceCd <= 0) this.lances();
    else if (this.chargeCd <= 0 && d > 140) {
      this.state = 'chargeWind';
      this.timer = 0.65;
      this.chargeAng = G.U.angle(this, G.player);
    }
    if (this.phase >= 2) {
      this.ringCd -= dt;
      this.summonCd -= dt;
      if (this.ringCd <= 0) this.ring();
      if (this.summonCd <= 0) this.summon('querubin', 3, 15);
    }
    if (this.phase >= 3) {
      this.judgeCd -= dt;
      if (this.judgeCd <= 0) {
        this.judgeCd = 2.6;
        const p = G.player;
        for (let i = 0; i < 5; i++) {
          const a = Math.random() * Math.PI * 2, rr = i === 0 ? 0 : G.U.rand(50, 180);
          G.addHazard(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr, 58, 1.2 + i * 0.08, 24, 50);
        }
      }
    }
    this.hitWall = false;
  }
}

window.Orb = Orb;
window.Proj = Proj;
window.Player = Player;
window.Unit = Unit;
window.Dummy = Dummy;
window.Boss = Boss;
window.KingBoss = KingBoss;
window.ArchangelBoss = ArchangelBoss;
