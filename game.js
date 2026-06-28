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

function drawEgg(parent) {
  const g = el("g", {}, parent);
  el("ellipse", { cx: 0, cy: -19, rx: 15, ry: 20, fill: "#f6efdf", stroke: "#ddd1b6", "stroke-width": 2.5 }, g);
  el("ellipse", { cx: -5, cy: -26, rx: 4, ry: 6.5, fill: "rgba(255,255,255,.55)" }, g);
  return { g, w: 34, h: 42 };
}

function drawConfetti(parent) {
  const g = el("g", {}, parent);
  const cols = ["#d6452c", "#e8b339", "#4d8a4b", "#3f6ea0", "#e784a8", "#fdf3e3"];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + i * 0.6;
    const rr = 8 + (i % 4) * 8;
    const x = Math.cos(a) * rr;
    const y = -24 + Math.sin(a) * rr * 0.7;
    el("rect", {
      x: x - 3, y: y - 4.5, width: 6, height: 9, rx: 1.5,
      fill: cols[i % cols.length],
      transform: `rotate(${Math.round((a * 180) / Math.PI)} ${x.toFixed(1)} ${y.toFixed(1)})`,
    }, g);
  }
  return { g, w: 78, h: 62 };
}

function drawWatergun(parent) {
  const g = el("g", {}, parent);
  el("ellipse", { cx: -2, cy: -38, rx: 12, ry: 7, fill: "#5fb0d6", stroke: "#3f8db5", "stroke-width": 2 }, g);
  el("path", { d: "M -24 -22 L 12 -22 L 12 -34 L 22 -34 L 22 -16 L 4 -16 L 0 0 L -12 0 L -10 -16 L -24 -16 Z", fill: "#ef7a3a", stroke: "#b8431a", "stroke-width": 2.5 }, g);
  el("rect", { x: 20, y: -34, width: 9, height: 7, rx: 2, fill: "#bfe3ef", stroke: "#7fb3c9", "stroke-width": 1.5 }, g);
  el("circle", { cx: -16, cy: -19, r: 3.5, fill: "#ffd24a" }, g);
  return { g, w: 58, h: 45 };
}

function drawAnkle(parent) {
  const g = el("g", {}, parent);
  el("rect", { x: -9, y: -44, width: 18, height: 34, rx: 8, fill: "#f2b98c", stroke: "#d98f63", "stroke-width": 2.5 }, g);
  el("path", { d: "M -9 -16 Q -9 1 1 2 L 24 2 Q 28 2 25 -7 Q 14 -13 7 -16 Z", fill: "#f2b98c", stroke: "#d98f63", "stroke-width": 2.5 }, g);
  el("rect", { x: -10, y: -22, width: 20, height: 7, fill: "#e7ddc8", stroke: "#cdbf9f", "stroke-width": 1.5 }, g);
  el("circle", { cx: -7, cy: -14, r: 2.4, fill: "#e6a37a" }, g);
  return { g, w: 46, h: 46 };
}

// invitation au Mans (carton à bandeau damier ~ drapeau de course)
function drawInvitation(parent) {
  const g = el("g", {}, parent);
  el("rect", { x: -28, y: -68, width: 56, height: 68, rx: 4, fill: "#fbf4e6", stroke: "rgba(0,0,0,.22)", "stroke-width": 2.5 }, g);
  // bandeau damier (deux rangées décalées)
  for (let i = 0; i < 11; i++) {
    el("rect", { x: -28 + i * 5, y: -68, width: 5, height: 7, fill: i % 2 ? "#2c1d12" : "#fbf4e6" }, g);
    el("rect", { x: -28 + i * 5, y: -61, width: 5, height: 7, fill: i % 2 ? "#fbf4e6" : "#2c1d12" }, g);
  }
  // lignes de texte
  el("path", { d: "M -20 -44 L 20 -44 M -20 -35 L 12 -35 M -20 -26 L 16 -26 M -20 -17 L 8 -17", fill: "none", stroke: "#c7b896", "stroke-width": 2.5 }, g);
  return { g, w: 60, h: 70 };
}

