// Interfície: calaix d'entrada, llenç a pantalla completa (pinyó a dalt, roda a baix).
import {
  calcularParella, contornRoda, lliscamentEspecific, radAGraus, relacioDesplacamentsIguals, liniaAccio, contactesActius,
} from './geometry.js';
import { crearGraficLliscament, actualitzarGraficLliscament } from './charts.js';
import { prepararGeneracio, pintarGeneracio, phiAnimacio, avancarAnimacio, caixaGeneracio } from './generacio.js';

const $ = (id) => document.getElementById(id);
const CLAU = 'gearcalc.v2';
const PER_DEFECTE = { z1: 17, z2: 40, m: 2, a: 58, perfil: 'A', relacioLog: 0, velocitatLog: -2 };

const fmt = (dec) => new Intl.NumberFormat('ca-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const f3 = fmt(3).format;
const f4 = fmt(4).format;
const fZeta = (v) => (Number.isFinite(v) ? fmt(3).format(v) : '—'); // '—' si hi ha interferència

// ---------------------------------------------------------------- estat
let dades = { ...PER_DEFECTE };
try {
  const desat = JSON.parse(localStorage.getItem(CLAU) || 'null');
  if (desat && typeof desat === 'object') dades = { ...dades, ...desat };
} catch { /* emmagatzematge no disponible */ }

let parella = null; // últim càlcul vàlid
let camins = null; // Path2D del pinyó i de la roda
let vista = { s: 1, ox: 0, oy: 0 };
let vistaAutomatica = true; // la vista és l'encaix automàtic (l'usuari no ha fet zoom ni l'ha moguda)
let theta = 0; // gir del pinyó (rad)
let mode = 'engranament'; // 'engranament' | 'generacio'
let generacions = null; // dades preparades per a la vista de generació [pinyó, roda]
let rodaGeneracio = 0; // 0 = pinyó, 1 = roda
const animGeneracio = { progres: 0, pausa: 0 }; // estat de l'animació de generació
let animant = false;
let darrerT = 0;
let pendent = false;
let colors = {};
const capes = { primitives: true, base: true, linia: false };

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

/**
 * Col·loca el lliscador a log2(s_b1 / s_b2) = v. Si v surt del rang (±1, és a dir 0,5–2),
 * l'amplia perquè el valor es pugui representar, i actualitza les etiquetes dels extrems.
 */
function posarRelacioLog(v) {
  if (!Number.isFinite(v)) v = 0;
  const el = entrades.relacio;
  const limit = Math.max(1, Math.ceil(Math.abs(v) * 10) / 10);
  el.min = String(-limit);
  el.max = String(limit);
  el.value = String(v);
  $('relacio-min').textContent = f3(2 ** -limit).replace(/0+$/, '').replace(/,$/, '');
  $('relacio-max').textContent = f3(2 ** limit).replace(/0+$/, '').replace(/,$/, '');
}
posarRelacioLog(dades.relacioLog);

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
    velocitatLog: Number($('velocitat').value),
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
    generacions = parella.rodes.map((rw) => prepararGeneracio(rw));
    pintarResultats();
    actualitzarGraficLliscament(grafic, lliscamentEspecific(parella));
    $('extrems-lliscament').textContent =
      `ζ₁ a A = ${fZeta(parella.zeta1A)} · ζ₂ a E = ${fZeta(parella.zeta2E)}`;
    mostrarEstatParella();
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

function mostrarEstatParella() {
  if (!parella) return;
  const [p1, p2] = parella.rodes;
  if (mode === 'generacio') {
    const [nom, w, i] = rodaGeneracio === 0 ? ['del pinyó', p1, '₁'] : ['de la roda', p2, '₂'];
    mostrarEstat(`Generació ${nom} · z${i} = ${w.z} · x${i} = ${f4(w.x)} · perfil ${parella.entrada.perfil}`);
  } else {
    mostrarEstat(`x₁ = ${f4(p1.x)} · x₂ = ${f4(p2.x)} · α_w = ${f3(radAGraus(parella.alphaW))}° · ε_α = ${f3(parella.epsilonAlpha)}`);
  }
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
    ['a₀ (mm)', f3(parella.a0), AJUDA.a0],
    ['α_w (°)', f3(radAGraus(parella.alphaW)), AJUDA.alphaW],
    ['x₁ + x₂', f4(parella.sumaX), AJUDA.sumaX],
    ['k · m (mm)', f4(parella.k * parella.entrada.m), AJUDA.k],
    ['ε_α', f3(parella.epsilonAlpha), AJUDA.epsilonAlpha],
    ['Joc de fons c (mm)', f3(parella.jocFons[0]), AJUDA.jocFons],
    ['ζ₁ a A (peu del pinyó)', fZeta(parella.zeta1A), AJUDA.zeta1A],
    ['ζ₂ a E (peu de la roda)', fZeta(parella.zeta2E), AJUDA.zeta2E],
  ];
  $('taula-parella').innerHTML = filesParella
    .map(([n, v, ajuda]) => `<tr><td>${etiqueta(n, ajuda)}</td><td>${v}</td></tr>`)
    .join('');

  const [p, r] = parella.rodes;
  const files = [
    ['z', (w) => String(w.z), AJUDA.z],
    ['x', (w) => f4(w.x), AJUDA.x],
    ['x_min (soscavament)', (w) => f4(w.xMin), AJUDA.xMin],
    ['d (mm)', (w) => f3(w.d), AJUDA.d],
    ['d_b (mm)', (w) => f3(w.db), AJUDA.db],
    ['d_w (mm)', (w) => f3(w.dw), AJUDA.dw],
    ['d_a (mm)', (w) => f3(w.da), AJUDA.da],
    ['d_f (mm)', (w) => f3(w.df), AJUDA.df],
    ['d_Nf forma (mm)', (w) => f3(w.dNf), AJUDA.dNf],
    ['d inici contacte (mm)', (w) => (Number.isFinite(w.dSAP) ? f3(w.dSAP) : '—'), AJUDA.dSAP],
    ['s (mm)', (w) => f3(w.s), AJUDA.s],
    ['s_b (mm)', (w) => f3(w.sb), AJUDA.sb],
    ['s_w (mm)', (w) => f3(w.sw), AJUDA.sw],
    ['s_a (mm)', (w) => f3(w.sa), AJUDA.sa],
  ];
  $('taula-rodes').innerHTML =
    '<thead><tr><th></th><th class="pinyo">Pinyó</th><th class="roda">Roda</th></tr></thead><tbody>' +
    files.map(([n, fn, ajuda]) => `<tr><td>${etiqueta(n, ajuda)}</td><td>${fn(p)}</td><td>${fn(r)}</td></tr>`).join('') +
    '</tbody>';
}

