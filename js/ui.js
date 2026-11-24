// Interfície: calaix d'entrada, llenç a pantalla completa (pinyó a dalt, roda a baix).
import { calcularParella, contornRoda, lliscamentEspecific, radAGraus } from './geometry.js';
import { crearGraficLliscament, actualitzarGraficLliscament } from './charts.js';

const $ = (id) => document.getElementById(id);
const CLAU = 'gearcalc.v2';
const PER_DEFECTE = { z1: 17, z2: 40, m: 2, a: 58, perfil: 'A', relacioLog: 0 };

const fmt = (dec) => new Intl.NumberFormat('ca-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const f3 = fmt(3).format;
const f4 = fmt(4).format;

// ---------------------------------------------------------------- estat
let dades = { ...PER_DEFECTE };
try {
  const desat = JSON.parse(localStorage.getItem(CLAU) || 'null');
  if (desat && typeof desat === 'object') dades = { ...dades, ...desat };
} catch { /* emmagatzematge no disponible */ }

let parella = null; // últim càlcul vàlid
let camins = null; // Path2D del pinyó i de la roda
let vista = { s: 1, ox: 0, oy: 0 };
let theta = 0; // gir del pinyó (rad)
let animant = false;
let darrerT = 0;
let pendent = false;
let colors = {};
const capes = { primitives: true, base: true, linia: true };

const llenc = $('llenc');
const ctx = llenc.getContext('2d');
const grafic = crearGraficLliscament($('grafic-lliscament'));

// ---------------------------------------------------------------- entrades
const entrades = { z1: $('z1'), z2: $('z2'), m: $('m'), a: $('a'), perfil: $('perfil'), relacio: $('relacio') };
entrades.z1.value = dades.z1;
entrades.z2.value = dades.z2;
entrades.m.value = dades.m;
entrades.a.value = dades.a;
entrades.perfil.value = dades.perfil;
entrades.relacio.value = dades.relacioLog;

function desar() {
  try { localStorage.setItem(CLAU, JSON.stringify(dades)); } catch { /* sense emmagatzematge */ }
}

function llegirEntrades() {
  const num = (el) => (el.value.trim() === '' ? NaN : Number(el.value.replace(',', '.')));
  return {
    z1: num(entrades.z1),
    z2: num(entrades.z2),
    m: num(entrades.m),
    a: num(entrades.a),
    perfil: entrades.perfil.value,
    relacioLog: Number(entrades.relacio.value),
  };
}

function recalcular({ encaixar = false } = {}) {
  const e = llegirEntrades();
  const relacio = 2 ** e.relacioLog;
  $('relacio-valor').textContent = f3(relacio);
  const a0 = (e.m * (e.z1 + e.z2)) / 2;
  $('a0').textContent = Number.isFinite(a0) ? f3(a0) : '–';
  for (const k of ['z1', 'z2', 'm', 'a']) entrades[k].classList.remove('invalid');

  try {
    const nova = calcularParella({ z1: e.z1, z2: e.z2, m: e.m, a: e.a, perfil: e.perfil, relacio });
    parella = nova;
    dades = e;
    desar();
    camins = parella.rodes.map((rw) => crearCami(rw));
    pintarResultats();
    actualitzarGraficLliscament(grafic, lliscamentEspecific(parella));
    const [p1, p2] = parella.rodes;
    mostrarEstat(`x₁ = ${f4(p1.x)} · x₂ = ${f4(p2.x)} · α_w = ${f3(radAGraus(parella.alphaW))}° · ε_α = ${f3(parella.epsilonAlpha)}`);
    if (encaixar) encaixarTot();
  } catch (err) {
    const msg = err.message || String(err);
    if (/z1/.test(msg)) entrades.z1.classList.add('invalid');
    if (/z2/.test(msg)) entrades.z2.classList.add('invalid');
    if (/mòdul/i.test(msg)) entrades.m.classList.add('invalid');
    if (/centres/i.test(msg)) entrades.a.classList.add('invalid');
    mostrarEstat(msg, true);
    $('avisos').innerHTML = '';
    $('avisos').append(elementAvis({ nivell: 'error', text: msg }));
  }
  dibuixar();
}

function mostrarEstat(text, error = false) {
  const el = $('estat');
  el.textContent = text;
  el.classList.toggle('error', error);
}

function elementAvis({ nivell, text }) {
  const li = document.createElement('li');
  li.className = nivell;
  li.textContent = text;
  return li;
}

function pintarResultats() {
  const llista = $('avisos');
  llista.innerHTML = '';
  if (parella.avisos.length === 0) llista.append(elementAvis({ nivell: 'ok', text: 'Sense avisos.' }));
  for (const a of parella.avisos) llista.append(elementAvis(a));

  const filesParella = [
    ['a₀ (mm)', f3(parella.a0)],
    ['α_w (°)', f3(radAGraus(parella.alphaW))],
    ['x₁ + x₂', f4(parella.sumaX)],
    ['k · m (mm)', f4(parella.k * parella.entrada.m)],
    ['ε_α', f3(parella.epsilonAlpha)],
    ['Joc de fons c (mm)', f3(parella.jocFons[0])],
  ];
  $('taula-parella').innerHTML = filesParella.map(([n, v]) => `<tr><td>${n}</td><td>${v}</td></tr>`).join('');

  const [p, r] = parella.rodes;
  const files = [
    ['z', (w) => String(w.z)],
    ['x', (w) => f4(w.x)],
    ['x_min (soscavament)', (w) => f4(w.xMin)],
    ['d (mm)', (w) => f3(w.d)],
    ['d_b (mm)', (w) => f3(w.db)],
    ['d_w (mm)', (w) => f3(w.dw)],
    ['d_a (mm)', (w) => f3(w.da)],
    ['d_f (mm)', (w) => f3(w.df)],
    ['d_Nf forma (mm)', (w) => f3(w.dNf)],
    ['d inici contacte (mm)', (w) => (Number.isFinite(w.dSAP) ? f3(w.dSAP) : '—')],
    ['s (mm)', (w) => f3(w.s)],
    ['s_b (mm)', (w) => f3(w.sb)],
    ['s_w (mm)', (w) => f3(w.sw)],
    ['s_a (mm)', (w) => f3(w.sa)],
  ];
  $('taula-rodes').innerHTML =
    '<thead><tr><th></th><th class="pinyo">Pinyó</th><th class="roda">Roda</th></tr></thead><tbody>' +
    files.map(([n, fn]) => `<tr><td>${n}</td><td>${fn(p)}</td><td>${fn(r)}</td></tr>`).join('') +
    '</tbody>';
}

// agrupa entrades ràpides (lliscador) en un càlcul per fotograma: tallar és costós
let calculPendent = null;
function programarCalcul(encaixar = false) {
  const previ = calculPendent;
  calculPendent = { encaixar: encaixar || (previ && previ.encaixar) };
  if (previ) return;
  requestAnimationFrame(() => {
    const op = calculPendent;
    calculPendent = null;
    recalcular(op);
  });
}
for (const k of ['z1', 'z2', 'm']) entrades[k].addEventListener('input', () => programarCalcul(true));
for (const k of ['a', 'perfil', 'relacio']) entrades[k].addEventListener('input', () => programarCalcul());
entrades.perfil.addEventListener('change', () => programarCalcul());

$('btn-a0').addEventListener('click', () => {
  const e = llegirEntrades();
  const a0 = (e.m * (e.z1 + e.z2)) / 2;
  if (Number.isFinite(a0)) {
    entrades.a.value = String(+a0.toFixed(6));
    recalcular();
  }
});
$('btn-relacio-1').addEventListener('click', () => {
  entrades.relacio.value = 0;
  recalcular();
});

for (const [id, capa] of [['veure-primitives', 'primitives'], ['veure-base', 'base'], ['veure-linia', 'linia']]) {
  $(id).addEventListener('change', (ev) => {
    capes[capa] = ev.target.checked;
    dibuixar();
  });
}

// ---------------------------------------------------------------- calaix
const calaix = $('calaix');
function obrirCalaix(obrir) {
  calaix.classList.toggle('obert', obrir);
  calaix.setAttribute('aria-hidden', String(!obrir));
  $('btn-calaix').setAttribute('aria-expanded', String(obrir));
}
$('btn-calaix').addEventListener('click', () => obrirCalaix(!calaix.classList.contains('obert')));
$('btn-tancar').addEventListener('click', () => obrirCalaix(false));
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') obrirCalaix(false);
});

