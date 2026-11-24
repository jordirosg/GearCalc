// Vista de generació: la cremallera ISO 53 tallant el pinyó.
// Sistema fix: centre de la roda a l'origen, línia de rodolament a Y = r (com a geometry.js).
// La roda gira φ en sentit horari i la cremallera avança r·φ.
// La cremallera és periòdica (pas π·m): en cada posició només es dibuixen les dents
// properes a la peça, desplaçades un nombre enter de passos, i així pot fer la volta sencera.
import { contornCremallera, finestraGeneracio } from './geometry.js';

const DURADA_PAUSA = 2; // s amb la peça acabada abans de tornar a començar
const MAX_POSICIONS_TALL = 600; // posicions de l'eina en una volta (límit pel cost de dibuix)

function camiDe(punts, tancar) {
  const p = new Path2D();
  p.moveTo(punts[0][0], punts[0][1]);
  for (let i = 1; i < punts.length; i++) p.lineTo(punts[i][0], punts[i][1]);
  if (tancar) p.closePath();
  return p;
}

function posicionsEntre(a, b, n) {
  return Array.from({ length: n + 1 }, (_, k) => a + ((b - a) * k) / n);
}

/** Prepara els camins i les posicions de l'eina per a una roda. */
export function prepararGeneracio(roda, { pasPosicions = roda.m / 5 } = {}) {
  const r = roda.d / 2;
  const ra = roda.da / 2;
  const rf = roda.df / 2;
  const m = roda.m;
  const pm = Math.PI * m;
  const { phiIni, phiFi } = finestraGeneracio(roda);

  // cremallera visible: cobreix l'amplada de la peça (més un pas pel desplaçament enter)
  const eina = contornCremallera(roda, { dents: Math.ceil((ra + 2 * m) / pm) + 2, nArrodoniment: 8 });
  // cremallera de tall: només les dents que poden tocar la peça
  const W = Math.sqrt(Math.max(0, ra * ra - rf * rf));
  const tall = contornCremallera(roda, { dents: Math.ceil(W / pm) + 2, nArrodoniment: 8 });
  // ventall: les dents més properes al centre (com a la figura clàssica)
  const ventall = contornCremallera(roda, { dents: 1 });

  // ventall fix: la finestra en què la dent central talla el buit superior
  const nVentall = Math.max(2, Math.ceil(((phiFi - phiIni) * r) / pasPosicions));
  const posicions = posicionsEntre(phiIni, phiFi, nVentall);

  // animació: una volta sencera més la finestra, perquè tots els buits quedin acabats
  const phiFiAnim = phiFi + 2 * Math.PI;
  const recorregut = (phiFiAnim - phiIni) * r;
  const nAnim = Math.max(2, Math.ceil(recorregut / Math.max(pasPosicions, recorregut / MAX_POSICIONS_TALL)));
  const posicionsAnim = posicionsEntre(phiIni, phiFiAnim, nAnim);

  const brut = new Path2D();
  brut.arc(0, 0, ra, 0, 2 * Math.PI);
  const rForat = Math.min(0.3 * rf, 4 * m);
  brut.moveTo(rForat, 0);
  brut.arc(0, 0, rForat, 0, 2 * Math.PI);

  return {
    roda,
    r,
    pm,
    phiIni,
    phiFi,
    phiFiAnim,
    posicions,
    posicionsAnim,
    duradaTall: Math.min(30, Math.max(8, 0.5 * roda.z)),
    camiEina: camiDe(eina.tancat, true),
    camiTall: camiDe(tall.tancat, true),
    camiVentall: camiDe(ventall.dents, false),
    camiBrut: brut,
    acumulador: { canvas: null, ctx: null, k: 0, costat: 0, ultim: -1, phi: -Infinity, color: null },
    vCos: eina.tancat[eina.tancat.length - 1][1],
  };
}

/** Angle de rodolament per a un temps d'animació t (s); el cicle es repeteix. */
export function phiAnimacio(g, t) {
  const tc = t % (g.duradaTall + DURADA_PAUSA);
  return g.phiIni + (g.phiFiAnim - g.phiIni) * Math.min(1, tc / g.duradaTall);
}

/** Caixa (en mm) que conté la roda i la cremallera. */
export function caixaGeneracio(g) {
  const ra = g.roda.da / 2;
  const m = g.roda.m;
  return { xMin: -ra - 2 * m, xMax: ra + 2 * m, yMin: -ra, yMax: g.r + g.vCos };
}