// un caillou à lécher (galet lisse + langue rose)
function drawLickStone(parent) {
  const g = el("g", {}, parent);
  el("path", { d: "M -34 0 Q -42 -30 -14 -40 Q 16 -50 34 -26 Q 42 -10 30 0 Z", fill: "#9aa0a6", stroke: "rgba(0,0,0,.25)", "stroke-width": 2.5 }, g);
  el("ellipse", { cx: -6, cy: -30, rx: 13, ry: 6, fill: "rgba(255,255,255,.4)" }, g);
  // langue qui lèche
  el("path", { d: "M 26 -12 Q 50 -10 51 -26 Q 51 -34 44 -31 Q 41 -20 26 -20 Z", fill: "#e784a8", stroke: "#c75c84", "stroke-width": 2 }, g);
  el("path", { d: "M 46 -29 Q 48 -22 46 -16", fill: "none", stroke: "#c75c84", "stroke-width": 1.5 }, g);
  return { g, w: 86, h: 50 };
}

// le faire-part de Sacha (carton pastel à nœud)
function drawAnnouncement(parent) {
  const g = el("g", {}, parent);
  el("rect", { x: -26, y: -62, width: 52, height: 62, rx: 4, fill: "#fdf1f5", stroke: "rgba(0,0,0,.2)", "stroke-width": 2.5 }, g);
  el("path", { d: "M -16 -46 L 16 -46 M -12 -38 L 12 -38", fill: "none", stroke: "#caa6b4", "stroke-width": 2 }, g);
  // prénom
  el("rect", { x: -18, y: -32, width: 36, height: 7, rx: 3, fill: "#e784a8" }, g);
  el("path", { d: "M -14 -18 L 14 -18 M -14 -11 L 6 -11", fill: "none", stroke: "#caa6b4", "stroke-width": 2 }, g);
  // ruban / nœud en haut
  el("path", { d: "M 0 -62 Q -16 -73 -18 -60 Q -8 -57 0 -62 Q 8 -57 18 -60 Q 16 -73 0 -62 Z", fill: "#bcd6ef", stroke: "#8fb6da", "stroke-width": 1.5 }, g);
  el("circle", { cx: 0, cy: -62, r: 4, fill: "#8fb6da" }, g);
  return { g, w: 56, h: 76 };
}

// le perfo de JJ (perforateur dressé, mèche en l'air)
function drawDrill(parent) {
  const g = el("g", {}, parent);
  // poignée
  el("rect", { x: -11, y: -34, width: 22, height: 34, rx: 6, fill: "#3a3f44", stroke: "rgba(0,0,0,.3)", "stroke-width": 2 }, g);
  el("rect", { x: -9, y: -30, width: 18, height: 7, rx: 2, fill: "#d6452c" }, g);
  // corps moteur
  el("rect", { x: -15, y: -78, width: 30, height: 46, rx: 8, fill: "#f0a93a", stroke: "#b87a1e", "stroke-width": 2.5 }, g);
  el("rect", { x: -15, y: -58, width: 30, height: 7, fill: "#b87a1e" }, g);
  // mandrin
  el("rect", { x: -8, y: -92, width: 16, height: 16, rx: 3, fill: "#9aa0a6", stroke: "#6c7176", "stroke-width": 2.5 }, g);
  // mèche
  el("rect", { x: -3, y: -118, width: 6, height: 28, fill: "#c2c7cc", stroke: "#8c9196", "stroke-width": 1.5 }, g);
  el("path", { d: "M -3 -110 L 3 -106 M -3 -102 L 3 -98 M -3 -94 L 3 -90", stroke: "#8c9196", "stroke-width": 1.5 }, g);
  return { g, w: 44, h: 118 };
}

