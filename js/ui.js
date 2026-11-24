// Interfaz: drawer de entrada, lienzo a pantalla completa (piñón arriba, rueda abajo).
import { calcularPareja, contornoRueda, deslizamientoEspecifico, radAGrados } from './geometry.js';
import { crearGraficoDeslizamiento, actualizarGraficoDeslizamiento } from './charts.js';

const $ = (id) => document.getElementById(id);
const CLAVE = 'gearcalc.v1';
const POR_DEFECTO = { z1: 17, z2: 40, m: 2, a: 58, perfil: 'A', relacionLog: 0 };

const fmt = (dec) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const f3 = fmt(3).format;
const f4 = fmt(4).format;

// ---------------------------------------------------------------- estado
let datos = { ...POR_DEFECTO };
try {
  const guardado = JSON.parse(localStorage.getItem(CLAVE) || 'null');
  if (guardado && typeof guardado === 'object') datos = { ...datos, ...guardado };
} catch { /* almacenamiento no disponible */ }

let par = null; // último cálculo válido
let caminos = null; // Path2D de piñón y rueda
let vista = { s: 1, ox: 0, oy: 0 };
let theta = 0; // giro del piñón (rad)
let animando = false;
let ultimoT = 0;
let pendiente = false;
let colores = {};
const capas = { primitivas: true, base: true, linea: true };

const lienzo = $('lienzo');
const ctx = lienzo.getContext('2d');
const grafico = crearGraficoDeslizamiento($('grafico-deslizamiento'));

// ---------------------------------------------------------------- entradas
const entradas = { z1: $('z1'), z2: $('z2'), m: $('m'), a: $('a'), perfil: $('perfil'), relacion: $('relacion') };
entradas.z1.value = datos.z1;
entradas.z2.value = datos.z2;
entradas.m.value = datos.m;
entradas.a.value = datos.a;
entradas.perfil.value = datos.perfil;
entradas.relacion.value = datos.relacionLog;

function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(datos)); } catch { /* sin almacenamiento */ }
}

function leerEntradas() {
  const num = (el) => (el.value.trim() === '' ? NaN : Number(el.value.replace(',', '.')));
  return {
    z1: num(entradas.z1),
    z2: num(entradas.z2),
    m: num(entradas.m),
    a: num(entradas.a),
    perfil: entradas.perfil.value,
    relacionLog: Number(entradas.relacion.value),
  };
}

function recalcular({ encajar = false } = {}) {
  const e = leerEntradas();
  const relacion = 2 ** e.relacionLog;
  $('relacion-valor').textContent = f3(relacion);
  const a0 = (e.m * (e.z1 + e.z2)) / 2;
  $('a0').textContent = Number.isFinite(a0) ? f3(a0) : '–';
  for (const k of ['z1', 'z2', 'm', 'a']) entradas[k].classList.remove('invalido');

  try {
    const nuevo = calcularPareja({ z1: e.z1, z2: e.z2, m: e.m, a: e.a, perfil: e.perfil, relacion });
    par = nuevo;
    datos = e;
    guardar();
    caminos = par.ruedas.map((rw) => crearCamino(rw));
    pintarResultados();
    actualizarGraficoDeslizamiento(grafico, deslizamientoEspecifico(par));
    const [p1, p2] = par.ruedas;
    mostrarEstado(`x₁ = ${f4(p1.x)} · x₂ = ${f4(p2.x)} · α_w = ${f3(radAGrados(par.alphaW))}° · ε_α = ${f3(par.epsilonAlpha)}`);
    if (encajar) encajarTodo();
  } catch (err) {
    const msg = err.message || String(err);
    if (/z1/.test(msg)) entradas.z1.classList.add('invalido');
    if (/z2/.test(msg)) entradas.z2.classList.add('invalido');
    if (/módulo/i.test(msg)) entradas.m.classList.add('invalido');
    if (/centros/i.test(msg)) entradas.a.classList.add('invalido');
    mostrarEstado(msg, true);
    $('avisos').innerHTML = '';
    $('avisos').append(itemAviso({ nivel: 'error', texto: msg }));
  }
  dibujar();
}

function mostrarEstado(texto, error = false) {
  const el = $('estado');
  el.textContent = texto;
  el.classList.toggle('error', error);
}

function itemAviso({ nivel, texto }) {
  const li = document.createElement('li');
  li.className = nivel;
  li.textContent = texto;
  return li;
}