// Col·loca l'eina a l'angle φ dins el sistema de coordenades actual (roda o fix).
// L'avanç r·φ es redueix a [−pas/2, pas/2] amb un nombre enter de passos:
// la cremallera és periòdica, així que el resultat és el mateix i les dents queden a la vista.
function desplacamentEina(g, phi) {
  const avanc = g.r * phi;
  return avanc - g.pm * Math.round(avanc / g.pm);
}

function ambEina(ctx, g, phi, accio) {
  ctx.save();
  ctx.translate(desplacamentEina(g, phi), g.r);
  accio();
  ctx.restore();
}

/**
 * Un sol camí amb el ventall de l'eina per a les posicions donades, en el sistema de la roda
 * (molt més ràpid que traçar cada posició per separat).
 */
function camiTraces(g, posicions, maxim = Infinity) {
  const traces = new Path2D();
  const pas = Math.max(1, Math.ceil(posicions.length / maxim));
  for (let i = posicions.length - 1; i >= 0; i -= pas) {
    const ph = posicions[i];
    const mat = new DOMMatrix().rotateSelf((ph * 180) / Math.PI).translateSelf(desplacamentEina(g, ph), g.r);
    traces.addPath(g.camiVentall, mat);
  }
  return traces;
}

const MAX_TEXTURA = 3072; // px de costat de la imatge on s'acumula el tall

/**
 * Peça en brut tallada fins a φ, acumulada en una imatge en el sistema de la roda.
 * Cada fotograma només hi afegeix les posicions noves de l'eina; la imatge es refà
 * si canvia molt el zoom o si l'animació torna a començar.
 */
function actualitzarTall(g, phi, pxPerMm, colors) {
  const acc = g.acumulador;
  const ra = g.roda.da / 2;
  const k = Math.min(pxPerMm, MAX_TEXTURA / (2 * ra));
  const refer = !acc.canvas || phi < acc.phi || k > acc.k * 1.25 || k < acc.k / 1.25 || acc.color !== colors.pinyoBrut;
  if (refer) {
    const costat = Math.max(16, Math.ceil(2 * ra * k));
    acc.canvas = acc.canvas || document.createElement('canvas');
    acc.canvas.width = costat;
    acc.canvas.height = costat;
    acc.ctx = acc.canvas.getContext('2d');
    acc.k = costat / (2 * ra);
    acc.costat = costat;
    acc.ultim = -1;
    acc.color = colors.pinyoBrut;
    const c = acc.ctx;
    c.setTransform(acc.k, 0, 0, -acc.k, costat / 2, costat / 2); // mm, Y amunt, origen al centre
    c.globalCompositeOperation = 'source-over';
    c.clearRect(-ra, -ra, 2 * ra, 2 * ra);
    c.fillStyle = colors.pinyoBrut;
    c.fill(g.camiBrut, 'evenodd');
  }
  const c = acc.ctx;
  c.globalCompositeOperation = 'destination-out';
  c.fillStyle = '#000';
  const pos = g.posicionsAnim;
  let i = acc.ultim + 1;
  for (; i < pos.length && pos[i] <= phi; i++) {
    c.save();
    c.rotate(pos[i]);
    ambEina(c, g, pos[i], () => c.fill(g.camiTall));
    c.restore();
  }
  acc.ultim = i - 1;
  acc.phi = phi;
  return acc;
}

/**
 * Dibuixa la vista de generació. ctx ha de tenir la transformació món (mm, Y amunt).
 * opcions: { animant, phi, px, pxPerMm (píxels de dispositiu per mm), colors, camiRoda,
 *            etiqueta(x, y, text, color, alineacio) }
 */
