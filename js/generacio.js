// Vista de generació: la cremallera ISO 53 tallant el pinyó.
// Sistema fix: centre de la roda a l'origen, línia de rodolament a Y = r (com a geometry.js).
// La roda gira φ en sentit horari i la cremallera avança r·φ.
import { contornCremallera, finestraGeneracio } from './geometry.js';

const DURADA_TALL = 8; // s que dura el pas de l'eina en l'animació
const DURADA_PAUSA = 1.5; // s amb la peça acabada abans de tornar a començar

function camiDe(punts, tancar) {
  const p = new Path2D();
  p.moveTo(punts[0][0], punts[0][1]);
  for (let i = 1; i < punts.length; i++) p.lineTo(punts[i][0], punts[i][1]);
  if (tancar) p.closePath();
  return p;
}

/** Prepara els camins i les posicions de l'eina per a una roda. */
export function prepararGeneracio(roda, { pasPosicions = roda.m / 5 } = {}) {
  const r = roda.d / 2;
  const ra = roda.da / 2;
  const pm = Math.PI * roda.m;
  const { phiIni, phiFi } = finestraGeneracio(roda);
  const recorregut = Math.max(Math.abs(phiIni), Math.abs(phiFi)) * r;
  // cremallera prou ampla per cobrir la peça durant tot el recorregut
  const dentsEina = Math.ceil((ra + 2 * roda.m + recorregut) / pm) + 1;
  const eina = contornCremallera(roda, { dents: dentsEina });
  // per al ventall, només les dents properes al buit 0 (com a la figura clàssica)
  const ventall = contornCremallera(roda, { dents: 1 });

  const n = Math.max(2, Math.ceil(((phiFi - phiIni) * r) / pasPosicions));
  const posicions = Array.from({ length: n + 1 }, (_, k) => phiIni + ((phiFi - phiIni) * k) / n);

  const brut = new Path2D();
  brut.arc(0, 0, ra, 0, 2 * Math.PI);
  const rForat = Math.min(0.3 * (roda.df / 2), 4 * roda.m);
  brut.moveTo(rForat, 0);
  brut.arc(0, 0, rForat, 0, 2 * Math.PI);

  return {
    roda,
    r,
    phiIni,
    phiFi,
    posicions,
    camiEina: camiDe(eina.tancat, true),
    camiVentall: camiDe(ventall.dents, false),
    camiBrut: brut,
    vCos: eina.tancat[eina.tancat.length - 1][1],
  };
}

/** Angle de rodolament per a un temps d'animació t (s); el cicle es repeteix. */
export function phiAnimacio(g, t) {
  const tc = t % (DURADA_TALL + DURADA_PAUSA);
  return g.phiIni + (g.phiFi - g.phiIni) * Math.min(1, tc / DURADA_TALL);
}

/** Caixa (en mm) que conté la roda i la cremallera. */
export function caixaGeneracio(g) {
  const ra = g.roda.da / 2;
  const m = g.roda.m;
  return { xMin: -ra - 2 * m, xMax: ra + 2 * m, yMin: -ra, yMax: g.r + g.vCos };
}

// col·loca l'eina a l'angle φ dins el sistema de coordenades actual (roda o fix)
function ambEina(ctx, g, phi, accio) {
  ctx.save();
  ctx.translate(g.r * phi, g.r);
  accio();
  ctx.restore();
}

/**
 * Dibuixa la vista de generació. ctx ha de tenir la transformació món (mm, Y amunt).
 * opcions: { animant, phi, px, colors, camiRoda, etiqueta(x, y, text, color) }
 */
export function pintarGeneracio(ctx, g, { animant, phi, px, colors, camiRoda, etiqueta }) {
  const { r } = g;

  if (!animant) {
    // peça acabada amb el ventall de posicions de l'eina (sistema de la roda = fix, φ = 0)
    ctx.fillStyle = colors.pinyoFarciment;
    ctx.fill(camiRoda, 'evenodd');
    ctx.strokeStyle = colors.eina;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = px;
    for (const ph of g.posicions) {
      ctx.save();
      ctx.rotate(ph);
      ambEina(ctx, g, ph, () => ctx.stroke(g.camiVentall));
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = colors.pinyo;
    ctx.lineWidth = 2 * px;
    ctx.stroke(camiRoda);
    pintarEina(ctx, g, 0, colors, px);
  } else {
    // sistema de la roda girat −φ: la peça en brut perd el material que toca l'eina
    ctx.save();
    ctx.rotate(-phi);
    ctx.fillStyle = colors.pinyoBrut;
    ctx.fill(g.camiBrut, 'evenodd');
    ctx.fillStyle = colors.fons;
    for (const ph of g.posicions) {
      if (ph > phi) break;
      ctx.save();
      ctx.rotate(ph);
      ambEina(ctx, g, ph, () => ctx.fill(g.camiEina));
      ctx.restore();
    }
    ctx.save();
    ctx.rotate(phi);
    ambEina(ctx, g, phi, () => ctx.fill(g.camiEina));
    ctx.restore();
    // traces de les posicions ja passades
    ctx.strokeStyle = colors.eina;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = px;
    for (const ph of g.posicions) {
      if (ph > phi) break;
      ctx.save();
      ctx.rotate(ph);
      ambEina(ctx, g, ph, () => ctx.stroke(g.camiVentall));
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // perfil final, com a referència
    ctx.strokeStyle = colors.pinyo;
    ctx.lineWidth = px;
    ctx.setLineDash([4 * px, 3 * px]);
    ctx.stroke(camiRoda);
    ctx.setLineDash([]);
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