// ---------------------------------------------------------------- ajuda de les taules
const AJUDA = {
  a0: 'Distància entre centres sense desplaçament: a₀ = m (z₁ + z₂) / 2.',
  alphaW: "Angle de pressió de funcionament. Surt de la distància entre centres: cos α_w = a₀ cos α / a. Amb a = a₀ val 20°.",
  sumaX: 'Suma de desplaçaments que dona joc nul a la distància entre centres a. Fixada per a; el lliscador només la reparteix entre pinyó i roda.',
  k: "Escurçament de cap (k · m ≤ 0). Retalla el diàmetre de cap perquè el joc de fons continuï valent c_P quan a ≠ a₀.",
  epsilonAlpha: "Grau de recobriment: nombre mitjà de parells de dents en contacte. Ha de ser > 1; recomanable ≥ 1,1–1,2.",
  jocFons: "Separació radial entre el cap d'una roda i el fons de l'altra. Ha de coincidir amb c_P de la cremallera (0,25 m; 0,40 m al perfil D).",
  zeta1A: "Lliscament específic del pinyó a l'inici del contacte (A), al seu peu: el valor més desfavorable del pinyó. Convé que |ζ₁ a A| i |ζ₂ a E| siguin semblants; es reparteixen amb el lliscador s_b1 / s_b2.",
  zeta2E: "Lliscament específic de la roda al final del contacte (E), al seu peu: el valor més desfavorable de la roda. Si |ζ₁ a A| és més gran, dona més desplaçament al pinyó (x₁ més gran).",
  z: 'Nombre de dents.',
  x: "Coeficient de desplaçament del perfil: quant s'aparta la cremallera en tallar, en múltiples de m. Positiu = cap enfora: dent més gruixuda al peu i més punxeguda al cap.",
  xMin: "Desplaçament mínim perquè el cap arrodonit de la cremallera no soscavi el peu de la dent. Si x < x_min, hi ha soscavament.",
  d: 'Diàmetre de referència, d = z · m. És la circumferència sobre la qual rodola la cremallera en tallar.',
  db: "Diàmetre base, d_b = d · cos 20°. L'evolvent neix en aquesta circumferència; per sota no hi pot haver evolvent.",
  dw: 'Diàmetre primitiu de funcionament: les circumferències que rodolen sense lliscar en engranar. d_w1 / 2 + d_w2 / 2 = a.',
  da: "Diàmetre de cap (exterior). Inclou l'escurçament de cap k · m.",
  df: "Diàmetre de fons (peu), on arriba el cap de la cremallera: d_f = d − 2 (h_fP − x · m).",
  dNf: "Diàmetre de forma del peu: on comença l'evolvent. Per sota hi ha l'acord deixat per l'arrodoniment de la cremallera.",
  dSAP: "Diàmetre on comença el contacte amb l'altra roda (SAP), determinat pel cap de la roda conjugada. Ha de ser ≥ d_Nf; si no, hi ha interferència.",
  s: 'Gruix de la dent, mesurat en arc, sobre el diàmetre de referència d.',
  sb: 'Gruix de la dent sobre la circumferència base. La seva relació entre pinyó i roda és la que fixa el lliscador s_b1 / s_b2.',
  sw: 'Gruix sobre el diàmetre primitiu de funcionament. Amb joc nul, s_w1 + s_w2 = pas de funcionament (π · d_w / z).',
  sa: "Gruix de la dent al cap (sobre d_a). Es recomana s_a ≥ 0,2 · m (avís); si s'anul·la, la dent és punxeguda.",
};