function pintarResultados() {
  const lista = $('avisos');
  lista.innerHTML = '';
  if (par.avisos.length === 0) lista.append(itemAviso({ nivel: 'ok', texto: 'Sin avisos.' }));
  for (const a of par.avisos) lista.append(itemAviso(a));

  const filasPar = [
    ['a₀ (mm)', f3(par.a0)],
    ['α_w (°)', f3(radAGrados(par.alphaW))],
    ['x₁ + x₂', f4(par.sumaX)],
    ['k · m (mm)', f4(par.k * par.entrada.m)],
    ['ε_α', f3(par.epsilonAlpha)],
    ['Holgura de fondo c (mm)', f3(par.holgura[0])],
  ];
  $('tabla-pareja').innerHTML = filasPar.map(([n, v]) => `<tr><td>${n}</td><td>${v}</td></tr>`).join('');

  const [p, r] = par.ruedas;
  const filas = [
    ['z', (w) => String(w.z)],
    ['x', (w) => f4(w.x)],
    ['x_min (socavado)', (w) => f4(w.xMin)],
    ['d (mm)', (w) => f3(w.d)],
    ['d_b (mm)', (w) => f3(w.db)],
    ['d_w (mm)', (w) => f3(w.dw)],
    ['d_a (mm)', (w) => f3(w.da)],
    ['d_f (mm)', (w) => f3(w.df)],
    ['d_Nf forma (mm)', (w) => f3(w.dNf)],
    ['d inicio contacto (mm)', (w) => (Number.isFinite(w.dSAP) ? f3(w.dSAP) : '—')],
    ['s (mm)', (w) => f3(w.s)],
    ['s_b (mm)', (w) => f3(w.sb)],
    ['s_w (mm)', (w) => f3(w.sw)],
    ['s_a (mm)', (w) => f3(w.sa)],
  ];
  $('tabla-ruedas').innerHTML =
    '<thead><tr><th></th><th class="pinon">Piñón</th><th class="rueda">Rueda</th></tr></thead><tbody>' +
    filas.map(([n, fn]) => `<tr><td>${n}</td><td>${fn(p)}</td><td>${fn(r)}</td></tr>`).join('') +
    '</tbody>';
}

// agrupa entradas rápidas (deslizador) en un cálculo por fotograma: tallar es costoso
let calculoPendiente = null;
function programarCalculo(encajar = false) {
  const previo = calculoPendiente;
  calculoPendiente = { encajar: encajar || (previo && previo.encajar) };
  if (previo) return;
  requestAnimationFrame(() => {
    const op = calculoPendiente;
    calculoPendiente = null;
    recalcular(op);
  });
}
for (const k of ['z1', 'z2', 'm']) entradas[k].addEventListener('input', () => programarCalculo(true));
for (const k of ['a', 'perfil', 'relacion']) entradas[k].addEventListener('input', () => programarCalculo());
entradas.perfil.addEventListener('change', () => programarCalculo());

$('btn-a0').addEventListener('click', () => {
  const e = leerEntradas();
  const a0 = (e.m * (e.z1 + e.z2)) / 2;
  if (Number.isFinite(a0)) {
    entradas.a.value = String(+a0.toFixed(6));
    recalcular();
  }
});
$('btn-relacion-1').addEventListener('click', () => {
  entradas.relacion.value = 0;
  recalcular();
});

for (const [id, capa] of [['ver-primitivas', 'primitivas'], ['ver-base', 'base'], ['ver-linea', 'linea']]) {
  $(id).addEventListener('change', (ev) => {
    capas[capa] = ev.target.checked;
    dibujar();
  });
}

// ---------------------------------------------------------------- drawer
const drawer = $('drawer');
function abrirDrawer(abrir) {
  drawer.classList.toggle('abierto', abrir);
  drawer.setAttribute('aria-hidden', String(!abrir));
  $('btn-drawer').setAttribute('aria-expanded', String(abrir));
}
$('btn-drawer').addEventListener('click', () => abrirDrawer(!drawer.classList.contains('abierto')));
$('btn-cerrar').addEventListener('click', () => abrirDrawer(false));
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') abrirDrawer(false);
});