// ---------------------------------------------------------------- dibuix
function llegirColors() {
  const cs = getComputedStyle(document.documentElement);
  const c = (n) => cs.getPropertyValue(n).trim();
  colors = {
    fons: c('--fons'),
    pinyo: c('--pinyo'),
    pinyoFarciment: c('--pinyo-farciment'),
    roda: c('--roda'),
    rodaFarciment: c('--roda-farciment'),
    auxiliar: c('--auxiliar'),
    linia: c('--linia-engranament'),
  };
}
llegirColors();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  llegirColors();
  dibuixar();
});

function crearCami(rw) {
  const xy = contornRoda(rw.flanc, rw.z);
  const p = new Path2D();
  p.moveTo(xy[0], xy[1]);
  for (let i = 2; i < xy.length; i += 2) p.lineTo(xy[i], xy[i + 1]);
  p.closePath();
  // forat central
  const rForat = Math.min(0.3 * (rw.df / 2), 4 * rw.m);
  p.moveTo(rForat, 0);
  p.arc(0, 0, rForat, 0, 2 * Math.PI);
  return p;
}

function mida() {
  const dpr = window.devicePixelRatio || 1;
  const w = llenc.clientWidth;
  const h = llenc.clientHeight;
  if (llenc.width !== Math.round(w * dpr) || llenc.height !== Math.round(h * dpr)) {
    llenc.width = Math.round(w * dpr);
    llenc.height = Math.round(h * dpr);
  }
  return { w, h, dpr };
}

