/* Cherche le Barbichon — génération procédurale + logique de jeu */
"use strict";

const NS = "http://www.w3.org/2000/svg";
const svg = document.getElementById("scene");
const fx = document.getElementById("fx");
const stage = document.getElementById("stage");
const timerEl = document.getElementById("timer");
const lastWinEl = document.getElementById("lastWin");
const introEl = document.getElementById("intro");
const winEl = document.getElementById("winOverlay");
const winTimeEl = document.getElementById("winTime");
const winQuipEl = document.getElementById("winQuip");

const DECOY_PENALTY = 15000;
const MISS_PENALTY = 5000;
const GNOME_H = 170; // hauteur locale du nain (pieds en 0,0 ; pointe du bonnet en -170)

/* ---------- Aléatoire seedé ---------- */

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rng = mulberry32(Date.now() & 0xffffffff);
const rand = (a, b) => a + rng() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(rng() * arr.length)];

/* ---------- Helpers SVG ---------- */

function el(name, attrs = {}, parent = null) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

/* ---------- Palettes (ambiances de la journée) ---------- */

const PALETTES = [
  {
    name: "matin", night: false,
    sky: ["#ffeec9", "#a8dcec"], sun: "#ffd76e", cloud: "#fffdf6",
    hills: ["#aecfa6", "#8abc80", "#67a861", "#4d8a4b"],
    foliage: ["#5f9d5c", "#4d8a4b", "#3f7a3f", "#76ad60"],
    trunk: "#7a5236", rock: "#a8a294", grass: "#5f9d5c",
  },
  {
    name: "plein-jour", night: false,
    sky: ["#8ed0f5", "#dff4ff"], sun: "#ffde59", cloud: "#ffffff",
    hills: ["#b3d79b", "#8cc479", "#67ad58", "#4f9a48"],
    foliage: ["#67ad58", "#4f9a48", "#3e8a3c", "#7fbd66"],
    trunk: "#84583a", rock: "#b0aa9b", grass: "#67ad58",
  },
  {
    name: "crepuscule", night: false,
    sky: ["#ff9f68", "#ffe3b3"], sun: "#ff8347", cloud: "#ffe2c4",
    hills: ["#c9a276", "#a08a5c", "#76814e", "#5a6c40"],
    foliage: ["#76814e", "#5a6c40", "#4b5d38", "#8c9456"],
    trunk: "#6e4a31", rock: "#9c9181", grass: "#76814e",
  },
  {
    name: "nuit", night: true,
    sky: ["#1d2951", "#3c4a7a"], sun: "#f4f1d8", cloud: "#65739f",
    hills: ["#44557e", "#37486f", "#2c3c61", "#243353"],
    foliage: ["#2f4a4a", "#28403f", "#1f3434", "#395755"],
    trunk: "#3b2f33", rock: "#5b6177", grass: "#2f4a4a",
  },
];

/* ---------- Dessins : le nain ---------- */

function drawGnome(parent, opts = {}) {
  const tunic = opts.tunic || "#3f6ea0";
  const tunicDark = "#34597f";
  const g = el("g", { class: "gnome-body" }, parent);
  // bottes
  el("ellipse", { cx: -13, cy: -6, rx: 14, ry: 9, fill: "#5b3a29" }, g);
  el("ellipse", { cx: 13, cy: -6, rx: 14, ry: 9, fill: "#4a2f21" }, g);
  // pantalon
  el("rect", { x: -16, y: -50, width: 32, height: 42, rx: 9, fill: "#46557a" }, g);
  // tunique
  el("path", { d: "M -27 -48 Q 0 -62 27 -48 L 21 -98 Q 0 -110 -21 -98 Z", fill: tunic }, g);
  // ceinture + boucle
  el("rect", { x: -25, y: -64, width: 50, height: 11, rx: 5, fill: "#2c1d12" }, g);
  el("rect", { x: -7, y: -67, width: 14, height: 16, rx: 3, fill: "#e8b339" }, g);
  // moufles
  el("ellipse", { cx: -27, cy: -76, rx: 8, ry: 10, fill: tunicDark }, g);
  el("ellipse", { cx: 27, cy: -76, rx: 8, ry: 10, fill: tunicDark }, g);
  // barbe
  el("path", {
    d: "M -23 -102 Q -32 -68 0 -56 Q 32 -68 23 -102 Q 11 -92 0 -92 Q -11 -92 -23 -102 Z",
    fill: "#f4f1e8", stroke: "#dcd6c4", "stroke-width": 2,
  }, g);
  // visage
  el("circle", { cx: 0, cy: -106, r: 16, fill: "#f2b98c" }, g);
  // nez
  el("ellipse", { cx: 0, cy: -99, rx: 7.5, ry: 6.5, fill: "#e89a6e" }, g);
  // yeux
  el("circle", { cx: -7, cy: -111, r: 2.5, fill: "#2c1d12" }, g);
  el("circle", { cx: 7, cy: -111, r: 2.5, fill: "#2c1d12" }, g);
  // bonnet pointu
  el("path", {
    d: "M -21 -112 Q 0 -122 21 -112 Q 17 -150 3 -170 Q -14 -148 -21 -112 Z",
    fill: "#d6452c", stroke: "#a93722", "stroke-width": 2.5,
  }, g);
  return g;
}