// Barbinul : le faux nain qui fait la tête (tunique kaki, bonnet à pompon terne)
function drawBarbinul(parent) {
  const tunic = "#6d7a55";
  const tunicDark = "#586245";
  const g = el("g", { class: "gnome-body" }, parent);
  el("ellipse", { cx: -13, cy: -6, rx: 14, ry: 9, fill: "#5b3a29" }, g);
  el("ellipse", { cx: 13, cy: -6, rx: 14, ry: 9, fill: "#4a2f21" }, g);
  el("rect", { x: -16, y: -50, width: 32, height: 42, rx: 9, fill: "#55603f" }, g);
  el("path", { d: "M -27 -48 Q 0 -62 27 -48 L 21 -98 Q 0 -110 -21 -98 Z", fill: tunic }, g);
  el("rect", { x: -25, y: -64, width: 50, height: 11, rx: 5, fill: "#2c1d12" }, g);
  el("rect", { x: -7, y: -67, width: 14, height: 16, rx: 3, fill: "#b9933a" }, g);
  // bras croisés et boudeurs
  el("ellipse", { cx: -20, cy: -70, rx: 8, ry: 10, fill: tunicDark }, g);
  el("ellipse", { cx: 20, cy: -70, rx: 8, ry: 10, fill: tunicDark }, g);
  // barbe grisâtre mal peignée
  el("path", { d: "M -23 -102 Q -32 -68 0 -56 Q 32 -68 23 -102 Q 11 -92 0 -92 Q -11 -92 -23 -102 Z", fill: "#e3e0d4", stroke: "#c8c3b2", "stroke-width": 2 }, g);
  // visage
  el("circle", { cx: 0, cy: -106, r: 16, fill: "#eaad7e" }, g);
  // bouche boudeuse (frown)
  el("path", { d: "M -7 -95 Q 0 -101 7 -95", fill: "none", stroke: "#9c5a3c", "stroke-width": 2.5, "stroke-linecap": "round" }, g);
  // nez
  el("ellipse", { cx: 0, cy: -101, rx: 7.5, ry: 6.5, fill: "#dd8a5e" }, g);
  // yeux
  el("circle", { cx: -7, cy: -111, r: 2.5, fill: "#2c1d12" }, g);
  el("circle", { cx: 7, cy: -111, r: 2.5, fill: "#2c1d12" }, g);
  // sourcils froncés (en V)
  el("path", { d: "M -13 -118 L -3 -114", fill: "none", stroke: "#3a2a1c", "stroke-width": 3, "stroke-linecap": "round" }, g);
  el("path", { d: "M 13 -118 L 3 -114", fill: "none", stroke: "#3a2a1c", "stroke-width": 3, "stroke-linecap": "round" }, g);
  // bonnet (presque comme le vrai) + pompon terne = le tell
  el("path", { d: "M -21 -112 Q 0 -122 21 -112 Q 17 -150 3 -170 Q -14 -148 -21 -112 Z", fill: "#cf5138", stroke: "#9e3a22", "stroke-width": 2.5 }, g);
  el("circle", { cx: 3, cy: -169, r: 5.5, fill: "#b7b1a1", stroke: "#9a9482", "stroke-width": 1.5 }, g);
  return { g, w: 62, h: GNOME_H };
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
// fausse botte n°3 : œuf dur — même ovoïde que la botte mais couleur coquille
function fragEgg(g) {
  el("ellipse", { cx: 6, cy: -7, rx: 12, ry: 9, fill: "#f6efdf", stroke: "#ddd1b6", "stroke-width": 2, transform: "rotate(-14 6 -7)" }, g);
  el("ellipse", { cx: 1, cy: -11, rx: 3.5, ry: 2.4, fill: "rgba(255,255,255,.6)" }, g);
}
// faux bonnet : un éclat de confetti rouge dressé ~ pointe de bonnet, entouré d'éclats
function fragConfetti(g) {
  el("path", { d: "M -4 4 L 1 -26 L 6 4 Z", fill: "#d6452c", stroke: "#a93722", "stroke-width": 2 }, g);
  el("rect", { x: -13, y: -8, width: 6, height: 9, rx: 1.5, fill: "#e8b339", transform: "rotate(-22 -10 -4)" }, g);
  el("rect", { x: 8, y: -13, width: 6, height: 9, rx: 1.5, fill: "#4d8a4b", transform: "rotate(28 11 -9)" }, g);
  el("rect", { x: -2, y: -30, width: 5, height: 8, rx: 1.5, fill: "#3f6ea0", transform: "rotate(12 0 -26)" }, g);
}
// fausse botte : bout de canon orange + embout clair qui dépasse
function fragWatergun(g) {
  el("rect", { x: -2, y: -11, width: 20, height: 10, rx: 3, fill: "#ef7a3a", stroke: "#b8431a", "stroke-width": 2, transform: "rotate(-10 -2 -6)" }, g);
  el("rect", { x: 15, y: -12, width: 5, height: 8, rx: 1.5, fill: "#bfe3ef", stroke: "#7fb3c9", "stroke-width": 1.5 }, g);
}
// fausse botte : bout de pied couleur peau (~ celle du nain) + malléole
function fragAnkle(g) {
  el("path", { d: "M 0 2 Q -3 -15 7 -17 Q 16 -17 18 -4 Q 19 2 13 2 Z", fill: "#f2b98c", stroke: "#d98f63", "stroke-width": 2 }, g);
  el("circle", { cx: 7, cy: -13, r: 2.4, fill: "#e6a37a" }, g);
}
// faux bonnet : coin de carton à damier qui dépasse (~ pointe de bonnet)
function fragInvitation(g) {
  el("path", { d: "M -10 4 L -10 -22 L 10 -22 L 10 4 Z", fill: "#fbf4e6", stroke: "rgba(0,0,0,.22)", "stroke-width": 2 }, g);
  for (let i = 0; i < 4; i++) el("rect", { x: -10 + i * 5, y: -22, width: 5, height: 6, fill: i % 2 ? "#2c1d12" : "#fbf4e6" }, g);
}
// fausse botte : bout de galet gris + petit bout de langue rose
function fragLickStone(g) {
  el("path", { d: "M 0 2 Q -4 -16 8 -18 Q 18 -18 18 -6 Q 18 2 12 2 Z", fill: "#9aa0a6", stroke: "rgba(0,0,0,.25)", "stroke-width": 2 }, g);
  el("ellipse", { cx: 6, cy: -11, rx: 4, ry: 2, fill: "rgba(255,255,255,.4)" }, g);
  el("path", { d: "M 15 -6 Q 24 -5 24 -13 Q 20 -11 15 -11 Z", fill: "#e784a8", stroke: "#c75c84", "stroke-width": 1.5 }, g);
}
// fausse barbe : coin de carton pastel qui dépasse sur le côté
function fragAnnouncement(g) {
  el("path", { d: "M 0 2 L 0 -20 L 16 -20 L 16 2 Z", fill: "#fdf1f5", stroke: "rgba(0,0,0,.2)", "stroke-width": 2 }, g);
  el("rect", { x: 3, y: -9, width: 11, height: 4, rx: 2, fill: "#e784a8" }, g);
  el("path", { d: "M 4 -15 L 13 -15", fill: "none", stroke: "#caa6b4", "stroke-width": 1.5 }, g);
}
// fausse botte : mandrin gris + mèche métallique qui dépasse
function fragDrill(g) {
  el("rect", { x: 0, y: -16, width: 14, height: 16, rx: 3, fill: "#9aa0a6", stroke: "#6c7176", "stroke-width": 2, transform: "rotate(-12 7 -8)" }, g);
  el("rect", { x: 4, y: -32, width: 5, height: 17, fill: "#c2c7cc", stroke: "#8c9196", "stroke-width": 1.5, transform: "rotate(-12 7 -8)" }, g);
}
// faux bonnet de Barbinul : pointe quasi identique au vrai nain mais
// rouge légèrement différent + petit pompon terne (le seul tell visible)
function fragBarbinulHat(g) {
  el("path", { d: "M -11 4 Q -6 -10 0 -22 Q 6 -10 11 4 Z", fill: "#cf5138", stroke: "#9e3a22", "stroke-width": 2.5 }, g);
  el("circle", { cx: 0, cy: -22, r: 3.4, fill: "#b7b1a1", stroke: "#9a9482", "stroke-width": 1.2 }, g);
}

const DECOY_TYPES = [
  { full: drawMushroom, frag: fragMushroom, kind: "top", label: "un champignon" },
  { full: drawBalloon, frag: fragBalloon, kind: "top", label: "un ballon perdu" },
  { full: drawBirdhouse, frag: fragRoof, kind: "top", label: "un nichoir" },
  { full: drawDandelions, frag: fragDandelion, kind: "side-mid", label: "des pissenlits" },
  { full: drawGlove, frag: fragGlove, kind: "side-base", label: "un vieux gant de jardin" },
  { full: drawPinecone, frag: fragPinecone, kind: "side-base", label: "une pomme de pin" },
  { full: drawEgg, frag: fragEgg, kind: "side-base", label: "l'œuf dur de pape", msg: "Raté ! C'est l'œuf dur de pape…" },
  { full: drawConfetti, frag: fragConfetti, kind: "top", label: "les confettis de Chris & Lulu", msg: "Raté ! Ce sont les confettis de Chris & Lulu…" },
  { full: drawWatergun, frag: fragWatergun, kind: "side-base", label: "le pistolet à eau de Loulou", msg: "Raté ! C'est le pistolet à eau de Loulou…" },
  { full: drawAnkle, frag: fragAnkle, kind: "side-base", label: "la cheville de Nana", msg: "Raté ! C'est la cheville de Nana…" },
  { full: drawInvitation, frag: fragInvitation, kind: "top", label: "l'invitation au Mans de la semaine prochaine", msg: "Raté ! C'est l'invitation au Mans de la semaine prochaine…" },
  { full: drawLickStone, frag: fragLickStone, kind: "side-base", label: "un caillou à lécher", msg: "Raté ! Ce n'est qu'un caillou à lécher…" },
  { full: drawAnnouncement, frag: fragAnnouncement, kind: "side-mid", label: "le faire-part de Sacha", msg: "Raté ! C'est le faire-part de Sacha…" },
  { full: drawDrill, frag: fragDrill, kind: "side-base", label: "le perfo de JJ", msg: "Raté ! C'est le perfo de JJ…" },
  { full: drawBarbinul, frag: fragBarbinulHat, kind: "top", label: "Barbinul", msg: "Raté ! C'est Barbinul, le faux nain qui fait la tête…" },
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
  const decoyCount = Math.min(randInt(5, 7), others.length);
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
  interactives.push({ ...r, role: "decoy", label: type.label, msg: type.msg, done: false });
}

/* ---------- État & chrono ---------- */

const state = { phase: "intro", startTs: 0, penaltyMs: 0, finalMs: 0, lastWinMs: null, raf: 0 };

// passe à true si l'inspecteur est détecté pendant la partie → score non homologué
let cheated = false;

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
  resetTribunal();
  cheated = false;
  const wc = document.getElementById("winCheat");
  if (wc) wc.classList.add("hidden");
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
    bubble(pt, entry.msg || `Raté ! C'était ${entry.label}…`);
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
  const wc = document.getElementById("winCheat");
  if (cheated) {
    if (wc) wc.classList.remove("hidden");           // tricheur : score non homologué
  } else {
    if (wc) wc.classList.add("hidden");
    if (window.offerRecord) window.offerRecord(state.finalMs);
  }
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

/* ---------- Le tribunal du Barbichon ----------
   Pour rigoler : on « désigne » le coupable du nain de jardin. La roue
   a l'air de tirer au sort parmi toute la bande… mais elle tombe
   TOUJOURS sur Pape, et le verdict s'en étonne lui-même. */
(function tribunalModule() {
  const SUSPECTS = ["Chris", "Lulu", "RV", "AnneSo", "Nana", "Ben", "Pape", "Loulou", "Jacques Chirac"];
  const CULPRIT = "Pape";
  const OTHERS = SUSPECTS.filter((n) => n !== CULPRIT);

  // Toutes feignent la surprise : bizarre que ça retombe toujours sur lui…
  const VERDICTS = [
    "Encore Pape ?! La roue jure pourtant qu'elle a tourné au hasard…",
    "Coupable : Pape. Comme la dernière fois. Et celle d'avant. Troublant.",
    "C'est… Pape. Étrange, la roue tombe toujours sur lui, non ?",
    "Verdict : Pape. Les statisticiens du groupe commencent à s'inquiéter.",
    "Pape, sans surprise. Le hasard a manifestement un favori.",
    "La roue a hésité une fraction de seconde… puis non, c'est bien Pape.",
    "Toujours Pape. À ce stade ce n'est plus du hasard, c'est une signature.",
    "Le tribunal du Barbichon déclare Pape coupable. Il plaide « pas cette fois »… mais si.",
  ];

  // Coup de théâtre rarissime : ~1 fois sur 50, la roue « bugge » et
  // accuse quelqu'un d'autre, à la stupéfaction générale.
  const SURPRISE_ODDS = 1 / 50;
  const SURPRISE_VERDICTS = [
    (n) => `Quoi ?! ${n} ?? La roue n'en revient pas elle-même… Pape l'a sûrement soudoyée.`,
    (n) => `Incroyable : pour une fois ce n'est PAS Pape, c'est ${n}. Vérifiez les piles de la roue.`,
    (n) => `${n} ?! Bug du destin. Pape exige un second tour.`,
    (n) => `Alerte : la roue a désigné ${n}. Un huissier confirme que Pape respire enfin.`,
  ];

  const Store = window.BarbichonStore;

  const rpick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  // pioche un élément différent de `avoid` (sans boucle, donc jamais bloquant)
  const pickOther = (arr, avoid) => {
    let idx = Math.floor(Math.random() * arr.length);
    if (arr[idx] === avoid) idx = (idx + 1) % arr.length;
    return arr[idx];
  };

  const btn = document.getElementById("tribunalBtn");
  const stageEl = document.getElementById("tribunalStage");
  const nameEl = document.getElementById("tribunalName");
  const verdictEl = document.getElementById("tribunalVerdict");
  const countEl = document.getElementById("tribunalCount");

  let spinning = false;

  window.resetTribunal = function () {
    spinning = false;
    btn.classList.remove("hidden");
    btn.disabled = false;
    stageEl.classList.add("hidden");
    nameEl.classList.remove("spinning", "verdict", "surprise");
    nameEl.textContent = "—";
    verdictEl.textContent = "";
    countEl.textContent = "";
  };

  function spin() {
    if (spinning) return;
    spinning = true;
    btn.classList.add("hidden");
    stageEl.classList.remove("hidden");
    verdictEl.textContent = "";
    countEl.textContent = "";
    nameEl.classList.remove("verdict", "surprise");
    nameEl.classList.add("spinning");

    // qui sera désigné, décidé dès le départ (Pape, sauf rarissime exception)
    const surprise = Math.random() < SURPRISE_ODDS;
    const culprit = surprise ? rpick(OTHERS) : CULPRIT;

    const STEPS = 30;
    let i = 0;
    let last = "";

    function step() {
      let name;
      if (i >= STEPS - 1) {
        name = culprit;                         // arrivée
      } else if (i === STEPS - 4) {
        name = pickOther(SUSPECTS, culprit);    // faux suspense
      } else {
        name = pickOther(SUSPECTS, last);       // pas de répétition d'affilée
      }
      last = name;
      nameEl.textContent = name;
      i++;

      if (i < STEPS) {
        const t = i / STEPS;
        setTimeout(step, 45 + t * t * t * 430); // décélération façon roue
      } else {
        finish();
      }
    }

    function finish() {
      spinning = false;
      nameEl.classList.remove("spinning");
      // petit délai dramatique sur le dernier nom avant le verdict
      setTimeout(() => {
        nameEl.classList.add(surprise ? "surprise" : "verdict");
        verdictEl.textContent = surprise
          ? rpick(SURPRISE_VERDICTS)(culprit)
          : rpick(VERDICTS);
        countEl.textContent = "…";
        recordAndShow(culprit, surprise);
      }, 420);
    }

    step();
  }

  // enregistre le tirage dans le store partagé puis affiche le compteur du nom
  async function recordAndShow(name, surprise) {
    let st = null;
    try { st = await Store.recordDraw(name); } catch (_) {}
    const papeN = st ? (st.tally.Pape || 0) : 0;
    const thisN = st ? (st.tally[name] || 0) : 0;
    if (surprise) {
      countEl.textContent = papeN > 0
        ? `Pape souffle : il en reste à ${papeN} accusation${papeN > 1 ? "s" : ""}, et pour une fois ce n'est pas lui (${name} ×${thisN}).`
        : "Pape souffle : pour une fois, ce n'est pas lui.";
    } else {
      countEl.textContent = papeN === 1
        ? "1ʳᵉ accusation de Pape… et probablement pas la dernière."
        : `Pape en est à ${papeN} accusations. À ce rythme, c'est un dossier.`;
    }
  }

  btn.addEventListener("click", spin);
})();

/* ---------- Palmarès : records (Top 10 + pseudo) & journal de la roue ----------
   Lecture/écriture via window.BarbichonStore (JSONBin si configuré, sinon
   localStorage). Toute la logique tolère l'absence de réseau. */
(function boardModule() {
  const Store = window.BarbichonStore;
  if (!Store) return;

  const overlay = document.getElementById("boardOverlay");
  const scopeEl = document.getElementById("boardScope");
  const timesEl = document.getElementById("boardTimes");
  const tallyEl = document.getElementById("boardTally");
  const logEl = document.getElementById("boardLog");

  const recordForm = document.getElementById("recordForm");
  const recordRow = recordForm.querySelector(".record-row");
  const recordFlag = document.getElementById("recordFlag");
  const pseudoInput = document.getElementById("pseudoInput");
  const saveBtn = document.getElementById("saveTimeBtn");

  const PSEUDO_KEY = "barbichon-pseudo";
  let pendingMs = null;     // temps en attente d'enregistrement (null = rien à sauver)
  let prevOverlay = null;   // overlay masqué pendant l'affichage du palmarès

  function fmtWhen(t) {
    if (!t) return "";
    try {
      const d = new Date(t);
      const date = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
      const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      return `${date} ${time}`;
    } catch (_) { return ""; }
  }

  function emptyLi(ul, txt) {
    const li = document.createElement("li");
    li.className = "board-empty";
    li.textContent = txt;
    ul.appendChild(li);
  }

  // invalide tout enregistrement en cours (appelé si l'inspecteur est détecté)
  window.invalidateScore = function () {
    pendingMs = null;
    recordForm.classList.add("hidden");
  };

  // proposé après une victoire : si le temps entre dans le Top 10, on demande le pseudo
  window.offerRecord = async function (ms) {
    pendingMs = null;
    recordForm.classList.add("hidden");
    recordRow.style.display = "";
    saveBtn.disabled = false;
    if (cheated) return;            // tricheur : pas de score homologué
    let st;
    try { st = await Store.getState(); } catch (_) { return; }
    if (!Store.qualifies(st, ms)) return;
    pendingMs = ms;
    recordFlag.textContent = "🏅 Nouveau record ! Entre ton pseudo :";
    try { pseudoInput.value = localStorage.getItem(PSEUDO_KEY) || ""; } catch (_) {}
    recordForm.classList.remove("hidden");
    setTimeout(() => { try { pseudoInput.focus(); } catch (_) {} }, 60);
  };

  async function saveTime() {
    if (pendingMs == null) return;
    if (cheated) { recordForm.classList.add("hidden"); pendingMs = null; return; } // anti-triche
    const pseudo = (pseudoInput.value || "").trim().slice(0, 14) || "Anonyme";
    try { localStorage.setItem(PSEUDO_KEY, pseudo); } catch (_) {}
    const ms = pendingMs;
    pendingMs = null;
    saveBtn.disabled = true;
    let rank = null;
    try { ({ rank } = await Store.recordTime(pseudo, ms)); } catch (_) {}
    recordRow.style.display = "none";
    recordFlag.textContent = rank
      ? `🏅 ${pseudo}, tu es ${rank === 1 ? "1er" : rank + "e"} au classement !`
      : "Record enregistré ✓";
  }

  async function openBoard() {
    // masque l'overlay courant (intro ou victoire) : évite d'empiler deux
    // fonds floutés (rendu douteux) et garde un affichage net.
    prevOverlay = null;
    for (const id of ["intro", "winOverlay"]) {
      const o = document.getElementById(id);
      if (!o.classList.contains("hidden")) { prevOverlay = o; o.classList.add("hidden"); break; }
    }
    timesEl.innerHTML = tallyEl.innerHTML = logEl.innerHTML = "";
    scopeEl.textContent = Store.isRemote()
      ? "Classement partagé entre potes 🌍"
      : "Sur cet appareil (active le partage dans store.js) 📱";
    overlay.classList.remove("hidden");

    let st;
    try { st = await Store.getState(); }
    catch (_) { st = { draws: [], tally: {}, bestTimes: [] }; }

    // meilleurs temps
    if (!st.bestTimes.length) emptyLi(timesEl, "Aucun temps encore. Va trouver ce nain !");
    for (const e of st.bestTimes) {
      const li = document.createElement("li");
      li.innerHTML = '<span class="who"></span><span class="when"></span><span class="score"></span>';
      li.querySelector(".who").textContent = e.p;       // textContent = pas d'injection
      li.querySelector(".when").textContent = fmtWhen(e.t);
      li.querySelector(".score").textContent = fmt(e.ms);
      timesEl.appendChild(li);
    }

    // compteur de tirages par nom (tri décroissant)
    const entries = Object.entries(st.tally).sort((a, b) => b[1] - a[1]);
    if (!entries.length) emptyLi(tallyEl, "La roue n'a encore désigné personne.");
    for (const [name, n] of entries) {
      const li = document.createElement("li");
      li.innerHTML = '<span></span><span class="count"></span>';
      li.children[0].textContent = name;
      li.children[1].textContent = "×" + n;
      tallyEl.appendChild(li);
    }

    // derniers tirages (plus récent en premier, max 15)
    const recent = st.draws.slice(-15).reverse();
    if (!recent.length) emptyLi(logEl, "—");
    for (const d of recent) {
      const li = document.createElement("li");
      li.innerHTML = '<span></span><span class="when"></span>';
      li.children[0].textContent = d.n;
      li.children[1].textContent = fmtWhen(d.t);
      logEl.appendChild(li);
    }
  }

  function closeBoard() {
    overlay.classList.add("hidden");
    if (prevOverlay) { prevOverlay.classList.remove("hidden"); prevOverlay = null; }
  }

  document.getElementById("boardBtnIntro").addEventListener("click", openBoard);
  document.getElementById("boardBtnWin").addEventListener("click", openBoard);
  document.getElementById("boardCloseBtn").addEventListener("click", closeBoard);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeBoard(); });
  saveBtn.addEventListener("click", saveTime);
  pseudoInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); saveTime(); }
  });
})();

