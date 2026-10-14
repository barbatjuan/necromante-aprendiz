// Libro de Necromancia: hechizos (E, Q, F) y rituales de mejora (solo en el altar).
G.book = {
  btns: [],

  // cadáver más cercano al jugador dentro del alcance
  corpseInReach(range = 90) {
    return G.nearest(G.player, G.corpses, range);
  },

  raise() {
    const c = this.corpseInReach();
    if (!c) return G.banner('No hay cadáveres cerca', 1.2);
    if (G.allies.filter(a => !a.dead).length >= G.maxAllies()) {
      return G.banner('Demasiados siervos. Mejora "Legión" en el altar de la guarida', 2);
    }
    const cost = G.reviveCost(c.t);
    if (G.essence < cost) return G.banner(`Esencia insuficiente (${cost} necesaria)`, 1.5);
    G.essence -= cost;
    G.corpses.splice(G.corpses.indexOf(c), 1);
    const a = new Unit(c.type, c.x, c.y, 'ally');
    a.facing = c.rot;
    G.allies.push(a);
    G.stats.raised++;
    G.fx.burst(c.x, c.y, '#3fcf8e', 26, 180, 0.8, 4);
    G.fx.ring(c.x, c.y, 50, '#5fffae', 0.5);
    G.fx.text(c.x, c.y - 30, '¡Álzate!', '#7dffb8');
  },

  explode() {
    if (!G.qUnlocked()) return G.banner('Aún no conoces ese hechizo', 1.2);
    const p = G.player;
    if (p.qCd > 0) return;
    // prioriza el cadáver cerca del cursor, si no el más cercano al jugador
    let c = G.nearest(G.mw, G.corpses.filter(k => G.U.dist(k, p) < 320), 80);
    if (!c) c = G.nearest(p, G.corpses, 320);
    if (!c) return G.banner('Necesitas un cadáver cerca para detonar', 1.4);
    G.corpses.splice(G.corpses.indexOf(c), 1);
    p.qCd = 3;
    const dmg = (45 + c.t.hp * 0.3) * G.spellMult();
    G.fx.ring(c.x, c.y, 110, '#9dff5f', 0.4);
    G.fx.burst(c.x, c.y, '#7acf3f', 40, 280, 0.6, 4);
    G.fx.burst(c.x, c.y, '#5a2a5a', 20, 180, 0.8, 5);
    G.shake = Math.min(0.4, G.shake + 0.2);
    for (const e of G.enemiesAlive()) {
      if (G.U.dist(c, e) < 100 + e.r) G.damage(e, dmg, p);
    }
  },

  // Cosecha de Almas: daña a enemigos cercanos y te cura con lo drenado
  harvest() {
    if (!G.fUnlocked()) return G.banner('Aún no conoces ese hechizo', 1.2);
    const p = G.player;
    if (p.fCd > 0) return;
    p.fCd = 8;
    const R = 150;
    let drained = 0;
    G.fx.ring(p.x, p.y, R, '#b57cff', 0.5);
    for (const e of G.enemiesAlive()) {
      if (G.U.dist(p, e) < R + e.r) {
        drained += G.damage(e, 28 * G.spellMult(), p) || 0;
        // hilo de alma
        for (let i = 0; i < 5; i++) {
          const k = i / 5;
          G.fx.burst(e.x + (p.x - e.x) * k, e.y + (p.y - e.y) * k, '#c89bff', 1, 30, 0.5, 3);
        }
      }
    }
    const heal = Math.round(drained * 0.5);
    if (heal > 0) {
      p.hp = Math.min(p.maxHp, p.hp + heal);
      G.fx.text(p.x, p.y - 34, '+' + heal, '#7dffb8');
    }
    for (const a of G.allies) a.hp = Math.min(a.maxHp, a.hp + Math.round(heal * 0.3));
  },

  // Furia Necrótica: siervos +50% daño, +50% velocidad de ataque y +30% movimiento
  frenzy() {
    if (!G.vUnlocked()) return G.banner('Aún no conoces ese hechizo', 1.2);
    const p = G.player;
    if (p.vCd > 0) return;
    if (!G.allies.some(a => !a.dead)) return G.banner('No tienes siervos que enfurecer', 1.4);
    p.vCd = 20;
    G.frenzy = 6;
    G.banner('¡FURIA NECRÓTICA!', 1.2);
    for (const a of G.allies) {
      G.fx.burst(a.x, a.y, '#ff4a4a', 12, 120, 0.5);
      G.fx.ring(a.x, a.y, 30, '#ff6a6a', 0.4);
    }
  },

  buy(i) {
    if (!G.nearAltar()) return;
    const u = G.UPGRADES[i];
    if (!u) return;
    const lvl = G.up[u.id];
    if (lvl >= u.max) return;
    const cost = G.upCost(u);
    if (G.essence < cost) return;
    G.essence -= cost;
    G.up[u.id]++;
    if (u.id === 'carne') {
      G.player.maxHp = G.playerMaxHp();
      G.player.hp = G.player.maxHp;
    }
    if (u.id === 'vigor') {
      for (const a of G.allies) {
        const m = G.allyMult();
        const frac = a.hp / a.maxHp;
        a.maxHp = Math.round(a.t.hp * m);
        a.hp = a.maxHp * frac;
        a.dmg = a.t.dmg * m;
      }
    }
    G.fx.burst(G.player.x, G.player.y, '#b57cff', 20, 140, 0.6);
    G.save();
  },

  update() {
    for (let i = 0; i < G.UPGRADES.length; i++) {
      if (G.wasPressed(String(i + 1))) this.buy(i);
    }
    if (G.mouse.clicked) {
      for (const b of this.btns) {
        if (G.U.pointInRect(G.mouse.x, G.mouse.y, b)) this.buy(b.i);
      }
    }
  },

  draw(ctx) {
    const U = G.U;
    ctx.fillStyle = 'rgba(5,2,10,0.7)';
    ctx.fillRect(0, 0, G.W, G.H);
    const bx = 100, by = 50, bw = 760, bh = 540;
    ctx.fillStyle = '#3b1f14';
    ctx.fillRect(bx - 14, by - 14, bw + 28, bh + 28);
    ctx.fillStyle = '#d8c9a3';
    ctx.fillRect(bx, by, bw / 2 - 4, bh);
    ctx.fillRect(bx + bw / 2 + 4, by, bw / 2 - 4, bh);
    ctx.fillStyle = '#2a140c';
    ctx.fillRect(bx + bw / 2 - 4, by, 8, bh);

    const ink = '#2a1a10';
    const L = bx + 24, R = bx + bw / 2 + 28;
    const line = (s, x, y, size = 14, color = ink, bold = false) => {
      ctx.font = `${bold ? 'bold ' : ''}${size}px "Trebuchet MS", Verdana, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.fillText(s, x, y);
    };

    U.text(ctx, 'Libro de Necromancia', bx + bw / 4, by + 26, 22, '#4a1a5a', 'center', true);
    line('[E] Alzar Muerto', L, by + 58, 15, '#1f5a3a', true);
    line('Costo de esencia por tipo:', L, by + 78, 13);
    let y = by + 100;
    const types = [
      ['aldeano', 0], ['guardia', 0], ['arquero', 1], ['sacerdote', 2], ['bruto', 2], ['capitan', 2], ['caballero', 4], ['mago', 4],
      ['inquisidor', 5], ['angel', 5], ['archimago', 5], ['querubin', 7], ['centinela', 7], ['serafin', 7], ['juez', 8],
    ];
    types.forEach(([k, zoneNeeded], idx) => {
      const t = G.ENEMIES[k];
      const col = idx < 8 ? 0 : 1;
      const row = idx < 8 ? idx : idx - 8;
      const x = L + col * 170, yy = y + row * 22;
      if (G.maxZone >= zoneNeeded) {
        G.S.humanoid(ctx, { x: x + 8, y: yy + 2, s: 0.65, face: 0, look: G.undeadLook(k, t.look), noAura: true });
        line(t.name.split(' ')[0], x + 22, yy, 13);
        line(`${G.reviveCost(t)}`, x + 128, yy, 13, '#5a1a7a', true);
      } else {
        line('???', x + 22, yy, 13, '#8a7f70');
      }
    });
    y += 8 * 22 + 8;
    const spells = [
      ['[Q] Explosión de Cadáver', 'Detona un cadáver: daño en área.', '??? (se aprende en el Bosque)', G.qUnlocked(), '#5a3a0a'],
      ['[F] Cosecha de Almas', 'Drena a enemigos cercanos y te cura.', '??? (se aprende en el Acto II)', G.fUnlocked(), '#4a1a6a'],
      ['[V] Furia Necrótica', 'Siervos más rápidos y letales 6 s.', '??? (se aprende en el Acto III)', G.vUnlocked(), '#7a1a1a'],
    ];
    for (const [name, desc, locked, ok, color] of spells) {
      line(name, L, y, 15, ok ? color : '#8a7f70', true);
      line(ok ? desc : locked, L, y + 19, 13, ok ? ink : '#8a7f70');
      y += 44;
    }
    line('[R] Ordenar: marca al enemigo bajo el cursor.', L, y, 13);
    line(`Siervos: ${G.allies.filter(a => !a.dead).length} / ${G.maxAllies()}`, L, y + 24, 14, '#1f5a3a', true);

    // página derecha: rituales
    U.text(ctx, 'Rituales de Poder', bx + (bw * 3) / 4, by + 26, 22, '#4a1a5a', 'center', true);
    line(`Esencia: ${G.essence}`, R, by + 56, 16, '#5a1a7a', true);
    const atAltar = G.nearAltar();
    if (!atAltar) line('Solo en el Altar de tu guarida', R + 130, by + 56, 12, '#8a3a2a', true);
    this.btns = [];
    y = by + 84;
    G.UPGRADES.forEach((u, i) => {
      const lvl = G.up[u.id];
      const maxed = lvl >= u.max;
      const cost = G.upCost(u);
      const can = atAltar && !maxed && G.essence >= cost;
      const rect = { x: R - 8, y: y - 6, w: bw / 2 - 52, h: 50, i };
      const hover = U.pointInRect(G.mouse.x, G.mouse.y, rect);
      ctx.fillStyle = hover && can ? 'rgba(90,30,120,0.2)' : 'rgba(60,30,20,0.08)';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = can ? '#5a1a7a' : '#a89a80';
      ctx.lineWidth = 2;
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      line(`[${i + 1}] ${u.name}`, R, y + 5, 15, can ? '#3a0a4a' : '#6a5a4a', true);
      line(u.desc, R, y + 22, 12);
      for (let k = 0; k < u.max; k++) {
        ctx.fillStyle = k < lvl ? '#5a1a7a' : '#b8a888';
        ctx.fillRect(R + k * 13, y + 33, 9, 6);
      }
      line(maxed ? 'MÁX' : `${cost}`, rect.x + rect.w - 56, y + 5, 14, can ? '#5a1a7a' : '#8a3a2a', true);
      this.btns.push(rect);
      y += 56;
    });
    U.text(ctx, 'B / Esc para cerrar', G.W / 2, by + bh + 28, 14, '#c9b8e8', 'center');
  },
};