/* ---------- Dessins : cachettes (base centrée en 0,0) ---------- */

function drawBush(parent, p) {
  const c1 = pick(p.foliage), c2 = pick(p.foliage);
  const k = rand(0.92, 1.18);
  const g = el("g", {}, parent);
  el("ellipse", { cx: 0, cy: -52 * k, rx: 84 * k, ry: 56 * k, fill: c1, stroke: "rgba(0,0,0,.16)", "stroke-width": 3 }, g);
  el("ellipse", { cx: -52 * k, cy: -32 * k, rx: 42 * k, ry: 34 * k, fill: c2 }, g);
  el("ellipse", { cx: 52 * k, cy: -34 * k, rx: 44 * k, ry: 36 * k, fill: c2 }, g);
  el("ellipse", { cx: -18 * k, cy: -76 * k, rx: 34 * k, ry: 26 * k, fill: c2 }, g);
  el("circle", { cx: 24 * k, cy: -64 * k, r: 7 * k, fill: "rgba(255,255,255,.22)" }, g);
  el("circle", { cx: -40 * k, cy: -44 * k, r: 5 * k, fill: "rgba(255,255,255,.18)" }, g);
  return { g, w: 175 * k, h: 122 * k };
}

function drawRock(parent, p) {
  const k = rand(0.9, 1.15);
  const g = el("g", {}, parent);
  el("path", {
    d: `M ${-74 * k} 0 Q ${-80 * k} ${-58 * k} ${-30 * k} ${-86 * k} Q ${20 * k} ${-104 * k} ${56 * k} ${-66 * k} Q ${82 * k} ${-34 * k} ${72 * k} 0 Z`,
    fill: p.rock, stroke: "rgba(0,0,0,.22)", "stroke-width": 3,
  }, g);
  el("path", {
    d: `M ${-26 * k} ${-84 * k} Q ${14 * k} ${-98 * k} ${44 * k} ${-66 * k} L ${10 * k} ${-58 * k} Z`,
    fill: "rgba(255,255,255,.20)",
  }, g);
  return { g, w: 152 * k, h: 96 * k };
}

function drawStump(parent, p) {
  const k = rand(0.92, 1.12);
  const g = el("g", {}, parent);
  el("path", {
    d: `M ${-50 * k} 0 L ${-46 * k} ${-74 * k} L ${46 * k} ${-74 * k} L ${50 * k} 0 Z`,
    fill: p.trunk, stroke: "rgba(0,0,0,.22)", "stroke-width": 3,
  }, g);
  el("ellipse", { cx: 0, cy: -74 * k, rx: 46 * k, ry: 14 * k, fill: "#d9b98c", stroke: "rgba(0,0,0,.2)", "stroke-width": 2.5 }, g);
  el("ellipse", { cx: 0, cy: -74 * k, rx: 26 * k, ry: 8 * k, fill: "none", stroke: "rgba(0,0,0,.18)", "stroke-width": 2 }, g);
  return { g, w: 100 * k, h: 88 * k };
}

function drawGrassClump(parent, p) {
  const k = rand(0.9, 1.2);
  const g = el("g", {}, parent);
  const c = p.grass;
  for (let i = -3; i <= 3; i++) {
    const x = i * 11 * k;
    const h = (40 - Math.abs(i) * 7) * k;
    el("path", {
      d: `M ${x - 6 * k} 0 Q ${x + rand(-7, 7) * k} ${-h} ${x + 4 * k} 0 Z`,
      fill: c, stroke: "rgba(0,0,0,.14)", "stroke-width": 2,
    }, g);
  }
  return { g, w: 88 * k, h: 44 * k };
}

const HIDERS = { bush: drawBush, rock: drawRock, stump: drawStump, grass: drawGrassClump };

/* ---------- Dessins : objets complets des leurres (révélés au clic) ---------- */

