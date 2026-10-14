G.bannerMsg = null;
// local = true: solo en esta pantalla (no se reenvía a los invitados)
G.banner = (text, time = 2, local = false) => {
  G.bannerMsg = { text, time, max: time };
  if (!local && G.isHost && G.isHost()) G.net.events.push(['n', text, time]);
};

// ---------- Diálogos ----------
G.dialog = null;
G.say = (name, lines, look) => {
  G.dialog = { name, lines, i: 0, look, shown: 0 };
  G.state = 'dialog';
};

G.talkMentor = () => {
  const M = 'Maestro Mortis';
  let lines;
  if (!G.seen.intro) {
    G.seen.intro = true;
    lines = [
      'Al fin despiertas, aprendiz. Soy Mortis, tu maestro... o lo que queda de él.',
      'Los reinos de los vivos nos quemaron por practicar el Arte. Hoy empieza nuestra venganza.',
      'Golpea a los vivos con tu hoz. Al morir sueltan ESENCIA: recógela.',
      'Con esencia y tu libro puedes ALZAR sus cadáveres [E]. Te servirán para siempre.',
      'Vuelve aquí para gastar esencia en el ALTAR. Allí se realizan los rituales de poder.',
      'Cruza el portal de la Aldea Olvidada. Que empiece la cosecha.',
    ];
  } else if (G.seen.victory) {
    lines = [
      'Seraphiel ha caído. Ni el cielo ni la tierra tienen ya quien te desafíe.',
      'El mundo es tuyo, Maestro. Sí... ahora te llamo Maestro. Yo solo soy tu siervo más viejo.',
      'Los portales siguen abiertos si deseas cosechar más almas.',
    ];
  } else if (G.maxZone >= 9) {
    lines = [
      'Seraphiel, el Arcángel, te espera en el Trono Celestial. Es el último obstáculo.',
      'Sus LANZAS DE LUZ marcan filas de círculos en el suelo: sal de ellas antes de que estallen.',
      'Herido, lanzará anillos de luz e invocará querubines. Al final, el Juicio caerá sobre ti sin descanso.',
      'Usa la Furia [V] cuando tus siervos lo rodeen. Y no dejes de moverte.',
    ];
  } else if (G.maxZone >= 7) {
    lines = [
      'El Rey Sol ha caído... y los cielos han respondido. Los ángeles bajan a detenerte.',
      'Si un reino no basta, tomaremos también el cielo. Abre la Escalera Celestial.',
      'Te enseño mi último secreto: FURIA NECRÓTICA [V]. Tus siervos atacarán con rabia durante unos segundos.',
      'Los Centinelas golpean en área y resisten mucho. Los Serafines disparan en abanico. Los querubines atacan en enjambre.',
      'Y cuidado con el Juez Uriel en el Santuario de Cristal. Si lo vences, alzarlo sería... glorioso.',
    ];
  } else if (G.maxZone >= 6) {
    lines = [
      'El Rey Sol Aurelio espera en su trono. Su luz quema a los no-muertos.',
      'En su última fase hará caer el sol sobre ti: no te quedes quieto dentro de los círculos.',
      'Lleva un ejército grande. Y usa la Cosecha [F] para sobrevivir.',
    ];
  } else if (G.maxZone >= 4) {
    lines = [
      'El Paladín ha muerto. Pero él solo servía a un amo mayor: el Rey Sol de Solaria.',
      'Sus caballeros cargan, sus magos lanzan fuego y sus inquisidores odian a los muertos.',
      'Te enseño un hechizo nuevo: COSECHA DE ALMAS [F]. Drena a los vivos a tu alrededor y te cura.',
      'Si te cuesta avanzar, vuelve a zonas conquistadas y cosecha más esencia.',
    ];
  } else if (G.maxZone >= 3) {
    lines = [
      'La Catedral de la Luz... el Paladín Sagrado vigila ahí.',
      'Carga en línea recta: apártate cuando veas la franja brillante.',
      'Cuando esté herido, su luz dañará mucho a tus siervos. Aléjalos de los círculos.',
    ];
  } else if (G.maxZone >= 1) {
    lines = [
      'Bien hecho. Ahora conoces la EXPLOSIÓN DE CADÁVER [Q].',
      'Un cadáver que no puedes alzar sigue siendo un arma.',
      'Usa [R] sobre un enemigo para que tus siervos lo ataquen primero. Los arqueros son un buen objetivo.',
    ];
  } else {
    const tips = [
      'Recoge la esencia de los caídos y alza sus cadáveres con [E].',
      'El muñeco de práctica no se queja. Pruébalo.',
      'Los guardias llevan escudo: resisten más tus golpes.',
    ];
    lines = [tips[Math.floor(Math.random() * tips.length)]];
  }
  G.say(M, lines, G.MENTOR_LOOK);
};