export function pintarGeneracio(ctx, g, { animant, phi, px, pxPerMm, colors, camiRoda, etiqueta }) {
  if (!animant) {
    // peça acabada amb el ventall de posicions de l'eina (sistema de la roda = fix, φ = 0)
    ctx.fillStyle = colors.pinyoFarciment;
    ctx.fill(camiRoda, 'evenodd');
    ctx.strokeStyle = colors.eina;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = px;
    g.tracesVentall = g.tracesVentall || camiTraces(g, g.posicions);
    ctx.stroke(g.tracesVentall);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = colors.pinyo;
    ctx.lineWidth = 2 * px;
    ctx.stroke(camiRoda);
    pintarEina(ctx, g, 0, colors, px);
  } else {
    // sistema de la roda girat −φ: la peça en brut perd el material que toca l'eina
    const acc = actualitzarTall(g, phi, pxPerMm, colors);
    const S = acc.costat / acc.k; // mm
    ctx.save();
    ctx.rotate(-phi);
    ctx.save();
    ctx.scale(1, -1);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(acc.canvas, -S / 2, -S / 2, S, S);
    ctx.restore();
    // traces de les posicions recents (les que encara estan tallant)
    ctx.strokeStyle = colors.eina;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = px;
    const desDe = phi - (g.phiFi - g.phiIni);
    const recents = g.posicionsAnim.filter((ph) => ph <= phi && ph >= desDe);
    if (recents.length) ctx.stroke(camiTraces(g, recents, 40));
    ctx.globalAlpha = 1;
    // perfil final, com a referència (traç continu i suau: el discontinu és car amb molts punts)
    ctx.strokeStyle = colors.pinyo;
    ctx.lineWidth = px;
    ctx.globalAlpha = 0.45;
    ctx.stroke(camiRoda);
    ctx.globalAlpha = 1;
    ctx.restore();
    pintarEina(ctx, g, phi, colors, px);
  }

  pintarReferencies(ctx, g, px, colors, etiqueta);
}

function pintarEina(ctx, g, phi, colors, px) {
  ambEina(ctx, g, phi, () => {
    ctx.fillStyle = colors.einaFarciment;
    ctx.fill(g.camiEina);
    ctx.strokeStyle = colors.eina;
    ctx.lineWidth = 1.4 * px;
    ctx.lineJoin = 'round';
    ctx.stroke(g.camiEina);
  });
}

function pintarReferencies(ctx, g, px, colors, etiqueta) {
  const { roda, r } = g;
  const m = roda.m;
  const alpha = roda.alpha;
  const rb = roda.db / 2;
  const ra = roda.da / 2;
  const xExt = ra + 2 * m;

  const cercle = (rad, guions) => {
    ctx.setLineDash(guions.map((d) => d * px));
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, 2 * Math.PI);
    ctx.stroke();
  };
  const linia = (x1, y1, x2, y2) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  ctx.lineWidth = px;
  ctx.strokeStyle = colors.auxiliar;
  cercle(r, [12, 4, 2, 4]); // referència d
  cercle(rb, [2, 4]); // base d_b
  ctx.setLineDash([8 * px, 5 * px]);
  linia(-xExt, r, xExt, r); // línia de rodolament
  if (Math.abs(roda.x) > 1e-9) {
    ctx.strokeStyle = colors.eina;
    linia(-xExt, r + roda.x * m, xExt, r + roda.x * m); // línia de referència de la cremallera
  }
  ctx.setLineDash([]);

  // línies d'engranament de la generació i límit de soscavament (d/2)·sin²α
  const yT = r - r * Math.sin(alpha) ** 2;
  const xT = r * Math.sin(alpha) * Math.cos(alpha);
  const ext = 2 * m;
  ctx.strokeStyle = colors.linia;
  for (const sx of [1, -1]) {
    linia(-sx * xT, yT, sx * ext * Math.cos(alpha), r + ext * Math.sin(alpha));
  }
  ctx.setLineDash([3 * px, 3 * px]);
  linia(-xT - m, yT, xT + m, yT);
  ctx.setLineDash([]);
  // cota (d/2)·sin²α
  const xCota = xT + 0.6 * m;
  linia(xCota, yT, xCota, r);

  // eixos del centre
  ctx.strokeStyle = colors.auxiliar;
  linia(-8 * px, 0, 8 * px, 0);
  linia(0, -8 * px, 0, 8 * px);

  if (!etiqueta) return;
  const a45 = Math.PI / 4;
  etiqueta(-r * Math.cos(a45), -r * Math.sin(a45), 'd', colors.auxiliar);
  etiqueta(-rb * Math.cos(a45 + 0.35), -rb * Math.sin(a45 + 0.35), 'd_b', colors.auxiliar);
  etiqueta(-xExt, r, 'línia de rodolament', colors.auxiliar, 'left');
  if (Math.abs(roda.x) > 1e-9) {
    const xm = (roda.x * m).toLocaleString('ca-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    etiqueta(xExt, r + roda.x * m, `x·m = ${xm} mm`, colors.eina, 'right');
  }
  etiqueta(xCota + 0.2 * m, (yT + r) / 2, '(d/2)·sin²α', colors.linia);
  etiqueta(0.3 * m, r + 1.2 * m, 'α', colors.linia);
}