function drawMushroom(parent) {
  const g = el("g", {}, parent);
  el("rect", { x: -10, y: -34, width: 20, height: 34, rx: 8, fill: "#f1e6d2", stroke: "rgba(0,0,0,.18)", "stroke-width": 2 }, g);
  el("path", { d: "M -32 -30 Q -28 -58 0 -70 Q 28 -58 32 -30 Q 0 -40 -32 -30 Z", fill: "#d6452c", stroke: "#a93722", "stroke-width": 2.5 }, g);
  el("circle", { cx: -12, cy: -46, r: 4.5, fill: "#fdf3e3" }, g);
  el("circle", { cx: 10, cy: -52, r: 3.5, fill: "#fdf3e3" }, g);
  return { g, w: 64, h: 70 };
}

function drawBirdhouse(parent) {
  const g = el("g", {}, parent);
  el("rect", { x: -4, y: -78, width: 8, height: 78, fill: "#7a5236", stroke: "rgba(0,0,0,.2)", "stroke-width": 2 }, g);
  el("rect", { x: -26, y: -128, width: 52, height: 52, rx: 5, fill: "#e8c98f", stroke: "rgba(0,0,0,.22)", "stroke-width": 2.5 }, g);
  el("circle", { cx: 0, cy: -102, r: 9, fill: "#3a2a1c" }, g);
  el("path", { d: "M -34 -126 L 0 -158 L 34 -126 Z", fill: "#d6452c", stroke: "#a93722", "stroke-width": 2.5 }, g);
  return { g, w: 68, h: 158 };
}

function drawBalloon(parent) {
  const g = el("g", {}, parent);
  el("path", { d: "M 0 -34 Q -10 -16 0 0", fill: "none", stroke: "#6b5640", "stroke-width": 2 }, g);
  el("ellipse", { cx: 0, cy: -62, rx: 26, ry: 31, fill: "#d6452c", stroke: "#a93722", "stroke-width": 2.5 }, g);
  el("path", { d: "M -6 -38 L 0 -30 L 6 -38 Z", fill: "#a93722" }, g);
  el("ellipse", { cx: -9, cy: -72, rx: 6, ry: 9, fill: "rgba(255,255,255,.35)" }, g);
  return { g, w: 52, h: 93 };
}

function drawDandelions(parent) {
  const g = el("g", {}, parent);
  for (const [dx, h, r] of [[-16, 44, 11], [4, 56, 13], [20, 38, 9]]) {
    el("path", { d: `M ${dx} 0 Q ${dx + 4} ${-h / 2} ${dx} ${-h}`, fill: "none", stroke: "#7d9b5e", "stroke-width": 3 }, g);
    el("circle", { cx: dx, cy: -h, r, fill: "#ffffff", stroke: "#e3ded0", "stroke-width": 2 }, g);
    el("circle", { cx: dx, cy: -h, r: r * 0.4, fill: "#e6e0cd" }, g);
  }
  return { g, w: 58, h: 70 };
}

function drawGlove(parent) {
  const g = el("g", {}, parent);
  el("path", {
    d: "M -16 0 Q -22 -22 -10 -34 Q -2 -42 8 -36 Q 13 -46 19 -40 Q 25 -34 18 -26 Q 24 -12 16 0 Z",
    fill: "#7a5a3a", stroke: "#5d4226", "stroke-width": 2.5,
  }, g);
  el("rect", { x: -16, y: -8, width: 32, height: 8, rx: 4, fill: "#f1e6d2", stroke: "rgba(0,0,0,.15)", "stroke-width": 2 }, g);
  return { g, w: 48, h: 46 };
}

function drawPinecone(parent) {
  const g = el("g", {}, parent);
  el("ellipse", { cx: 0, cy: -26, rx: 18, ry: 26, fill: "#6e4a2c", stroke: "#503418", "stroke-width": 2.5 }, g);
  el("path", { d: "M -14 -38 Q 0 -31 14 -38 M -17 -26 Q 0 -18 17 -26 M -14 -13 Q 0 -6 14 -13", fill: "none", stroke: "#503418", "stroke-width": 2 }, g);
  el("path", { d: "M 0 -52 L 0 -58", stroke: "#503418", "stroke-width": 3 }, g);
  return { g, w: 38, h: 58 };
}

/* ---------- Dessins : fragments qui dépassent (vrais et faux) ----------
   Convention : ancrés en (0,0), pointent vers le haut (-y) et vers
   l'extérieur (+x) ; le montage applique un miroir selon le côté. */