G.updateDialog = dt => {
  const d = G.dialog;
  d.shown += dt * 60;
  const full = d.lines[d.i];
  if (G.wasPressed('e') || G.wasPressed('enter') || G.wasPressed(' ') || G.mouse.clicked) {
    if (d.shown < full.length) d.shown = full.length;
    else {
      d.i++;
      d.shown = 0;
      if (d.i >= d.lines.length) {
        G.dialog = null;
        G.state = 'play';
      }
    }
  }
  if (G.wasPressed('escape')) {
    G.dialog = null;
    G.state = 'play';
  }
};

function wrap(ctx, text, maxW) {
  const words = text.split(' ');
  const out = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t;
  }
  if (cur) out.push(cur);
  return out;
}

G.ui = {
  hint() {
    const p = G.player;
    if (G.world.lobby) {
      if (G.U.dist(p, G.mentor) < 70) return '[E] Hablar con Maestro Mortis';
      if (G.nearAltar()) return '[E] Altar Oscuro: realizar rituales de poder';
      if (!G.seen.intro) return 'Habla con el Maestro Mortis (esqueleto encapuchado).';
      for (const pt of G.world.portals) {
        if (G.U.dist(p, pt) < 80) return G.portalUnlocked(pt.i) ? `Portal: ${pt.z.name}` : 'Portal sellado: conquista la zona anterior';
      }
      return 'Entra en un portal para viajar. El altar y el maestro esperan.';
    }
    if (G.zone === 0) {
      if (G.stats.kills === 0) return 'WASD para moverte. Clic izquierdo (o J) para golpear con tu hoz.';
      if (G.stats.raised === 0) {
        return G.corpses.length ? 'Acércate a un cadáver y pulsa E para alzarlo como siervo.' : 'Recoge la esencia morada de los caídos.';
      }
    }
    if (G.world.open) {
      return G.world.door ? 'Puerta del este abierta → siguiente zona. Portal verde → guarida.' : 'Portal verde → volver a la guarida.';
    }
    const c = G.book.corpseInReach();
    if (c && G.book.alliesOf(G.player).length < G.maxAllies()) {
      return `[E] Alzar ${c.t.name} (${G.reviveCost(c.t)} esencia)`;
    }
    if (p.hp < p.maxHp * 0.3) return G.fUnlocked() ? 'Vida baja: usa Cosecha [F] o aléjate para regenerarte.' : 'Vida baja: aléjate del combate para regenerarte.';
    return '';
  },

  drawWorldOverlay(ctx) {
    if (G.world.lobby) return;
    const c = G.book.corpseInReach();
    if (c) {
      ctx.strokeStyle = `rgba(95,255,174,${0.5 + Math.sin(G.time * 6) * 0.3})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.r + 12, c.r + 6, 0, 0, Math.PI * 2);
      ctx.stroke();
      G.U.text(ctx, `E · ${G.reviveCost(c.t)}`, c.x, c.y - c.r - 20, 13, '#7dffb8', 'center', true);
    }
  },

  drawHUD(ctx) {
    const U = G.U, p = G.player;
    ctx.fillStyle = 'rgba(10,6,16,0.7)';
    ctx.fillRect(12, 12, 250, 74);
    U.bar(ctx, 22, 22, 230, 16, p.hp / p.maxHp, '#b03a5a');
    U.text(ctx, `${Math.ceil(p.hp)} / ${p.maxHp}`, 137, 30, 12, '#fff', 'center', true);
    ctx.fillStyle = '#b57cff';
    U.poly(ctx, 30, 56, 7, 4, 0);
    ctx.fill();
    U.text(ctx, `${G.essence}`, 44, 56, 18, '#d8b8ff', 'left', true);
    const n = G.book.alliesOf(G.player).length;
    G.S.humanoid(ctx, { x: 132, y: 56, s: 0.6, face: 0, look: G.undeadLook('aldeano', G.ENEMIES.aldeano.look), noAura: true });
    U.text(ctx, `${n} / ${G.maxAllies()}`, 144, 56, 16, '#7dffb8', 'left', true);
    if (!G.world.lobby) U.text(ctx, `Zona ${G.zone + 1}/${G.ZONES.length}`, 250, 76, 11, '#998', 'right');

    U.text(ctx, G.world.zone.name, G.W - 16, 24, 15, '#c9b8e8', 'right', true);
    if (!G.world.lobby && !G.world.zone.boss) U.text(ctx, `Enemigos: ${G.enemiesAlive().length}`, G.W - 16, 44, 13, '#aaa', 'right');

    const boss = G.enemies.find(e => !e.dead && (e.boss || e.t.miniboss) && e.aggro);
    if (boss) {
      const bw = 460;
      ctx.fillStyle = 'rgba(10,6,16,0.75)';
      ctx.fillRect(G.W / 2 - bw / 2 - 8, 14, bw + 16, 40);
      U.text(ctx, boss.t.name, G.W / 2, 25, 14, '#fff6c0', 'center', true);
      U.bar(ctx, G.W / 2 - bw / 2, 36, bw, 10, boss.hp / boss.maxHp, boss.boss ? '#e8c95a' : '#8aa0d0');
    }

    const skills = [
      { key: 'Clic', name: 'Hoz', cd: Math.max(0, p.atkCd) / 0.42, ok: true },
      { key: 'E', name: G.world.lobby ? 'Usar' : 'Alzar', cd: 0, ok: true },
      { key: 'Q', name: 'Explotar', cd: Math.max(0, p.qCd) / 3, ok: G.qUnlocked() },
      { key: 'F', name: 'Cosecha', cd: Math.max(0, p.fCd) / 8, ok: G.fUnlocked() },
      { key: 'V', name: 'Furia', cd: Math.max(0, p.vCd) / 20, ok: G.vUnlocked() },
      { key: 'R', name: 'Ordenar', cd: 0, ok: true },
      { key: 'B', name: 'Libro', cd: 0, ok: true },
    ];
    const sw = 60, gap = 8, total = skills.length * sw + (skills.length - 1) * gap;
    let x = G.W / 2 - total / 2;
    const y = G.H - 72;
    for (const s of skills) {
      ctx.fillStyle = s.ok ? 'rgba(30,16,46,0.85)' : 'rgba(20,20,20,0.7)';
      ctx.fillRect(x, y, sw, 56);
      ctx.strokeStyle = s.ok ? '#7a4fc9' : '#444';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, sw, 56);
      if (s.cd > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(x, y + 56 * (1 - s.cd), sw, 56 * s.cd);
      }
      U.text(ctx, s.key, x + sw / 2, y + 19, 15, s.ok ? '#fff' : '#666', 'center', true);
      U.text(ctx, s.ok ? s.name : '???', x + sw / 2, y + 40, 11, s.ok ? '#c9b8e8' : '#666', 'center');
      x += sw + gap;
    }

    const hint = this.hint();
    if (hint) U.text(ctx, hint, G.W / 2, G.H - 90, 14, '#e8e0ff', 'center');

    // flecha a la salida
    if (G.world.open && G.world.door) {
      const d = G.world.door;
      const tx = d.x - G.cam.x, ty = d.y + d.h / 2 - G.cam.y;
      if (tx > G.W - 20 || tx < 0 || ty < 0 || ty > G.H) {
        const a = Math.atan2(ty - G.H / 2, tx - G.W / 2);
        ctx.fillStyle = '#5fffae';
        U.poly(ctx, G.W / 2 + Math.cos(a) * 280, G.H / 2 + Math.sin(a) * 220, 14, 3, a);
        ctx.fill();
      }
    }

    // multijugador: sala y compañeros
    if (G.net) {
      ctx.fillStyle = 'rgba(10,6,16,0.7)';
      ctx.fillRect(12, 92, 250, 24 + G.players.length * 18);
      U.text(ctx, `Sala ${G.net.code} · ${G.players.length}/4`, 22, 104, 13, '#ffd84a', 'left', true);
      G.players.forEach((pl, i) => {
        const yy = 124 + i * 18;
        const col = G.PLAYER_LOOKS[pl.color % 4].aura;
        U.text(ctx, pl.name + (pl === G.player ? ' (tú)' : ''), 22, yy, 12, col, 'left', true);
        if (pl.dead) U.text(ctx, `cae... ${Math.ceil(pl.respawn)}s`, 252, yy, 11, '#e04560', 'right');
        else U.bar(ctx, 160, yy - 4, 92, 7, pl.hp / pl.maxHp, '#b03a5a');
      });
    }
    if (p.dead && G.state === 'play') {
      ctx.fillStyle = 'rgba(40,0,10,0.35)';
      ctx.fillRect(0, 0, G.W, G.H);
      U.text(ctx, `Has caído. Reapareces junto a un compañero en ${Math.max(0, Math.ceil(p.respawn))} s`, G.W / 2, G.H / 2, 20, '#ff9a9a', 'center', true);
    }

    const b = G.bannerMsg;
    if (b && b.time > 0) {
      ctx.globalAlpha = Math.max(0, Math.min(1, b.time * 2, (b.max - b.time) * 4 + 0.2));
      ctx.fillStyle = 'rgba(10,6,16,0.7)';
      ctx.fillRect(0, 110, G.W, 44);
      U.text(ctx, b.text, G.W / 2, 132, 22, '#e8d8ff', 'center', true);
      ctx.globalAlpha = 1;
    }
  },

  drawDialog(ctx) {
    const d = G.dialog;
    if (!d) return;
    const x = 60, y = G.H - 190, w = G.W - 120, h = 150;
    ctx.fillStyle = 'rgba(12,8,20,0.92)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#7a4fc9';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    // retrato
    ctx.fillStyle = '#1c1622';
    ctx.fillRect(x + 14, y + 14, 110, 122);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 14, y + 14, 110, 122);
    ctx.clip();
    G.S.humanoid(ctx, { x: x + 69, y: y + 110, s: 4, face: 0, look: d.look, seed: 3, noAura: true });
    ctx.restore();
    G.U.text(ctx, d.name, x + 142, y + 26, 17, '#7dffb8', 'left', true);
    const text = d.lines[d.i].slice(0, Math.floor(d.shown));
    ctx.font = '16px "Trebuchet MS", Verdana, sans-serif';
    const lines = wrap(ctx, text, w - 170);
    lines.forEach((l, i) => G.U.text(ctx, l, x + 142, y + 56 + i * 22, 16, '#e8e0ff'));
    G.U.text(ctx, `${d.i + 1}/${d.lines.length}   [E] continuar`, x + w - 14, y + h - 16, 12, '#9d8bc8', 'right');
  },

  drawCursor(ctx) {
    const { x, y } = G.mouse;
    ctx.strokeStyle = '#d8b8ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.moveTo(x - 13, y); ctx.lineTo(x - 5, y);
    ctx.moveTo(x + 5, y); ctx.lineTo(x + 13, y);
    ctx.moveTo(x, y - 13); ctx.lineTo(x, y - 5);
    ctx.moveTo(x, y + 5); ctx.lineTo(x, y + 13);
    ctx.stroke();
  },

  overlay(ctx, alpha = 0.75) {
    ctx.fillStyle = `rgba(5,2,10,${alpha})`;
    ctx.fillRect(0, 0, G.W, G.H);
  },

  drawTitle(ctx) {
    const U = G.U;
    ctx.fillStyle = '#0d0a12';
    ctx.fillRect(0, 0, G.W, G.H);
    for (let i = 0; i < 40; i++) {
      const x = (i * 97 + G.time * 20 * ((i % 3) + 1)) % G.W;
      const y = G.H - ((i * 53 + G.time * 30) % G.H);
      ctx.fillStyle = i % 2 ? 'rgba(181,124,255,0.35)' : 'rgba(63,207,142,0.3)';
      ctx.fillRect(x, y, 3, 3);
    }
    // ejército
    const army = ['guardia', 'arquero', 'bruto', 'aldeano', 'caballero', 'mago'];
    army.forEach((k, i) => {
      const side = i % 2 ? 1 : -1;
      const x = G.W / 2 + side * (110 + Math.floor(i / 2) * 70), y = 300 + Math.floor(i / 2) * 14;
      G.S.shadow(ctx, x, y, 20);
      G.S.humanoid(ctx, { x, y, s: 1.6, face: side > 0 ? Math.PI : 0, look: G.undeadLook(k, G.ENEMIES[k].look), seed: i });
    });
    G.S.shadow(ctx, G.W / 2, 290, 26);
    G.S.humanoid(ctx, { x: G.W / 2, y: 280, s: 2.4, face: Math.PI / 2 + Math.sin(G.time) * 0.3, look: G.PLAYER_LOOK });

    U.text(ctx, 'NECROMANTE', G.W / 2, 90, 64, '#b57cff', 'center', true);
    U.text(ctx, 'APRENDIZ', G.W / 2, 148, 34, '#7dffb8', 'center', true);
    U.text(ctx, 'Derrota a los vivos. Roba su esencia. Alza a sus muertos. Domina el mundo.', G.W / 2, 190, 15, '#c9b8e8', 'center');

    const has = G.hasSave();
    U.text(ctx, has ? '[Enter] Continuar      [N] Nueva partida' : '[Enter] Comenzar', G.W / 2, 380, 20, '#fff', 'center', true);
    U.text(ctx, 'MULTIJUGADOR:   [H] Crear sala      [U] Unirse a sala', G.W / 2, 416, 17, '#ffd84a', 'center', true);
    if (G.titleMsg) U.text(ctx, G.titleMsg, G.W / 2, 446, 14, '#ff9a9a', 'center', true);
    const lines = [
      'WASD moverse · Ratón apuntar · Clic/J golpe de hoz',
      'E alzar muerto / usar · Q explosión de cadáver · F cosecha de almas',
      'V furia necrótica · R ordenar siervos · B libro · Esc pausa',
    ];
    lines.forEach((s, i) => U.text(ctx, s, G.W / 2, 486 + i * 24, 14, '#a898c8', 'center'));
  },

  drawJoin(ctx) {
    const U = G.U;
    ctx.fillStyle = '#0d0a12';
    ctx.fillRect(0, 0, G.W, G.H);
    U.text(ctx, G.state === 'join' ? 'UNIRSE A UNA SALA' : 'MULTIJUGADOR', G.W / 2, 140, 36, '#ffd84a', 'center', true);
    if (G.state === 'join') {
      U.text(ctx, 'Escribe el código de 5 letras que te dio el anfitrión', G.W / 2, 200, 16, '#c9b8e8', 'center');
      for (let i = 0; i < 5; i++) {
        const x = G.W / 2 - 150 + i * 62;
        ctx.strokeStyle = i === G.joinCode.length ? '#ffd84a' : '#7a4fc9';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, 250, 52, 64);
        U.text(ctx, G.joinCode[i] || '', x + 26, 284, 34, '#fff', 'center', true);
      }
      U.text(ctx, '[Enter] Conectar      [Esc] Volver', G.W / 2, 370, 16, '#fff', 'center', true);
    } else {
      U.text(ctx, '. '.repeat(1 + Math.floor(G.time * 3) % 3), G.W / 2, 290, 30, '#d8b8ff', 'center', true);
      U.text(ctx, '[Esc] Cancelar', G.W / 2, 370, 16, '#fff', 'center', true);
    }
    if (G.joinMsg) U.text(ctx, G.joinMsg, G.W / 2, 420, 15, G.state === 'join' ? '#ff9a9a' : '#c9b8e8', 'center', true);
    U.text(ctx, 'Partida cooperativa de hasta 4 necromantes. La guarida y el progreso son del anfitrión.', G.W / 2, 560, 13, '#998', 'center');
  },

  drawPaused(ctx) {
    this.overlay(ctx, 0.6);
    G.U.text(ctx, 'PAUSA', G.W / 2, G.H / 2 - 40, 40, '#d8b8ff', 'center', true);
    G.U.text(ctx, '[Esc] Continuar     [T] Volver al título', G.W / 2, G.H / 2 + 10, 16, '#fff', 'center');
    if (!G.world.lobby) G.U.text(ctx, '[L] Huir a la guarida (la zona se reinicia)', G.W / 2, G.H / 2 + 40, 16, '#7dffb8', 'center');
  },

  drawDead(ctx, guest = false) {
    this.overlay(ctx, 0.7);
    const many = G.players.length > 1;
    G.U.text(ctx, many ? 'HABÉIS CAÍDO' : 'HAS CAÍDO', G.W / 2, G.H / 2 - 50, 44, '#e04560', 'center', true);
    G.U.text(ctx, 'La esencia se dispersa... (se pierde la mitad)', G.W / 2, G.H / 2, 16, '#c9b8e8', 'center');
    G.U.text(ctx, guest ? 'Esperando a que el anfitrión decida...' : '[Enter] Reintentar la zona      [L] Volver a la guarida',
      G.W / 2, G.H / 2 + 40, 18, '#fff', 'center', true);
  },

  drawVictory(ctx, guest = false) {
    if (guest) {
      this.overlay(ctx, 0.8);
      G.U.text(ctx, 'CIELO Y TIERRA SE ARRODILLAN ANTE VOSOTROS', G.W / 2, G.H / 2 - 40, 30, '#7dffb8', 'center', true);
      G.U.text(ctx, 'Esperando al anfitrión...', G.W / 2, G.H / 2 + 20, 18, '#fff', 'center', true);
      return;
    }
    this.overlay(ctx, 0.8);
    G.U.text(ctx, 'CIELO Y TIERRA SE ARRODILLAN ANTE TI', G.W / 2, G.H / 2 - 70, 34, '#7dffb8', 'center', true);
    G.U.text(ctx, 'El aprendiz se ha convertido en Maestro Necromante.', G.W / 2, G.H / 2 - 24, 18, '#d8b8ff', 'center');
    G.U.text(ctx, `Enemigos derrotados: ${G.stats.kills}     Muertos alzados: ${G.stats.raised}`, G.W / 2, G.H / 2 + 20, 16, '#c9b8e8', 'center');
    G.U.text(ctx, '[Enter] Volver a la guarida', G.W / 2, G.H / 2 + 70, 18, '#fff', 'center', true);
  },
};