function encaixarTot() {
  if (!parella) return;
  const { w, h } = mida();
  const [p, r] = parella.rodes;
  const a = parella.entrada.a;
  const ra1 = p.da / 2;
  const ra2 = r.da / 2;
  const amplada = 2 * Math.max(ra1, ra2);
  const yDalt = a / 2 + ra1;
  const yBaix = -a / 2 - ra2;
  const alcada = yDalt - yBaix;
  const s = 0.92 * Math.min(w / amplada, (h - 60) / alcada);
  vista = { s, ox: w / 2, oy: h / 2 + s * ((yDalt + yBaix) / 2) };
  dibuixar();
}

function encaixarEngranament() {
  if (!parella) return;
  const { w, h } = mida();
  const yC = parella.entrada.a / 2 - parella.rodes[0].dw / 2;
  const s = Math.min(w, h) / (6 * parella.entrada.m);
  vista = { s, ox: w / 2, oy: h / 2 + s * yC };
  dibuixar();
}

function dibuixar() {
  if (pendent) return;
  pendent = true;
  requestAnimationFrame(pintar);
}

function pintar(t) {
  pendent = false;
  const { w, h, dpr } = mida();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = colors.fons;
  ctx.fillRect(0, 0, w, h);
  if (!parella || !camins) return;

  if (animant) {
    if (darrerT) theta += ((t - darrerT) / 1000) * ((2 * Math.PI) / parella.entrada.z1 / 1.5);
    darrerT = t;
  }

  const { s, ox, oy } = vista;
  const px = 1 / s; // un píxel CSS en mm
  ctx.setTransform(dpr * s, 0, 0, -dpr * s, dpr * ox, dpr * oy);

  const [p, r] = parella.rodes;
  const a = parella.entrada.a;
  const z1 = parella.entrada.z1;
  const z2 = parella.entrada.z2;
  const y1 = a / 2;
  const y2 = -a / 2;
  const rw1 = p.dw / 2;
  const rw2 = r.dw / 2;

  // rodes: el pinyó amb una dent cap a la roda; la roda amb un buit cap al pinyó
  const angle1 = Math.PI + theta;
  const angle2 = Math.PI / z2 - (theta * z1) / z2;
  pintarRoda(camins[0], 0, y1, angle1, colors.pinyo, colors.pinyoFarciment, px);
  pintarRoda(camins[1], 0, y2, angle2, colors.roda, colors.rodaFarciment, px);

  ctx.lineWidth = px;
  if (capes.primitives) {
    ctx.strokeStyle = colors.auxiliar;
    ctx.setLineDash([8 * px, 5 * px]);
    cercle(0, y1, rw1);
    cercle(0, y2, rw2);
  }
  if (capes.base) {
    ctx.strokeStyle = colors.auxiliar;
    ctx.setLineDash([2 * px, 4 * px]);
    cercle(0, y1, p.db / 2);
    cercle(0, y2, r.db / 2);
  }
  ctx.setLineDash([]);

  if (capes.linia) {
    const yC = y1 - rw1;
    const sa = Math.sin(parella.alphaW);
    const ca = Math.cos(parella.alphaW);
    for (const sx of [1, -1]) {
      const dx = sx * ca;
      const dy = sa;
      const T1 = [dx * rw1 * sa, yC + dy * rw1 * sa];
      const T2 = [-dx * rw2 * sa, yC - dy * rw2 * sa];
      const P = (g) => [T1[0] - g * dx, T1[1] - g * dy];
      ctx.strokeStyle = colors.linia;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = px;
      segment(T1, T2);
      ctx.globalAlpha = 1;
      ctx.lineWidth = 3 * px;
      segment(P(parella.gA), P(parella.gE));
    }
    ctx.fillStyle = colors.linia;
    ctx.beginPath();
    ctx.arc(0, yC, 3.5 * px, 0, 2 * Math.PI);
    ctx.fill();
  }

  // centres
  ctx.strokeStyle = colors.auxiliar;
  ctx.lineWidth = px;
  for (const yc of [y1, y2]) {
    segment([-8 * px, yc], [8 * px, yc]);
    segment([0, yc - 8 * px], [0, yc + 8 * px]);
  }

  if (animant) dibuixar();
}

