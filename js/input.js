G.keys = {};
G.pressed = {};
G.mouse = { x: G.W / 2, y: G.H / 2, down: false, clicked: false };

const BLOCKED_KEYS = ['tab', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'f8', 'f9'];

addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (!G.keys[k]) G.pressed[k] = true;
  G.keys[k] = true;
  if (BLOCKED_KEYS.includes(k)) e.preventDefault();
});

addEventListener('keyup', e => {
  G.keys[e.key.toLowerCase()] = false;
});

addEventListener('blur', () => {
  G.keys = {};
  G.mouse.down = false;
});

G.initMouse = canvas => {
  const toCanvas = e => {
    const r = canvas.getBoundingClientRect();
    G.mouse.x = ((e.clientX - r.left) / r.width) * G.W;
    G.mouse.y = ((e.clientY - r.top) / r.height) * G.H;
  };
  canvas.addEventListener('mousemove', toCanvas);
  canvas.addEventListener('mousedown', e => {
    toCanvas(e);
    if (e.button === 0) {
      G.mouse.down = true;
      G.mouse.clicked = true;
    }
  });
  addEventListener('mouseup', e => {
    if (e.button === 0) G.mouse.down = false;
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
};

G.wasPressed = k => !!G.pressed[k];

G.endFrameInput = () => {
  G.pressed = {};
  G.mouse.clicked = false;
};