/* ---------- Détecteur d'inspecteur (œuf de Pâques) ----------
   Si quelqu'un ouvre les DevTools pour fouiller / bidouiller le HTML,
   le Barbichon le prend la main dans le sac. */
(function devtoolsGuard() {
  let shown = false;      // overlay actuellement affiché
  let dismissed = false;  // alerte fermée pour cette ouverture d'inspecteur

  const BUST_QUIPS = [
    "Le Barbichon t'a vu soulever le capot pour fouiller dans son code… Mauvais joueur&nbsp;! Il ira se cacher ailleurs.",
    "Pas la peine d'inspecter le HTML, petit malin&nbsp;: le nain change de cachette à chaque partie&nbsp;!",
    "Hé&nbsp;! Bidouiller la page, c'est de la triche. Le Barbichon te tient à l'œil.",
  ];

  function bust() {
    // ouvrir l'inspecteur invalide le score de la partie en cours
    cheated = true;
    if (window.invalidateScore) window.invalidateScore();
    const wc = document.getElementById("winCheat");
    if (wc && winEl && !winEl.classList.contains("hidden")) wc.classList.remove("hidden");

    if (shown) return;
    shown = true;

    const ov = document.createElement("div");
    ov.id = "devtoolsBust";
    ov.innerHTML = `
      <div class="card">
        <svg class="card-gnome bust-gnome" viewBox="-60 -190 120 200" aria-hidden="true"></svg>
        <h2>Pris la main dans le sac&nbsp;!</h2>
        <p>${pick(BUST_QUIPS)}</p>
        <button type="button" class="btn" id="bustClose">Promis, j'arrête…</button>
      </div>`;
    document.body.appendChild(ov);
    drawGnome(el("g", {}, ov.querySelector(".bust-gnome")));
    ov.querySelector("#bustClose").addEventListener("click", () => {
      ov.remove();
      shown = false;
      dismissed = true; // on ne le harcèle pas tant qu'il ne rouvre pas l'inspecteur
    });
  }

  // Méthode 1 : raccourcis qui ouvrent l'inspecteur (instantané, fiable)
  // e.code est indépendant de la disposition clavier et des modificateurs.
  window.addEventListener("keydown", (e) => {
    const letter = e.code === "KeyI" || e.code === "KeyJ" || e.code === "KeyC";
    const opensTools =
      e.key === "F12" ||
      ((e.ctrlKey || e.metaKey) && e.shiftKey && letter) || // Win/Linux + Chrome Mac
      (e.metaKey && e.altKey && letter);                    // raccourcis Mac alternatifs
    if (opensTools) {
      dismissed = false;
      bust();
    }
  });

  // Méthode 2 : écart de taille de la fenêtre (inspecteur ancré, ex. clic droit « Inspecter »)
  const THRESHOLD = 160;
  function docked() {
    return window.outerWidth - window.innerWidth > THRESHOLD ||
           window.outerHeight - window.innerHeight > THRESHOLD;
  }
  function poll() {
    if (docked()) {
      if (!dismissed) bust();
    } else {
      dismissed = false; // inspecteur refermé : on réarme
    }
  }
  window.addEventListener("resize", poll);
  setInterval(poll, 700);
  poll();
})();
