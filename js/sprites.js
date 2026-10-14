// Sprites procedurales: personajes humanoides dibujados con formas.
// Todo se dibuja en unidades "base" (radio 14) y se escala.

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

const COLOR_KEYS = ['skin', 'shirt', 'pants', 'hair', 'metal', 'shield', 'hood', 'trim', 'hatc', 'beard', 'cape', 'plume'];
const lookCache = {};

// Paleta de no-muerto: piel verde pálida, ropa podrida, ojos brillantes
G.undeadLook = (type, look) => {
  const key = 'u_' + type;
  if (lookCache[key]) return lookCache[key];
  const u = { ...look, undead: true };
  for (const k of COLOR_KEYS) {
    if (!look[k]) continue;
    u[k] = k === 'skin' ? '#9dbb98' : mix(look[k], '#23332b', 0.55);
  }
  u.halo = false;
  return (lookCache[key] = u);
};

G.corpseLook = (type, look) => {
  const key = 'c_' + type;
  if (lookCache[key]) return lookCache[key];
  const u = { ...look, corpse: true, halo: false };
  for (const k of COLOR_KEYS) if (look[k]) u[k] = mix(look[k], '#3a3640', 0.6);
  return (lookCache[key] = u);
};

G.S = {
  shadow(ctx, x, y, r, alpha = 0.35) {
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.95, r * 0.85, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  // o: { x, y, s, face, walk, moving, flash, atk, look, seed }
  humanoid(ctx, o) {
    const L = o.look;
    const dir = Math.cos(o.face) < 0 ? -1 : 1;
    const c = col => (o.flash ? '#ffffff' : col);
    const walk = o.walk || 0;
    const step = o.moving ? Math.sin(walk) : 0;
    const bob = L.float ? Math.sin(G.time * 3 + (o.seed || 0)) * 2 - 6 : o.moving ? -Math.abs(step) * 1.2 : Math.sin(G.time * 2 + (o.seed || 0)) * 0.4;

    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.scale(o.s * dir, o.s);

    // aura de no-muerto
    if (L.undead && !o.noAura) {
      ctx.fillStyle = 'rgba(63,207,142,0.18)';
      ctx.beginPath();
      ctx.ellipse(0, 13, 13, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.translate(0, bob);

    // alas
    if (L.wings) {
      const f = Math.sin(G.time * 6 + (o.seed || 0)) * 0.25;
      ctx.fillStyle = c(L.undead ? '#6a7a70' : '#fdfdf5');
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.rotate(side * (0.35 + f));
        ctx.beginPath();
        ctx.ellipse(side * 12, -6, 11, 5, side * -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // capa
    if (L.cape) {
      const sway = Math.sin(G.time * 3 + walk) * 1.5;
      ctx.fillStyle = c(L.cape);
      ctx.beginPath();
      ctx.moveTo(-7, -6);
      ctx.lineTo(6, -6);
      ctx.lineTo(4 + sway, 15);
      ctx.lineTo(-11 + sway, 14);
      ctx.closePath();
      ctx.fill();
    }

    // brazo trasero + escudo
    ctx.strokeStyle = c(L.shirt);
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-5, -3);
    ctx.lineTo(-8, 2 - step * 1.5);
    ctx.stroke();

    // piernas o túnica
    if (L.robe) {
      const sw = step * 1.5;
      ctx.fillStyle = c(L.shirt);
      ctx.beginPath();
      ctx.moveTo(-6, -5);
      ctx.lineTo(6, -5);
      ctx.lineTo(9 + sw, 13);
      ctx.lineTo(-9 + sw, 13);
      ctx.closePath();
      ctx.fill();
      if (L.trim) {
        ctx.fillStyle = c(L.trim);
        ctx.fillRect(-9 + sw, 11, 18, 2.5);
        ctx.fillRect(-1, -5, 2, 17);
      }
    } else {
      const l = step * 2.5;
      ctx.fillStyle = c(L.pants || '#333');
      ctx.fillRect(-5, 3, 4, 9 + l);
      ctx.fillRect(1, 3, 4, 9 - l);
      ctx.fillStyle = c('#2a1d14');
      ctx.fillRect(-6, 11 + l, 5.5, 2.5);
      ctx.fillRect(1, 11 - l, 5.5, 2.5);
      // torso
      ctx.fillStyle = c(L.shirt);
      ctx.beginPath();
      ctx.moveTo(-7, -6);
      ctx.lineTo(7, -6);
      ctx.lineTo(6, 5);
      ctx.lineTo(-6, 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = c('#2a1d14');
      ctx.fillRect(-6, 2, 12, 2);
      if (L.metal && (L.hat === 'helmet' || L.hat === 'greathelm' || L.hat === 'plume')) {
        ctx.fillStyle = c(L.metal);
        ctx.fillRect(-7, -6, 14, 3); // hombreras
      }
    }

    // costillas de no-muerto
    if (L.undead) {
      ctx.strokeStyle = 'rgba(210,240,215,0.55)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-4, -3 + i * 2.5);
        ctx.lineTo(4, -3 + i * 2.5);
        ctx.stroke();
      }
    }

    // cabeza
    const hy = -11;
    ctx.fillStyle = c(L.skin);
    ctx.beginPath();
    ctx.arc(0, hy, 6, 0, Math.PI * 2);
    ctx.fill();

    // barba
    if (L.beard) {
      ctx.fillStyle = c(L.beard);
      ctx.beginPath();
      ctx.moveTo(-1, hy + 2);
      ctx.lineTo(6, hy + 2);
      ctx.lineTo(2, hy + 9);
      ctx.closePath();
      ctx.fill();
    }

    // ojos
    const eyeColor = L.undead ? '#7dffb8' : '#1a1a1a';
    const drawEyes = () => {
      if (L.corpse) {
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 1;
        for (const ex of [1, 4]) {
          ctx.beginPath();
          ctx.moveTo(ex - 1, hy - 2); ctx.lineTo(ex + 1, hy);
          ctx.moveTo(ex + 1, hy - 2); ctx.lineTo(ex - 1, hy);
          ctx.stroke();
        }
        return;
      }
      if (L.undead) { ctx.shadowColor = '#7dffb8'; ctx.shadowBlur = 6; }
      ctx.fillStyle = o.flash ? '#fff' : eyeColor;
      ctx.fillRect(0.5, hy - 2, 1.8, 2.2);
      ctx.fillRect(3.5, hy - 2, 1.8, 2.2);
      ctx.shadowBlur = 0;
    };

    // sombreros / cascos
    switch (L.hat) {
      case 'hair':
        drawEyes();
        ctx.fillStyle = c(L.hair);
        ctx.beginPath();
        ctx.arc(0, hy - 1, 6.3, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-6.3, hy - 1, 3, 5);
        break;
      case 'bald':
        drawEyes();
        ctx.strokeStyle = c('#7a4a3a');
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-3, hy - 5); ctx.lineTo(0, hy - 2); ctx.stroke();
        break;
      case 'helmet':
      case 'plume':
        drawEyes();
        ctx.fillStyle = c(L.metal);
        ctx.beginPath();
        ctx.arc(0, hy - 1, 6.8, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-7, hy - 1.5, 14, 2);
        ctx.fillRect(2, hy - 1, 1.6, 4);
        if (L.hat === 'plume') {
          ctx.fillStyle = c(L.plume);
          ctx.beginPath();
          ctx.ellipse(-2, hy - 9, 6, 2.5, -0.4, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'greathelm':
        ctx.fillStyle = c(L.metal);
        ctx.beginPath();
        ctx.arc(0, hy, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = L.undead ? '#7dffb8' : c('#1a1a1a');
        if (L.undead) { ctx.shadowColor = '#7dffb8'; ctx.shadowBlur = 6; }
        ctx.fillRect(-1, hy - 2, 7.5, 1.8);
        ctx.shadowBlur = 0;
        ctx.fillStyle = c(mix(L.metal, '#000000', 0.25));
        ctx.fillRect(-1, hy - 7, 2, 12);
        break;
      case 'hood':
        ctx.fillStyle = c(L.hood);
        ctx.beginPath();
        ctx.arc(-0.5, hy - 0.5, 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = c(L.undead ? '#101812' : mix(L.skin, '#000000', 0.35));
        ctx.beginPath();
        ctx.arc(2, hy + 0.5, 4.5, 0, Math.PI * 2);
        ctx.fill();
        drawEyes();
        break;
      case 'mitre':
        drawEyes();
        ctx.fillStyle = c('#f8f4e8');
        ctx.beginPath();
        ctx.moveTo(-5, hy - 3);
        ctx.lineTo(5, hy - 3);
        ctx.lineTo(4, hy - 13);
        ctx.lineTo(0, hy - 16);
        ctx.lineTo(-4, hy - 13);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = c(L.trim || '#e8c95a');
        ctx.fillRect(-0.8, hy - 13, 1.6, 8);
        ctx.fillRect(-3, hy - 10, 6, 1.6);
        break;
      case 'wizard':
        drawEyes();
        ctx.fillStyle = c(L.hatc);
        ctx.beginPath();
        ctx.ellipse(0, hy - 4, 10, 2.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-6, hy - 4);
        ctx.lineTo(6, hy - 4);
        ctx.lineTo(-3, hy - 20);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = c(L.trim || '#e8a030');
        ctx.fillRect(-6, hy - 6, 12, 1.6);
        break;
      case 'crown':
        drawEyes();
        ctx.fillStyle = c(L.hair);
        ctx.beginPath();
        ctx.arc(0, hy - 1, 6.3, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-6.3, hy - 1, 2.5, 7);
        ctx.fillStyle = c(L.undead ? '#6a7a50' : '#ffd84a');
        ctx.beginPath();
        ctx.moveTo(-6, hy - 5);
        ctx.lineTo(-6, hy - 11);
        ctx.lineTo(-3, hy - 8);
        ctx.lineTo(0, hy - 12);
        ctx.lineTo(3, hy - 8);
        ctx.lineTo(6, hy - 11);
        ctx.lineTo(6, hy - 5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = c('#c02040');
        ctx.fillRect(-1, hy - 8, 2, 2);
        break;
      case 'skull': // Maestro Mortis
        ctx.fillStyle = c(L.hood);
        ctx.beginPath();
        ctx.arc(-0.5, hy - 0.5, 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = c('#dcd8c4');
        ctx.beginPath();
        ctx.arc(2, hy + 0.5, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowColor = '#7dffb8'; ctx.shadowBlur = 8;
        ctx.fillStyle = '#7dffb8';
        ctx.fillRect(0.3, hy - 1, 2, 2);
        ctx.fillRect(3.5, hy - 1, 2, 2);
        ctx.shadowBlur = 0;
        break;
      case 'necro': // jugador
        ctx.fillStyle = c(L.hood);
        ctx.beginPath();
        ctx.moveTo(-8, hy + 4);
        ctx.quadraticCurveTo(-8, hy - 10, 2, hy - 11);
        ctx.quadraticCurveTo(8, hy - 8, 8, hy + 4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#0c0714';
        ctx.beginPath();
        ctx.arc(2.5, hy + 0.5, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowColor = '#b6ffd0'; ctx.shadowBlur = 8;
        ctx.fillStyle = o.flash ? '#fff' : '#b6ffd0';
        ctx.fillRect(1, hy - 0.5, 1.8, 1.8);
        ctx.fillRect(4, hy - 0.5, 1.8, 1.8);
        ctx.shadowBlur = 0;
        break;
      default:
        drawEyes();
    }

    // halo
    if (L.halo) {
      ctx.strokeStyle = '#ffe98a';
      ctx.shadowColor = '#ffe98a';
      ctx.shadowBlur = 10;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(0, hy - 12 + Math.sin(G.time * 2) * 0.8, 6, 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    if (L.shield) {
      ctx.fillStyle = c(L.shield);
      ctx.strokeStyle = c(L.metal || '#aaa');
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-12, -4);
      ctx.lineTo(-4, -4);
      ctx.lineTo(-4, 4);
      ctx.lineTo(-8, 9);
      ctx.lineTo(-12, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // brazo delantero
    const hx = 8, hyy = 1;
    ctx.strokeStyle = c(L.shirt);
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(5, -3);
    ctx.lineTo(hx, hyy);
    ctx.stroke();
    ctx.fillStyle = c(L.skin);
    ctx.beginPath();
    ctx.arc(hx, hyy, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // arma: en espacio espejado, el ángulo del mundo a -> (dir>0 ? a : PI - a)
    if (L.weapon) {
      let a = dir > 0 ? o.face : Math.PI - o.face;
      if (o.atk > 0) a += Math.sin((o.atk / 0.2) * Math.PI) * -1.4;
      else if (!L.float && L.weapon !== 'bow') a = a * 0.4 - 0.5; // descanso: arma algo levantada
      ctx.save();
      ctx.translate(hx, hyy);
      ctx.rotate(a);
      G.S.weapon(ctx, L.weapon, c, L);
      ctx.restore();
    }
    ctx.restore();
  },

  weapon(ctx, w, c, L) {
    const wood = c(L.undead ? '#4a4a3a' : '#7a5a3a');
    const steel = c(L.undead ? '#8a9a90' : '#dfe6f0');
    ctx.lineCap = 'round';
    switch (w) {
      case 'sword':
      case 'greatsword': {
        const len = w === 'sword' ? 15 : 24, wd = w === 'sword' ? 2.6 : 4;
        ctx.fillStyle = wood;
        ctx.fillRect(-3, -1, 4, 2);
        ctx.fillStyle = c('#b8962e');
        ctx.fillRect(1, -4, 2, 8);
        ctx.fillStyle = steel;
        ctx.beginPath();
        ctx.moveTo(3, -wd / 2);
        ctx.lineTo(3 + len, -wd / 2);
        ctx.lineTo(5 + len, 0);
        ctx.lineTo(3 + len, wd / 2);
        ctx.lineTo(3, wd / 2);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'pitchfork':
        ctx.strokeStyle = wood; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(18, 0); ctx.stroke();
        ctx.strokeStyle = steel; ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(18, -4); ctx.lineTo(18, 4);
        for (const y of [-4, 0, 4]) { ctx.moveTo(18, y); ctx.lineTo(24, y); }
        ctx.stroke();
        break;
      case 'lance':
        ctx.strokeStyle = wood; ctx.lineWidth = 2.6;
        ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(28, 0); ctx.stroke();
        ctx.fillStyle = steel;
        ctx.beginPath(); ctx.moveTo(26, -3.5); ctx.lineTo(36, 0); ctx.lineTo(26, 3.5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = c('#c03030');
        ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(24, -6); ctx.lineTo(26, 0); ctx.closePath(); ctx.fill();
        break;
      case 'club':
        ctx.fillStyle = wood;
        ctx.beginPath();
        ctx.moveTo(-2, -1.5); ctx.lineTo(16, -4.5); ctx.lineTo(18, 0); ctx.lineTo(16, 4.5); ctx.lineTo(-2, 1.5);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = steel;
        for (const [x, y] of [[12, -4], [15, 3], [9, 3]]) ctx.fillRect(x, y - 1, 2, 2);
        break;
      case 'bow':
        ctx.strokeStyle = wood; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(-2, 0, 10, -1.2, 1.2); ctx.stroke();
        ctx.strokeStyle = c('#dddddd'); ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(-2 + Math.cos(-1.2) * 10, Math.sin(-1.2) * 10); ctx.lineTo(-2 + Math.cos(1.2) * 10, Math.sin(1.2) * 10); ctx.stroke();
        break;
      case 'holystaff':
      case 'firestaff':
      case 'skullstaff': {
        ctx.strokeStyle = wood; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(18, 0); ctx.stroke();
        const orb = w === 'holystaff' ? '#ffe98a' : w === 'firestaff' ? '#ff8a2a' : '#7dffb8';
        const glow = L.undead ? '#7dffb8' : orb;
        ctx.fillStyle = c(glow);
        ctx.shadowColor = glow; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(20, 0, 3.5 + Math.sin(G.time * 8) * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        if (w === 'holystaff') {
          ctx.strokeStyle = c(glow); ctx.lineWidth = 1;
          for (let i = 0; i < 6; i++) {
            const a = i * Math.PI / 3 + G.time;
            ctx.beginPath(); ctx.moveTo(20 + Math.cos(a) * 4.5, Math.sin(a) * 4.5); ctx.lineTo(20 + Math.cos(a) * 7, Math.sin(a) * 7); ctx.stroke();
          }
        }
        break;
      }
      case 'mace':
        ctx.strokeStyle = wood; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(12, 0); ctx.stroke();
        ctx.fillStyle = steel;
        ctx.beginPath(); ctx.arc(15, 0, 4, 0, Math.PI * 2); ctx.fill();
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3;
          ctx.fillRect(15 + Math.cos(a) * 5 - 1, Math.sin(a) * 5 - 1, 2, 2);
        }
        break;
      case 'scythe':
        ctx.strokeStyle = c('#3a2a1e'); ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(24, 0); ctx.stroke();
        ctx.fillStyle = c('#cfd4e0');
        ctx.beginPath();
        ctx.moveTo(24, -1);
        ctx.quadraticCurveTo(22, -16, 8, -18);
        ctx.quadraticCurveTo(18, -11, 21, 1);
        ctx.closePath();
        ctx.fill();
        break;
    }
  },

  dummy(ctx, x, y, flash) {
    G.S.shadow(ctx, x, y, 14);
    ctx.fillStyle = '#5a3a1e';
    ctx.fillRect(x - 2, y - 6, 4, 20);
    ctx.fillStyle = flash ? '#fff' : '#c8a860';
    ctx.fillRect(x - 12, y - 6, 24, 4);
    ctx.beginPath();
    ctx.ellipse(x, y - 2, 7, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y - 15, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a2020';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y - 2, 4, 0, Math.PI * 2);
    ctx.stroke();
  },
};

G.PLAYER_LOOK = { skin: '#b8a8c8', shirt: '#3a2060', robe: true, trim: '#9d6bff', hat: 'necro', hood: '#2a1848', cape: '#1a0e2c', weapon: 'scythe' };
// Túnicas por jugador (multijugador)
G.PLAYER_LOOKS = [
  { ...G.PLAYER_LOOK, aura: '#9d6bff' },
  { ...G.PLAYER_LOOK, shirt: '#601a28', trim: '#ff6b7a', hood: '#40101a', cape: '#2a0810', aura: '#ff6b7a' },
  { ...G.PLAYER_LOOK, shirt: '#124048', trim: '#5fe0d0', hood: '#0c2c32', cape: '#06181c', aura: '#5fe0d0' },
  { ...G.PLAYER_LOOK, shirt: '#4a3a10', trim: '#ffd84a', hood: '#30250a', cape: '#1c1606', aura: '#ffd84a' },
];

G.MENTOR_LOOK = { skin: '#dcd8c4', shirt: '#3a3450', robe: true, trim: '#3fcf8e', hat: 'skull', hood: '#2a2438', cape: '#1e1a2c', weapon: 'skullstaff' };