// ---------------------------------------------------------------- dibujo
function leerColores() {
  const cs = getComputedStyle(document.documentElement);
  const c = (n) => cs.getPropertyValue(n).trim();
  colores = {
    fondo: c('--fondo'),
    pinon: c('--pinon'),
    pinonRelleno: c('--pinon-relleno'),
    rueda: c('--rueda'),
    ruedaRelleno: c('--rueda-relleno'),
    auxiliar: c('--auxiliar'),
    linea: c('--linea-engrane'),
  };
}
leerColores();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  leerColores();
  dibujar();
});

function crearCamino(rw) {
  const xy = contornoRueda(rw.flanco, rw.z);
  const p = new Path2D();
  p.moveTo(xy[0], xy[1]);
  for (let i = 2; i < xy.length; i += 2) p.lineTo(xy[i], xy[i + 1]);
  p.closePath();
  // agujero central
  const rAg = Math.min(0.3 * (rw.df / 2), 4 * rw.m);
  p.moveTo(rAg, 0);
  p.arc(0, 0, rAg, 0, 2 * Math.PI);
  return p;
}

function tamano() {
  const dpr = window.devicePixelRatio || 1;
  const w = lienzo.clientWidth;
  const h = lienzo.clientHeight;
  if (lienzo.width !== Math.round(w * dpr) || lienzo.height !== Math.round(h * dpr)) {
    lienzo.width = Math.round(w * dpr);
    lienzo.height = Math.round(h * dpr);
  }
  return { w, h, dpr };
}

function encajarTodo() {
  if (!par) return;
  const { w, h } = tamano();
  const [p, r] = par.ruedas;
  const a = par.entrada.a;
  const ra1 = p.da / 2;
  const ra2 = r.da / 2;
  const ancho = 2 * Math.max(ra1, ra2);
  const yTop = a / 2 + ra1;
  const yBot = -a / 2 - ra2;
  const alto = yTop - yBot;
  const s = 0.92 * Math.min(w / ancho, (h - 60) / alto);
  vista = { s, ox: w / 2, oy: h / 2 + s * ((yTop + yBot) / 2) };
  dibujar();
}

function encajarEngrane() {
  if (!par) return;
  const { w, h } = tamano();
  const yC = par.entrada.a / 2 - par.ruedas[0].dw / 2;
  const s = Math.min(w, h) / (6 * par.entrada.m);
  vista = { s, ox: w / 2, oy: h / 2 + s * yC };
  dibujar();
}

function dibujar() {
  if (pendiente) return;
  pendiente = true;
  requestAnimationFrame(pintar);
}

function pintar(t) {
  pendiente = false;
  const { w, h, dpr } = tamano();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = colores.fondo;
  ctx.fillRect(0, 0, w, h);
  if (!par || !caminos) return;

  if (animando) {
    if (ultimoT) theta += ((t - ultimoT) / 1000) * ((2 * Math.PI) / par.entrada.z1 / 1.5);
    ultimoT = t;
  }

  const { s, ox, oy } = vista;
  const px = 1 / s; // un píxel CSS en mm
  ctx.setTransform(dpr * s, 0, 0, -dpr * s, dpr * ox, dpr * oy);

  const [p, r] = par.ruedas;
  const a = par.entrada.a;
  const z1 = par.entrada.z1;
  const z2 = par.entrada.z2;
  const y1 = a / 2;
  const y2 = -a / 2;
  const rw1 = p.dw / 2;
  const rw2 = r.dw / 2;

  // ruedas: piñón con un diente hacia la rueda; la rueda con un hueco hacia el piñón
  const ang1 = Math.PI + theta;
  const ang2 = Math.PI / z2 - (theta * z1) / z2;
  pintarRueda(caminos[0], 0, y1, ang1, colores.pinon, colores.pinonRelleno, px);
  pintarRueda(caminos[1], 0, y2, ang2, colores.rueda, colores.ruedaRelleno, px);

  ctx.lineWidth = px;
  if (capas.primitivas) {
    ctx.strokeStyle = colores.auxiliar;
    ctx.setLineDash([8 * px, 5 * px]);
    circulo(0, y1, rw1);
    circulo(0, y2, rw2);
  }
  if (capas.base) {
    ctx.strokeStyle = colores.auxiliar;
    ctx.setLineDash([2 * px, 4 * px]);
    circulo(0, y1, p.db / 2);
    circulo(0, y2, r.db / 2);
  }
  ctx.setLineDash([]);

  if (capas.linea) {
    const yC = y1 - rw1;
    const sa = Math.sin(par.alphaW);
    const ca = Math.cos(par.alphaW);
    for (const sx of [1, -1]) {
      const dx = sx * ca;
      const dy = sa;
      const T1 = [dx * rw1 * sa, yC + dy * rw1 * sa];
      const T2 = [-dx * rw2 * sa, yC - dy * rw2 * sa];
      const P = (g) => [T1[0] - g * dx, T1[1] - g * dy];
      ctx.strokeStyle = colores.linea;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = px;
      segmento(T1, T2);
      ctx.globalAlpha = 1;
      ctx.lineWidth = 3 * px;
      segmento(P(par.gA), P(par.gE));
    }
    ctx.fillStyle = colores.linea;
    ctx.beginPath();
    ctx.arc(0, yC, 3.5 * px, 0, 2 * Math.PI);
    ctx.fill();
  }

  // centros
  ctx.strokeStyle = colores.auxiliar;
  ctx.lineWidth = px;
  for (const yc of [y1, y2]) {
    segmento([-8 * px, yc], [8 * px, yc]);
    segmento([0, yc - 8 * px], [0, yc + 8 * px]);
  }

  if (animando) dibujar();
}