// vraie pointe de bonnet : cône courbé, rouge uni, pointe fine
function fragHat(g) {
  el("path", { d: "M -11 4 Q -5 -10 2 -28 Q 7 -13 11 4 Z", fill: "#d6452c", stroke: "#a93722", "stroke-width": 2.5 }, g);
}
// faux bonnet n°1 : sommet de champignon, plus rond + petits points
function fragMushroom(g) {
  el("path", { d: "M -12 4 Q -10 -16 0 -22 Q 10 -16 12 4 Z", fill: "#d6452c", stroke: "#a93722", "stroke-width": 2.5 }, g);
  el("circle", { cx: -4, cy: -10, r: 2.4, fill: "#fdf3e3" }, g);
  el("circle", { cx: 5, cy: -5, r: 1.8, fill: "#fdf3e3" }, g);
}
// faux bonnet n°2 : dôme de ballon, luisant
function fragBalloon(g) {
  el("path", { d: "M -11 4 Q -11 -20 0 -20 Q 11 -20 11 4 Z", fill: "#d6452c", stroke: "#a93722", "stroke-width": 2.5 }, g);
  el("ellipse", { cx: -4, cy: -11, rx: 3, ry: 4.5, fill: "rgba(255,255,255,.4)" }, g);
}
// faux bonnet n°3 : pointe de toit de nichoir, arêtes droites
function fragRoof(g) {
  el("path", { d: "M -13 4 L 0 -24 L 13 4 Z", fill: "#d6452c", stroke: "#a93722", "stroke-width": 2.5 }, g);
  el("path", { d: "M -9 -2 L 9 -2", stroke: "#a93722", "stroke-width": 2 }, g);
}
// vraie barbe : touffes crème irrégulières
function fragBeard(g) {
  for (const [x, y, r] of [[2, -2, 9], [9, -9, 7], [1, -14, 5.5]]) {
    el("circle", { cx: x, cy: y, r, fill: "#f4f1e8", stroke: "#dcd6c4", "stroke-width": 2 }, g);
  }
}
// fausse barbe : boules de pissenlit parfaites, blanc pur, petit cœur
function fragDandelion(g) {
  for (const [x, y, r] of [[3, -4, 8], [11, -12, 6]]) {
    el("circle", { cx: x, cy: y, r, fill: "#ffffff", stroke: "#e3ded0", "stroke-width": 2 }, g);
    el("circle", { cx: x, cy: y, r: r * 0.32, fill: "#e6e0cd" }, g);
  }
}
// vraie botte : brun foncé, lisse, avec semelle
function fragBoot(g) {
  el("ellipse", { cx: 6, cy: -6, rx: 13, ry: 8.5, fill: "#4a2f21", stroke: "rgba(0,0,0,.3)", "stroke-width": 2, transform: "rotate(-14 6 -6)" }, g);
  el("path", { d: "M -5 -1 Q 6 3 17 -3", fill: "none", stroke: "#2e1d14", "stroke-width": 2.5 }, g);
}
// fausse botte n°1 : gant en cuir plus clair, bosses de doigts
function fragGlove(g) {
  el("path", { d: "M -2 2 Q -3 -12 4 -13 Q 6 -17 9 -13 Q 12 -16 14 -11 Q 17 -6 15 2 Z", fill: "#7a5a3a", stroke: "#5d4226", "stroke-width": 2.2 }, g);
}
// fausse botte n°2 : pomme de pin, brun moyen, écailles
function fragPinecone(g) {
  el("ellipse", { cx: 7, cy: -8, rx: 11, ry: 14, fill: "#6e4a2c", stroke: "#503418", "stroke-width": 2.2, transform: "rotate(18 7 -8)" }, g);
  el("path", { d: "M 0 -14 Q 7 -10 14 -14 M -1 -7 Q 7 -3 15 -7", fill: "none", stroke: "#503418", "stroke-width": 1.8 }, g);
}

const DECOY_TYPES = [
  { full: drawMushroom, frag: fragMushroom, kind: "top", label: "un champignon" },
  { full: drawBalloon, frag: fragBalloon, kind: "top", label: "un ballon perdu" },
  { full: drawBirdhouse, frag: fragRoof, kind: "top", label: "un nichoir" },
  { full: drawDandelions, frag: fragDandelion, kind: "side-mid", label: "des pissenlits" },
  { full: drawGlove, frag: fragGlove, kind: "side-base", label: "un vieux gant de jardin" },
  { full: drawPinecone, frag: fragPinecone, kind: "side-base", label: "une pomme de pin" },
];

/* ---------- Dessins : décor libre ---------- */

