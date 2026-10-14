G.U = {
  dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
  angle: (a, b) => Math.atan2(b.y - a.y, b.x - a.x),
  angDiff(a, b) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  },
  rand: (a, b) => a + Math.random() * (b - a),
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),

  // Empuja un círculo {x,y,r} fuera de un rectángulo. Devuelve true si chocó.
  circleRect(c, r) {
    const nx = G.U.clamp(c.x, r.x, r.x + r.w);
    const ny = G.U.clamp(c.y, r.y, r.y + r.h);
    const dx = c.x - nx, dy = c.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 >= c.r * c.r) return false;
    if (d2 === 0) {
      const l = c.x - r.x, rr = r.x + r.w - c.x, t = c.y - r.y, b = r.y + r.h - c.y;
      const m = Math.min(l, rr, t, b);
      if (m === l) c.x = r.x - c.r;
      else if (m === rr) c.x = r.x + r.w + c.r;
      else if (m === t) c.y = r.y - c.r;
      else c.y = r.y + r.h + c.r;
      return true;
    }
    const d = Math.sqrt(d2);
    c.x = nx + (dx / d) * c.r;
    c.y = ny + (dy / d) * c.r;
    return true;
  },

  pointInRect: (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h,

  poly(ctx, x, y, r, n, rot) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * Math.PI * 2;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  },

  drawShape(ctx, shape, x, y, r, rot, fill, stroke, lw = 2) {
    switch (shape) {
      case 'circle':
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        break;
      case 'square':
        G.U.poly(ctx, x, y, r * 1.3, 4, rot + Math.PI / 4);
        break;
      case 'triangle':
        G.U.poly(ctx, x, y, r * 1.25, 3, rot);
        break;
      case 'hexagon':
        G.U.poly(ctx, x, y, r, 6, rot);
        break;
      case 'diamond':
        G.U.poly(ctx, x, y, r * 1.3, 4, rot);
        break;
    }
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.lineWidth = lw;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  },

  bar(ctx, x, y, w, h, frac, color, back = 'rgba(0,0,0,0.6)') {
    ctx.fillStyle = back;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * G.U.clamp(frac, 0, 1), h);
  },

  text(ctx, s, x, y, size = 16, color = '#fff', align = 'left', bold = false) {
    ctx.font = `${bold ? 'bold ' : ''}${size}px "Trebuchet MS", Verdana, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(s, x, y);
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
  },
};