function pintarRueda(camino, cx, cy, ang, trazo, relleno, px) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  ctx.fillStyle = relleno;
  ctx.fill(camino, 'evenodd');
  ctx.strokeStyle = trazo;
  ctx.lineWidth = 1.4 * px;
  ctx.lineJoin = 'round';
  ctx.stroke(camino);
  ctx.restore();
}

function circulo(cx, cy, r) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.stroke();
}

function segmento(a, b) {
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

// ---------------------------------------------------------------- navegación
function zoomEn(px, py, factor) {
  const wx = (px - vista.ox) / vista.s;
  const wy = (vista.oy - py) / vista.s;
  const s = Math.min(Math.max(vista.s * factor, 1e-3), 1e5);
  vista = { s, ox: px - wx * s, oy: py + wy * s };
  dibujar();
}

const punteros = new Map();
lienzo.addEventListener('pointerdown', (ev) => {
  lienzo.setPointerCapture(ev.pointerId);
  punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
});
lienzo.addEventListener('pointermove', (ev) => {
  const prev = punteros.get(ev.pointerId);
  if (!prev) return;
  if (punteros.size === 1) {
    vista.ox += ev.clientX - prev.x;
    vista.oy += ev.clientY - prev.y;
    punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    dibujar();
  } else if (punteros.size === 2) {
    const [ida, idb] = [...punteros.keys()];
    const otro = punteros.get(ida === ev.pointerId ? idb : ida);
    const dAntes = Math.hypot(prev.x - otro.x, prev.y - otro.y);
    const mAntes = { x: (prev.x + otro.x) / 2, y: (prev.y + otro.y) / 2 };
    punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    const dAhora = Math.hypot(ev.clientX - otro.x, ev.clientY - otro.y);
    const mAhora = { x: (ev.clientX + otro.x) / 2, y: (ev.clientY + otro.y) / 2 };
    vista.ox += mAhora.x - mAntes.x;
    vista.oy += mAhora.y - mAntes.y;
    if (dAntes > 0) zoomEn(mAhora.x, mAhora.y, dAhora / dAntes);
  }
});
const soltar = (ev) => punteros.delete(ev.pointerId);
lienzo.addEventListener('pointerup', soltar);
lienzo.addEventListener('pointercancel', soltar);
lienzo.addEventListener('wheel', (ev) => {
  ev.preventDefault();
  zoomEn(ev.clientX, ev.clientY, Math.exp(-ev.deltaY * 0.0015));
}, { passive: false });
lienzo.addEventListener('dblclick', encajarTodo);

$('btn-encajar').addEventListener('click', encajarTodo);
$('btn-engrane').addEventListener('click', encajarEngrane);
$('btn-animar').addEventListener('click', () => {
  animando = !animando;
  ultimoT = 0;
  $('btn-animar').textContent = animando ? '⏸' : '▶';
  dibujar();
});

let anterior = { w: lienzo.clientWidth, h: lienzo.clientHeight };
window.addEventListener('resize', () => {
  // mantener el centro de la vista
  const w = lienzo.clientWidth;
  const h = lienzo.clientHeight;
  vista.ox += (w - anterior.w) / 2;
  vista.oy += (h - anterior.h) / 2;
  anterior = { w, h };
  dibujar();
});

recalcular({ encajar: true });