function drawFir(parent, p) {
  const g = el("g", {}, parent);
  const c = pick(p.foliage);
  const h = rand(150, 230);
  el("rect", { x: -9, y: -h * 0.18, width: 18, height: h * 0.18, fill: p.trunk }, g);
  for (let i = 0; i < 3; i++) {
    const w = 60 - i * 14;
    const top = -h * (0.42 + i * 0.27);
    const base = -h * (0.12 + i * 0.25);
    el("path", { d: `M ${-w} ${base} L 0 ${top} L ${w} ${base} Z`, fill: c, stroke: "rgba(0,0,0,.16)", "stroke-width": 3 }, g);
  }
  return g;
}

function drawLeafyTree(parent, p) {
  const g = el("g", {}, parent);
  const c1 = pick(p.foliage), c2 = pick(p.foliage);
  const h = rand(140, 200);
  el("path", { d: `M -10 0 L -7 ${-h * 0.5} L 7 ${-h * 0.5} L 10 0 Z`, fill: p.trunk, stroke: "rgba(0,0,0,.18)", "stroke-width": 2.5 }, g);
  el("circle", { cx: 0, cy: -h * 0.68, r: h * 0.3, fill: c1, stroke: "rgba(0,0,0,.16)", "stroke-width": 3 }, g);
  el("circle", { cx: -h * 0.2, cy: -h * 0.55, r: h * 0.2, fill: c2 }, g);
  el("circle", { cx: h * 0.2, cy: -h * 0.57, r: h * 0.21, fill: c2 }, g);
  return g;
}

function drawFlower(parent, p) {
  const g = el("g", {}, parent);
  const c = pick(["#e784a8", "#f0c14d", "#9a8fd0", "#ef8d5d"]);
  const h = rand(20, 34);
  el("path", { d: `M 0 0 Q 2 ${-h / 2} 0 ${-h}`, fill: "none", stroke: p.grass, "stroke-width": 3 }, g);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    el("ellipse", {
      cx: Math.cos(a) * 7, cy: -h + Math.sin(a) * 7, rx: 5.5, ry: 4,
      fill: c, transform: `rotate(${(a * 180) / Math.PI} ${Math.cos(a) * 7} ${-h + Math.sin(a) * 7})`,
    }, g);
  }
  el("circle", { cx: 0, cy: -h, r: 4, fill: "#fdf3d0" }, g);
  return g;
}

/* ---------- Génération de la scène ---------- */

let interactives = [];
let gnomeEntry = null;
let uid = 0;

function hillPath(yBase, amp, bottom = 900) {
  let d = `M 0 ${bottom} L 0 ${yBase}`;
  let x = 0;
  while (x < 1600) {
    const w = rand(220, 460);
    const cy = yBase + rand(-amp, amp * 0.4);
    const ey = yBase + rand(-amp * 0.5, amp * 0.5);
    d += ` Q ${x + w / 2} ${cy} ${Math.min(1600, x + w)} ${ey}`;
    x += w;
  }
  d += ` L 1600 ${bottom} Z`;
  return d;
}

function depthScale(baseY) {
  return 0.55 + ((baseY - 590) / 290) * 0.7;
}

function shadow(parent, w) {
  el("ellipse", { cx: 0, cy: 4, rx: w * 0.52, ry: 9, fill: "rgba(0,0,0,.16)" }, parent);
}