const escapar = (t) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Etiqueta de fila amb tooltip: hover en ordinador, toc (focus) en mòbil. */
function etiqueta(nom, ajuda) {
  if (!ajuda) return nom;
  return `<span class="etiqueta" tabindex="0" data-ajuda="${escapar(ajuda)}" aria-label="${escapar(`${nom}: ${ajuda}`)}">${nom}</span>`;
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
  posarRelacioLog(0);
  recalcular();
});
$('btn-x-iguals').addEventListener('click', () => {
  if (!parella) return;
  const { z1, z2, alpha } = parella.entrada;
  posarRelacioLog(Math.log2(relacioDesplacamentsIguals(z1, z2, parella.sumaX, alpha)));
  recalcular();
});

for (const [id, capa] of [['veure-primitives', 'primitives'], ['veure-base', 'base'], ['veure-linia', 'linia']]) {
  $(id).addEventListener('change', (ev) => {
    capes[capa] = ev.target.checked;
    dibuixar();
  });
}

// ---------------------------------------------------------------- calaix
// bloc Resultats plegable; l'estat es recorda en aquest navegador
const CLAU_UI = 'gearcalc.ui';
try {
  const ui = JSON.parse(localStorage.getItem(CLAU_UI) || '{}');
  if (ui.resultatsOberts === false) $('bloc-resultats').open = false;
} catch { /* emmagatzematge no disponible */ }
$('bloc-resultats').addEventListener('toggle', () => {
  try {
    localStorage.setItem(CLAU_UI, JSON.stringify({ resultatsOberts: $('bloc-resultats').open }));
  } catch { /* sense emmagatzematge */ }
});
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
    eina: c('--eina'),
    einaFarciment: c('--eina-farciment'),
    pinyoBrut: c('--pinyo-brut'),
    rodaBrut: c('--roda-brut'),
    contacte: c('--contacte'),
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

function encaixarCaixa({ xMin, xMax, yMin, yMax }) {
  const { w, h } = mida();
  const s = 0.92 * Math.min(w / (xMax - xMin), (h - 60) / (yMax - yMin));
  vista = { s, ox: w / 2 - s * ((xMin + xMax) / 2), oy: h / 2 + s * ((yMin + yMax) / 2) };
  vistaAutomatica = true;
  dibuixar();
}

function encaixarTot() {
  if (!parella) return;
  if (mode === 'generacio') {
    encaixarCaixa(caixaGeneracio(generacions[rodaGeneracio]));
    return;
  }
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
  vistaAutomatica = true;
  dibuixar();
}