function pintarRoda(cami, cx, cy, angle, colorTrac, farciment, px) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = farciment;
  ctx.fill(cami, 'evenodd');
  ctx.strokeStyle = colorTrac;
  ctx.lineWidth = 1.4 * px;
  ctx.lineJoin = 'round';
  ctx.stroke(cami);
  ctx.restore();
}

function cercle(cx, cy, r) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.stroke();
}

function segment(a, b) {
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

// ---------------------------------------------------------------- navegació
function zoomA(px, py, factor) {
  const wx = (px - vista.ox) / vista.s;
  const wy = (vista.oy - py) / vista.s;
  const s = Math.min(Math.max(vista.s * factor, 1e-3), 1e5);
  vista = { s, ox: px - wx * s, oy: py + wy * s };
  dibuixar();
}

const punters = new Map();
llenc.addEventListener('pointerdown', (ev) => {
  llenc.setPointerCapture(ev.pointerId);
  punters.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
});
llenc.addEventListener('pointermove', (ev) => {
  const previ = punters.get(ev.pointerId);
  if (!previ) return;
  if (punters.size === 1) {
    vista.ox += ev.clientX - previ.x;
    vista.oy += ev.clientY - previ.y;
    punters.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    dibuixar();
  } else if (punters.size === 2) {
    const [ida, idb] = [...punters.keys()];
    const altre = punters.get(ida === ev.pointerId ? idb : ida);
    const dAbans = Math.hypot(previ.x - altre.x, previ.y - altre.y);
    const mAbans = { x: (previ.x + altre.x) / 2, y: (previ.y + altre.y) / 2 };
    punters.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    const dAra = Math.hypot(ev.clientX - altre.x, ev.clientY - altre.y);
    const mAra = { x: (ev.clientX + altre.x) / 2, y: (ev.clientY + altre.y) / 2 };
    vista.ox += mAra.x - mAbans.x;
    vista.oy += mAra.y - mAbans.y;
    if (dAbans > 0) zoomA(mAra.x, mAra.y, dAra / dAbans);
  }
});
const deixar = (ev) => punters.delete(ev.pointerId);
llenc.addEventListener('pointerup', deixar);
llenc.addEventListener('pointercancel', deixar);
llenc.addEventListener('wheel', (ev) => {
  ev.preventDefault();
  zoomA(ev.clientX, ev.clientY, Math.exp(-ev.deltaY * 0.0015));
}, { passive: false });
llenc.addEventListener('dblclick', encaixarTot);

$('btn-encaixar').addEventListener('click', encaixarTot);
$('btn-engranament').addEventListener('click', encaixarEngranament);
$('btn-animar').addEventListener('click', () => {
  animant = !animant;
  darrerT = 0;
  $('btn-animar').textContent = animant ? '⏸' : '▶';
  dibuixar();
});

let midaAnterior = { w: llenc.clientWidth, h: llenc.clientHeight };
window.addEventListener('resize', () => {
  // mantenir el centre de la vista
  const w = llenc.clientWidth;
  const h = llenc.clientHeight;
  vista.ox += (w - midaAnterior.w) / 2;
  vista.oy += (h - midaAnterior.h) / 2;
  midaAnterior = { w, h };
  dibuixar();
});

recalcular({ encaixar: true });