function generateScene(seed) {
  rng = mulberry32(seed);
  svg.innerHTML = "";
  fx.innerHTML = "";
  interactives = [];
  gnomeEntry = null;
  uid = 0;

  const p = pick(PALETTES);

  // ciel
  const defs = el("defs", {}, svg);
  const grad = el("linearGradient", { id: "sky", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  el("stop", { offset: "0%", "stop-color": p.sky[0] }, grad);
  el("stop", { offset: "100%", "stop-color": p.sky[1] }, grad);
  el("rect", { x: 0, y: 0, width: 1600, height: 900, fill: "url(#sky)" }, svg);

  // étoiles la nuit
  if (p.night) {
    for (let i = 0; i < 40; i++) {
      el("circle", {
        cx: rand(0, 1600), cy: rand(0, 420), r: rand(1.2, 3),
        fill: "#f4f1d8", class: "star",
        style: `animation-delay:${rand(0, 2.4).toFixed(2)}s`,
      }, svg);
    }
  }

  // soleil / lune
  const sx = rand(180, 1420), sy = rand(90, 240);
  el("circle", { cx: sx, cy: sy, r: 78, fill: p.sun, opacity: 0.25 }, svg);
  el("circle", { cx: sx, cy: sy, r: 52, fill: p.sun }, svg);
  if (p.night) el("circle", { cx: sx + 18, cy: sy - 10, r: 42, fill: p.sky[0], opacity: 0.55 }, svg);

  // nuages
  for (let i = 0, n = randInt(2, 4); i < n; i++) {
    const cx = rand(100, 1500), cy = rand(70, 300), k = rand(0.7, 1.3);
    const cl = el("g", { class: "cloud", style: `animation-delay:-${rand(0, 20).toFixed(1)}s`, opacity: p.night ? 0.5 : 0.92 }, svg);
    el("ellipse", { cx, cy, rx: 70 * k, ry: 26 * k, fill: p.cloud }, cl);
    el("ellipse", { cx: cx - 45 * k, cy: cy + 8 * k, rx: 40 * k, ry: 18 * k, fill: p.cloud }, cl);
    el("ellipse", { cx: cx + 48 * k, cy: cy + 6 * k, rx: 44 * k, ry: 20 * k, fill: p.cloud }, cl);
  }

  // collines lointaines puis sol
  el("path", { d: hillPath(rand(380, 440), 70), fill: p.hills[0] }, svg);
  el("path", { d: hillPath(rand(470, 520), 55), fill: p.hills[1] }, svg);
  // arbres lointains en silhouette sur la crête
  for (let i = 0, n = randInt(4, 8); i < n; i++) {
    const tx = rand(40, 1560), ty = rand(470, 540), s = rand(0.3, 0.45);
    const tg = el("g", { transform: `translate(${tx} ${ty}) scale(${s})`, opacity: 0.8 }, svg);
    (rng() < 0.6 ? drawFir : drawLeafyTree)(tg, p);
  }
  el("path", { d: hillPath(rand(560, 590), 40), fill: p.hills[2] }, svg);
  el("path", { d: hillPath(rand(640, 670), 28), fill: p.hills[3] }, svg);

  // emplacements de cachettes (sans chevauchement)
  const spots = [];
  let tries = 0;
  while (spots.length < 10 && tries < 400) {
    tries++;
    const x = rand(90, 1510);
    const y = rand(620, 860);
    const ds = depthScale(y);
    if (spots.every((s) => Math.hypot(s.x - x, (s.y - y) * 2.2) > 200 * Math.max(ds, s.ds))) {
      spots.push({ x, y, ds });
    }
  }
  spots.sort(() => rng() - 0.5);

  // attribution : 1 nain, 3-5 leurres, le reste en cachettes vides
  const gnomeSpot = spots.find((s) => s.y > 680) || spots[0];
  const others = spots.filter((s) => s !== gnomeSpot);
  const decoyCount = Math.min(randInt(5, 6), others.length);
  const decoySpots = others.slice(0, decoyCount);
  const emptySpots = others.slice(decoyCount);

  const items = [];
  items.push({ y: gnomeSpot.y, mount: () => mountGnome(gnomeSpot, p) });
  const decoyPool = [...DECOY_TYPES].sort(() => rng() - 0.5);
  decoySpots.forEach((s, i) => {
    const type = decoyPool[i % decoyPool.length];
    items.push({ y: s.y, mount: () => mountDecoy(s, type, p) });
  });
  emptySpots.forEach((s) => {
    const make = pick([drawBush, drawRock, drawStump, drawBush]);
    items.push({
      y: s.y,
      mount: () => {
        const w = el("g", { transform: `translate(${s.x} ${s.y}) scale(${s.ds})` }, svg);
        const spec = make(w, p);
        shadow(w, spec.w);
        w.appendChild(spec.g);
      },
    });
  });

  // décor libre (arbres, fleurs, herbe) hors des cachettes
  const freeCount = randInt(16, 24);
  for (let i = 0; i < freeCount; i++) {
    const x = rand(30, 1570);
    const y = rand(600, 880);
    const ds = depthScale(y);
    if (spots.some((s) => Math.hypot(s.x - x, (s.y - y) * 2) < 170 * Math.max(ds, s.ds))) continue;
    const roll = rng();
    items.push({
      y,
      mount: () => {
        const w = el("g", { transform: `translate(${x} ${y}) scale(${ds})` }, svg);
        if (roll < 0.22) drawFir(w, p);
        else if (roll < 0.4) drawLeafyTree(w, p);
        else if (roll < 0.68) drawFlower(w, p);
        else drawGrassClump(w, p);
      },
    });
  }

  // rendu trié par profondeur, puis couche de zones cliquables au-dessus
  items.sort((a, b) => a.y - b.y);
  const hits = [];
  window.__pendingHits = hits;
  items.forEach((it) => it.mount());
  const hitLayer = el("g", { id: "hits" }, svg);
  hits.forEach((h) => hitLayer.appendChild(h));
  delete window.__pendingHits;
}

/* ---------- Montage du nain et des leurres ---------- */

function registerHit(x, y, r, role, id) {
  const c = el("circle", {
    cx: x, cy: y, r: Math.max(24, r),
    fill: "transparent", "data-role": role, "data-id": id,
    style: "pointer-events:all",
  });
  window.__pendingHits.push(c);
  return c;
}

/* Montage unifié : l'objet complet est entièrement caché derrière la
   cachette ; seul un petit fragment, dessiné par-dessus, dépasse. */
function mountPeeking(spot, p, cfg) {
  const hiderName = pick(["bush", "rock", "stump"]);
  const wrap = el("g", { transform: `translate(${spot.x} ${spot.y}) scale(${spot.ds})` }, svg);
  const id = String(uid++);

  const shadowHolder = el("g", {}, wrap);
  const objGroup = el("g", { "data-role": cfg.role, "data-id": id }, wrap);
  const hiderHolder = el("g", {}, wrap);
  const hider = HIDERS[hiderName](hiderHolder, p);
  shadow(shadowHolder, hider.w);

  const spec = cfg.drawFull(objGroup, p);
  const os = Math.min(1.4, (hider.h - 10) / spec.h, (hider.w * 0.9) / spec.w);
  objGroup.setAttribute("transform", `translate(${rand(-6, 6)} 0) scale(${os})`);

  // fragment visible, par-dessus la cachette
  let side = rng() < 0.5 ? -1 : 1;
  let ax, ay;
  if (cfg.kind === "top") {
    side = 1;
    ax = rand(-0.15, 0.15) * hider.w;
    ay = -(hider.h - 8);
  } else if (cfg.kind === "side-mid") {
    ax = side * (hider.w / 2 - 8);
    ay = -hider.h * rand(0.3, 0.45);
  } else {
    ax = side * (hider.w / 2 + 2);
    ay = -4;
  }
  const fs = rand(0.95, 1.2);
  const fragGroup = el("g", {
    "data-role": cfg.role, "data-id": id,
    transform: `translate(${ax} ${ay}) scale(${side * fs} ${fs})`,
  }, wrap);
  cfg.drawFrag(fragGroup);

  const hitY = cfg.kind === "top" ? ay - 14 * fs : ay - 6 * fs;
  const hitEl = registerHit(spot.x + ax * spot.ds, spot.y + hitY * spot.ds, 30 * spot.ds, cfg.role, id);
  return { id, wrap, objGroup, fragGroup, hitEl };
}

const GNOME_FRAGS = {
  hat: { kind: "top", drawFrag: fragHat },
  beard: { kind: "side-mid", drawFrag: fragBeard },
  boot: { kind: "side-base", drawFrag: fragBoot },
};

function mountGnome(spot, p) {
  const frag = GNOME_FRAGS[pick(Object.keys(GNOME_FRAGS))];
  gnomeEntry = mountPeeking(spot, p, {
    role: "gnome",
    drawFull: (g) => { drawGnome(g); return { w: 62, h: GNOME_H }; },
    drawFrag: frag.drawFrag,
    kind: frag.kind,
  });
  interactives.push({ id: gnomeEntry.id, role: "gnome" });
}

function mountDecoy(spot, type, p) {
  const r = mountPeeking(spot, p, {
    role: "decoy",
    drawFull: type.full,
    drawFrag: type.frag,
    kind: type.kind,
  });
  interactives.push({ ...r, role: "decoy", label: type.label, done: false });
}

/* ---------- État & chrono ---------- */

const state = { phase: "intro", startTs: 0, penaltyMs: 0, finalMs: 0, lastWinMs: null, raf: 0 };

function elapsedMs() {
  return state.phase === "playing"
    ? performance.now() - state.startTs + state.penaltyMs
    : state.finalMs;
}

function fmt(ms) {
  const t = Math.max(0, ms);
  const m = Math.floor(t / 60000);
  const s = Math.floor((t % 60000) / 1000);
  const d = Math.floor((t % 1000) / 100);
  return `${m}:${String(s).padStart(2, "0")}.${d}`;
}

function tick() {
  timerEl.textContent = fmt(elapsedMs());
  if (state.phase === "playing") state.raf = requestAnimationFrame(tick);
}

function startGame() {
  generateScene(randInt(1, 2 ** 31));
  state.phase = "playing";
  state.startTs = performance.now();
  state.penaltyMs = 0;
  introEl.classList.add("hidden");
  winEl.classList.add("hidden");
  cancelAnimationFrame(state.raf);
  tick();
}

/* ---------- Effets DOM ---------- */

function stagePoint(e) {
  const r = stage.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function floatText(pt, text) {
  const d = document.createElement("div");
  d.className = "float-penalty";
  d.textContent = text;
  d.style.left = `${pt.x}px`;
  d.style.top = `${pt.y}px`;
  fx.appendChild(d);
  setTimeout(() => d.remove(), 1200);
}

function ripple(pt) {
  const d = document.createElement("div");
  d.className = "ripple";
  d.style.left = `${pt.x}px`;
  d.style.top = `${pt.y}px`;
  fx.appendChild(d);
  setTimeout(() => d.remove(), 600);
}

function bubble(pt, text) {
  const d = document.createElement("div");
  d.className = "bubble";
  d.textContent = text;
  d.style.left = `${Math.min(Math.max(pt.x, 130), stage.clientWidth - 130)}px`;
  d.style.top = `${Math.max(pt.y, 90)}px`;
  fx.appendChild(d);
  setTimeout(() => d.remove(), 2100);
}

function confetti() {
  const colors = ["#d6452c", "#e8b339", "#4d8a4b", "#3f6ea0", "#e784a8", "#f4f1e8"];
  for (let i = 0; i < 60; i++) {
    const d = document.createElement("div");
    d.className = "confetti";
    d.style.left = `${Math.random() * 100}%`;
    d.style.background = colors[i % colors.length];
    d.style.animationDuration = `${1.4 + Math.random() * 1.6}s`;
    d.style.animationDelay = `${Math.random() * 0.5}s`;
    d.style.transform = `rotate(${Math.random() * 360}deg)`;
    fx.appendChild(d);
    setTimeout(() => d.remove(), 3600);
  }
}

function penalize(ms, pt, text) {
  state.penaltyMs += ms;
  timerEl.classList.remove("flash");
  void timerEl.offsetWidth; // relance l'animation
  timerEl.classList.add("flash");
  ripple(pt);
  floatText(pt, text);
}

/* ---------- Interactions ---------- */

const MISS_QUIPS = ["+5 s", "+5 s !", "Raté… +5 s", "+5 s, du calme !"];

svg.addEventListener("pointerdown", (e) => {
  if (state.phase !== "playing") return;
  const pt = stagePoint(e);
  const target = e.target.closest("[data-role]");
  const role = target ? target.getAttribute("data-role") : "scenery";

  if (role === "gnome") {
    winGame();
  } else if (role === "decoy") {
    const entry = interactives.find((i) => i.id === target.getAttribute("data-id"));
    if (!entry || entry.done) return;
    entry.done = true;
    penalize(DECOY_PENALTY, pt, "+15 s");
    bubble(pt, `Raté ! C'était ${entry.label}…`);
    // le leurre se montre puis disparaît
    entry.fragGroup.remove();
    entry.wrap.appendChild(entry.objGroup);
    entry.objGroup.classList.add("decoy-reveal");
    setTimeout(() => {
      entry.objGroup.classList.add("decoy-gone");
      entry.hitEl.remove();
    }, 750);
  } else {
    penalize(MISS_PENALTY, pt, pick(MISS_QUIPS));
  }
});

const WIN_QUIPS = [
  [10000, "Œil de lynx ! Le Barbichon n'a rien vu venir."],
  [25000, "Joli ! Il commençait à peine à s'installer."],
  [60000, "Trouvé ! Il a quand même eu le temps de cueillir des champignons."],
  [Infinity, "Enfin… Le Barbichon a fait une sieste complète en t'attendant."],
];

function winGame() {
  state.finalMs = elapsedMs();
  state.phase = "won";
  state.lastWinMs = state.finalMs;
  cancelAnimationFrame(state.raf);
  timerEl.textContent = fmt(state.finalMs);
  lastWinEl.textContent = `Dernière victoire : ${fmt(state.lastWinMs)}`;

  // le nain sort de sa cachette
  const g = gnomeEntry;
  g.fragGroup.remove();
  g.wrap.appendChild(g.objGroup);
  g.objGroup.classList.add("gnome-pop");
  g.hitEl.remove();
  confetti();

  winTimeEl.textContent = fmt(state.finalMs);
  winQuipEl.textContent = WIN_QUIPS.find(([max]) => state.finalMs < max)[1];
  setTimeout(() => winEl.classList.remove("hidden"), 1100);
}

/* ---------- Lancement ---------- */

document.getElementById("playBtn").addEventListener("click", startGame);
document.getElementById("replayBtn").addEventListener("click", startGame);

// portrait du nain sur la carte d'intro
const introGnome = document.getElementById("introGnome");
const ig = el("g", {}, introGnome);
drawGnome(ig);

// décor d'ambiance derrière l'écran d'intro
generateScene(randInt(1, 2 ** 31));
timerEl.textContent = fmt(0);