function encaixarEngranament() {
  if (!parella) return;
  const { w, h } = mida();
  if (mode === 'generacio') {
    // buit tallat per la dent 0 de l'eina, al voltant de la línia de rodolament
    const { m } = parella.entrada;
    const r = generacions[rodaGeneracio].r;
    const s = Math.min(w, h) / (7 * m);
    vista = { s, ox: w / 2, oy: h / 2 + s * (r - 0.5 * m) };
    vistaAutomatica = false;
    dibuixar();
    return;
  }
  const yC = parella.entrada.a / 2 - parella.rodes[0].dw / 2;
  const s = Math.min(w, h) / (6 * parella.entrada.m);
  vista = { s, ox: w / 2, oy: h / 2 + s * yC };
  vistaAutomatica = false;
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

  const dt = animant && darrerT ? (t - darrerT) / 1000 : 0;
  darrerT = animant ? t : 0;

  const { s, ox, oy } = vista;
  const px = 1 / s; // un píxel CSS en mm
  ctx.setTransform(dpr * s, 0, 0, -dpr * s, dpr * ox, dpr * oy);

  if (mode === 'generacio') {
    const g = generacions[rodaGeneracio];
    avancarAnimacio(g, animGeneracio, dt, velocitat());
    const esPinyo = rodaGeneracio === 0;
    pintarGeneracio(ctx, g, {
      animant,
      phi: phiAnimacio(g, animGeneracio.progres),
      px,
      pxPerMm: s * dpr,
      colors: {
        ...colors,
        peca: esPinyo ? colors.pinyo : colors.roda,
        pecaFarciment: esPinyo ? colors.pinyoFarciment : colors.rodaFarciment,
        pecaBrut: esPinyo ? colors.pinyoBrut : colors.rodaBrut,
      },
      camiRoda: camins[rodaGeneracio],
      etiqueta: (x, y, text, color, alineacio = 'left') => {
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = color;
        ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = alineacio;
        ctx.textBaseline = 'bottom';
        ctx.fillText(text, ox + s * x, oy - s * y - 3);
        ctx.restore();
      },
    });
    if (animant) dibuixar();
    return;
  }

  theta += dt * velocitat() * ((2 * Math.PI) / parella.entrada.z1 / 1.5);

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

  // línia d'acció: només la activa, el pinyó gira en sentit antihorari i és el motor
  const la = liniaAccio(parella);
  if (capes.linia) {
    ctx.strokeStyle = colors.linia;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = px;
    segment(la.T1, la.T2);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.8 * px;
    segment(la.punt(parella.gA), la.punt(parella.gE));
    ctx.fillStyle = colors.linia;
    ctx.beginPath();
    ctx.arc(la.C[0], la.C[1], 3.5 * px, 0, 2 * Math.PI);
    ctx.fill();
  }

  // punts de contacte sobre el flanc del pinyó: apareixen a A i desapareixen a E
  ctx.fillStyle = colors.contacte;
  ctx.strokeStyle = colors.fons;
  ctx.lineWidth = 1.5 * px;
  for (const g of contactesActius(parella, theta)) {
    const [x, y] = la.punt(g);
    ctx.beginPath();
    ctx.arc(x, y, 4.5 * px, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
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
  vistaAutomatica = false;
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
    vistaAutomatica = false;
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
  $('control-velocitat').hidden = !animant;
  dibuixar();
});

// ---------------------------------------------------------------- velocitat de l'animació
// lliscador logarítmic: log2 del factor, de ×0,05 a ×2
const velocitat = () => 2 ** Number($('velocitat').value);
function mostrarVelocitat() {
  $('velocitat-valor').textContent = `×${fmt(2).format(velocitat())}`;
}
$('velocitat').value = String(Number.isFinite(dades.velocitatLog) ? dades.velocitatLog : PER_DEFECTE.velocitatLog);
mostrarVelocitat();
$('velocitat').addEventListener('input', () => {
  mostrarVelocitat();
  dades.velocitatLog = Number($('velocitat').value);
  desar();
});
$('btn-velocitat-1').addEventListener('click', () => {
  $('velocitat').value = '0';
  $('velocitat').dispatchEvent(new Event('input'));
});
$('btn-generacio').addEventListener('click', () => {
  mode = mode === 'generacio' ? 'engranament' : 'generacio';
  animGeneracio.progres = 0;
  animGeneracio.pausa = 0;
  const actiu = mode === 'generacio';
  $('btn-generacio').setAttribute('aria-pressed', String(actiu));
  $('btn-engranament').title = actiu ? 'Ampliar el buit tallat' : "Ampliar la zona d'engranament";
  $('selector-generacio').hidden = !actiu;
  mostrarEstatParella();
  encaixarTot();
});

// selector de la roda a generar (visible només a la vista de generació)
for (const boto of document.querySelectorAll('#selector-generacio button')) {
  boto.addEventListener('click', () => {
    const rAnterior = generacions ? generacions[rodaGeneracio].r : 0;
    rodaGeneracio = Number(boto.dataset.roda);
    for (const b of document.querySelectorAll('#selector-generacio button')) {
      b.setAttribute('aria-pressed', String(b === boto));
    }
    animGeneracio.progres = 0;
    animGeneracio.pausa = 0;
    mostrarEstatParella();
    if (vistaAutomatica || !generacions) {
      encaixarTot();
    } else {
      // mateix zoom; la zona de tall (dalt de la línia de rodolament, Y = r) queda al mateix lloc
      vista.oy += vista.s * (generacions[rodaGeneracio].r - rAnterior);
      dibuixar();
    }
  });
}

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
