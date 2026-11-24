// Geometria d'engranatges cilíndrics d'evolvent (dentat recte exterior).
// ISO 21771 (càlcul) / ISO 53:1998 (perfil de referència de la cremallera).
// Funcions pures: sense accés al DOM. Longituds en mm, angles en radiants.

export const ALPHA_P = (20 * Math.PI) / 180; // angle de pressió del perfil de referència

/** Perfils de referència ISO 53:1998, en múltiples del mòdul. */
export const PERFILS = Object.freeze({
  A: Object.freeze({ haP: 1.0, hfP: 1.25, rhoFP: 0.38 }),
  B: Object.freeze({ haP: 1.0, hfP: 1.25, rhoFP: 0.30 }),
  C: Object.freeze({ haP: 1.0, hfP: 1.25, rhoFP: 0.25 }),
  D: Object.freeze({ haP: 1.0, hfP: 1.4, rhoFP: 0.39 }),
});

/** Número amb 3 decimals i coma decimal, per als missatges. */
const dec3 = (v) => v.toFixed(3).replace('.', ',');

export const grausARad = (g) => (g * Math.PI) / 180;
export const radAGraus = (r) => (r * 180) / Math.PI;

/** Funció evolvent: inv α = tan α − α */
export const inv = (a) => Math.tan(a) - a;

/** Gruix de la dent sobre el diàmetre de referència: s = m (π/2 + 2 x tan α) */
export const gruixReferencia = (m, x, alpha = ALPHA_P) =>
  m * (Math.PI / 2 + 2 * x * Math.tan(alpha));

/** Gruix a la base: s_b = m cos α (π/2 + 2 x tan α + z inv α) */
export const gruixBase = (z, m, x, alpha = ALPHA_P) =>
  m * Math.cos(alpha) * (Math.PI / 2 + 2 * x * Math.tan(alpha) + z * inv(alpha));

/** Suma de desplaçaments (x1+x2) que dona joc nul a la distància de funcionament. */
export function sumaDesplacaments(z1, z2, alphaW, alpha = ALPHA_P) {
  return ((inv(alphaW) - inv(alpha)) * (z1 + z2)) / (2 * Math.tan(alpha));
}

/**
 * Reparteix la suma de desplaçaments perquè s_b1 / s_b2 = relacio.
 * s_bi ∝ A_i + 2 x_i tan α, amb A_i = π/2 + z_i inv α.
 */
export function repartirDesplacaments(z1, z2, suma, relacio, alpha = ALPHA_P) {
  const t = Math.tan(alpha);
  const A1 = Math.PI / 2 + z1 * inv(alpha);
  const A2 = Math.PI / 2 + z2 * inv(alpha);
  const x1 = (relacio * A2 + 2 * relacio * t * suma - A1) / (2 * t * (1 + relacio));
  return [x1, suma - x1];
}

/** Relació s_b1 / s_b2 que reparteix la suma de desplaçaments a parts iguals (x1 = x2). */
export function relacioDesplacamentsIguals(z1, z2, suma, alpha = ALPHA_P) {
  const x = suma / 2;
  return gruixBase(z1, 1, x, alpha) / gruixBase(z2, 1, x, alpha); // el mòdul es cancel·la
}

/** Desplaçament mínim sense soscavament per a la cremallera ISO 53 (amb arrodoniment de cap). */
export function desplacamentMinim(z, perfil, alpha = ALPHA_P) {
  const P = PERFILS[perfil];
  return P.hfP - P.rhoFP * (1 - Math.sin(alpha)) - (z * Math.sin(alpha) ** 2) / 2;
}

/**
 * Dades de la cremallera generadora en el seu propi sistema (u, v):
 * u al llarg de la línia de rodolament, v perpendicular (positiu cap enfora de l'engranatge),
 * v = 0 a la línia de rodolament (tangent a la circumferència de referència).
 * El buit de la cremallera (on queda la dent generada) està centrat a u = 0;
 * la dent de la cremallera que talla el buit de l'engranatge està centrada a u = π m / 2.
 */
export function dadesCremallera(m, x, perfil, alpha = ALPHA_P) {
  const P = PERFILS[perfil];
  const hfP = P.hfP * m;
  const rho = P.rhoFP * m;
  const vT = x * m - hfP; // línia de cap de la cremallera (talla el fons)
  const vC = vT + rho; // centre de l'arrodoniment de cap
  const uC = (Math.PI * m) / 4 + (hfP - rho) * Math.tan(alpha) + rho / Math.cos(alpha);
  const vF = vC - rho * Math.sin(alpha); // final del tram recte del flanc
  return { m, x, alpha, hfP, rho, vT, vC, uC, vF };
}

/**
 * Punt del flanc dret de la cremallera (frontera esquerra de la seva dent) en funció de v.
 * Retorna u, o null si v és per sota del cap de la cremallera.
 */
export function fronteraCremallera(v, cr) {
  if (v < cr.vT) return null;
  if (v >= cr.vF) return (Math.PI * cr.m) / 4 + (cr.x * cr.m - v) * Math.tan(cr.alpha);
  const dv = v - cr.vC;
  return cr.uC - Math.sqrt(Math.max(0, cr.rho * cr.rho - dv * dv));
}

/**
 * Punt de la trocoide equidistant que genera l'arrodoniment de cap de la cremallera
 * per a l'angle de rodolament φ (referència analítica; el perfil es talla a generarFlanc).
 * Retorna coordenades polars en el sistema de la roda:
 * R (radi) i beta (angle des de l'eix de la dent, positiu cap al flanc dret).
 */
export function puntTrocoide(phi, r, cr) {
  // Sistema fix: centre de la roda a l'origen, línia de rodolament a Y = r.
  // La roda gira φ (sentit horari) i la cremallera avança r φ.
  const Xc = cr.uC + r * phi;
  const Yc = r + cr.vC;
  const dx = -Xc; // vector cap al pol de rodolament I = (0, r)
  const dy = r - Yc;
  const llarg = Math.hypot(dx, dy);
  let nx = 0;
  let ny = -1;
  if (llarg > 1e-14) {
    nx = dx / llarg;
    ny = dy / llarg;
    // la normal exterior de l'arrodoniment al contacte apunta cap a l'engranatge
    if (ny > 0 || (ny === 0 && nx > 0)) {
      nx = -nx;
      ny = -ny;
    }
  }
  const Qx = Xc + cr.rho * nx;
  const Qy = Yc + cr.rho * ny;
  // al sistema de la roda: girar φ en sentit antihorari
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  const gx = Qx * c - Qy * s;
  const gy = Qx * s + Qy * c;
  return { R: Math.hypot(gx, gy), beta: Math.atan2(gx, gy) };
}

/** Semiangle de gruix de l'evolvent al radi R (R ≥ rb). */
export function semiAngleEvolvent(R, roda) {
  const aR = Math.acos(Math.min(1, roda.db / (2 * R)));
  return roda.s / roda.d + inv(roda.alpha) - inv(aR);
}

/**
 * Contorn d'una dent de l'eina (cremallera ISO 53) en coordenades (u, v):
 * meitat esquerra, des de dalt del flanc fins al centre del cap (u = π m / 2).
 * És la meitat que talla el flanc dret de la dent 0 de l'engranatge.
 */
export function contornEina(roda, { nArrodoniment = 64 } = {}) {
  const { m, x, alpha, perfil } = roda;
  const cr = dadesCremallera(m, x, perfil, alpha);
  const r = roda.d / 2;
  const vTop = roda.da / 2 - r + 0.5 * m; // l'eina sobrepassa el cap de la peça en brut
  const flanc = (v) => (Math.PI * m) / 4 + (x * m - v) * Math.tan(alpha);
  const pts = [[flanc(vTop), vTop]];
  // arrodoniment de cap: normal des de (−cos α, −sin α) fins a (0, −1)
  for (let i = 0; i <= nArrodoniment; i++) {
    const th = Math.PI + alpha + ((Math.PI / 2 - alpha) * i) / nArrodoniment;
    pts.push([cr.uC + cr.rho * Math.cos(th), cr.vC + cr.rho * Math.sin(th)]);
  }
  pts.push([(Math.PI * m) / 2, cr.vT]);
  return { pts, cr, vTop };
}

/**
 * Interval d'angles de rodolament [phiIni, phiFi] en què la dent 0 de l'eina toca
 * la peça en brut (Ø d_a). Fora d'aquest interval l'eina no talla res.
 */
export function finestraGeneracio(roda) {
  const { m, alpha } = roda;
  const r = roda.d / 2;
  const rf = roda.df / 2;
  const ra = roda.da / 2;
  const { cr, vTop } = contornEina(roda, { nArrodoniment: 1 });
  const W = Math.sqrt(Math.max(0, ra * ra - rf * rf));
  const H = W + (Math.PI * m) / 2 + (vTop - cr.vT) * Math.tan(alpha);
  return { phiIni: (-H - (Math.PI * m) / 2) / r, phiFi: (H - (Math.PI * m) / 2) / r };
}

/**
 * Contorn complet de la cremallera (2·dents + 1 dents, centrades a u = π m / 2 + j π m)
 * en coordenades (u, v), tancat pel cos de l'eina. Serveix per dibuixar-la.
 * Retorna { tancat: [[u, v], ...] (polígon), dents: [[u, v], ...] (només el perfil dentat) }.
 */
export function contornCremallera(roda, { dents = 2, nArrodoniment = 16 } = {}) {
  const { pts, vTop } = contornEina(roda, { nArrodoniment });
  const pm = Math.PI * roda.m;
  const perfil = [];
  for (let j = -dents; j <= dents; j++) {
    const c = pm / 2 + j * pm; // centre de la dent j
    for (const [u, v] of pts) perfil.push([u + j * pm, v]);
    for (let i = pts.length - 2; i >= 0; i--) {
      const [u, v] = pts[i];
      perfil.push([2 * c - (u + j * pm), v]);
    }
  }
  const vCos = vTop + 1.5 * roda.m;
  const tancat = [...perfil, [perfil[perfil.length - 1][0], vCos], [perfil[0][0], vCos]];
  return { tancat, dents: perfil };
}

/** Eina col·locada per a l'angle de rodolament φ, en el sistema de la roda. */
export function posicioEina(phi, r, pts) {
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  return pts.map(([u, v]) => {
    const X = u + r * phi;
    const Y = r + v;
    return [X * c - Y * s, X * s + Y * c];
  });
}

/**
 * Talla el flanc dret d'una dent: la cremallera rodola sobre la circumferència de
 * referència (desplaçada x·m) i el perfil és la traça que deixa l'eina sobre la peça en brut
 * (Ø d_a). Per a cada radi R es pren l'angle mínim que assoleix l'eina en totes les seves
 * posicions: el que queda és el material que l'eina no toca mai.
 * Retorna punts {R, beta} de peu a cap (beta des de l'eix de la dent).
 */
export function generarFlanc(roda, { nRadis = 200, pasRodolament = roda.m / 100 } = {}) {
  const { m, alpha } = roda;
  const r = roda.d / 2;
  const rb = roda.db / 2;
  const rf = roda.df / 2;
  const ra = roda.da / 2;
  if (ra <= rf) throw new Error('El diàmetre de cap no supera el de fons.');
  const { pts, cr } = contornEina(roda);

  // graella de radis, més densa a prop del fons
  const Rs = new Float64Array(nRadis + 1);
  for (let i = 0; i <= nRadis; i++) Rs[i] = rf + (ra - rf) * (i / nRadis) ** 2;
  const index = (R) => nRadis * Math.sqrt(Math.max(0, (R - rf) / (ra - rf)));
  const millor = new Float64Array(nRadis + 1).fill(Infinity);

  // recorregut de l'eina mentre toca la peça en brut
  const { phiIni, phiFi } = finestraGeneracio(roda);
  const uIni = phiIni * r;
  const uFi = phiFi * r;
  const nPassos = Math.ceil((uFi - uIni) / pasRodolament);
  const n = pts.length;
  const gx = new Float64Array(n);
  const gy = new Float64Array(n);

  for (let k = 0; k <= nPassos; k++) {
    const phi = (uIni + ((uFi - uIni) * k) / nPassos) / r;
    const c = Math.cos(phi);
    const s = Math.sin(phi);
    for (let j = 0; j < n; j++) {
      const X = pts[j][0] + r * phi;
      const Y = r + pts[j][1];
      gx[j] = X * c - Y * s;
      gy[j] = X * s + Y * c;
    }
    for (let j = 0; j < n - 1; j++) {
      const ax = gx[j];
      const ay = gy[j];
      const dx = gx[j + 1] - ax;
      const dy = gy[j + 1] - ay;
      const a2 = dx * dx + dy * dy;
      const b = ax * dx + ay * dy;
      const A2 = ax * ax + ay * ay;
      const B2 = gx[j + 1] * gx[j + 1] + gy[j + 1] * gy[j + 1];
      const t0 = Math.min(1, Math.max(0, -b / a2));
      const Rmin = Math.hypot(ax + t0 * dx, ay + t0 * dy);
      const Rmax = Math.sqrt(Math.max(A2, B2));
      if (Rmax < rf || Rmin > ra) continue;
      const i0 = Math.max(1, Math.ceil(index(Rmin)));
      const i1 = Math.min(nRadis, Math.floor(index(Rmax)));
      for (let i = i0; i <= i1; i++) {
        const R = Rs[i];
        const disc = b * b - a2 * (A2 - R * R);
        if (disc < 0) continue;
        const arrel = Math.sqrt(disc);
        for (const t of [(-b - arrel) / a2, (-b + arrel) / a2]) {
          if (t < 0 || t > 1) continue;
          const beta = Math.atan2(ax + t * dx, ay + t * dy);
          if (beta < millor[i]) millor[i] = beta;
        }
      }
    }
  }

  const punts = [];
  let soscavaDent = false;
  let punxegut = false;
  for (let i = 1; i <= nRadis; i++) {
    let beta = millor[i];
    if (!Number.isFinite(beta)) continue;
    if (beta <= 0) {
      if (Rs[i] > rb && punts.length) {
        // punta de la dent: interpolar el radi on el gruix s'anul·la
        const p = punts[punts.length - 1];
        const R0 = p.R + ((Rs[i] - p.R) * p.beta) / (p.beta - beta);
        punts.push({ R: R0, beta: 0 });
        punxegut = true;
        break;
      }
      soscavaDent = true;
      beta = 0;
    }
    if (!punts.length) punts.push({ R: rf, beta }); // inici al fons
    punts.push({ R: Rs[i], beta });
  }
  if (punts.length < 3) throw new Error("L'eina no deixa dent.");
  const cim = punts[punts.length - 1];

  // diàmetre de forma del peu (començament de l'evolvent)
  let rForma;
  const L = r * Math.sin(alpha) + cr.vF / Math.sin(alpha);
  if (L >= 0) {
    rForma = Math.hypot(rb, L);
  } else {
    // soscavament: punt més baix on la traça encara coincideix amb l'evolvent
    rForma = cim.R;
    const tol = 2e-3 * m;
    for (let i = punts.length - 1; i >= 0; i--) {
      const p = punts[i];
      if (p.R < rb || p.R * Math.abs(p.beta - semiAngleEvolvent(p.R, roda)) > tol) break;
      rForma = p.R;
    }
  }

  return {
    punts,
    rCap: cim.R,
    betaCap: cim.beta,
    rArrel: rf,
    betaArrel: punts[0].beta,
    rForma,
    punxegut,
    soscavaDent,
  };
}

/**
 * Contorn tancat de la roda completa, dent 0 centrada a +Y.
 * Retorna Float64Array [x0, y0, x1, y1, ...] en mm.
 */
export function contornRoda(flanc, z, { nCap = 6, nFons = 6 } = {}) {
  const pas = (2 * Math.PI) / z;
  const dreta = [];
  for (let i = 0; i <= nCap; i++) dreta.push([flanc.rCap, (flanc.betaCap * i) / nCap]);
  for (let i = flanc.punts.length - 2; i >= 0; i--) {
    const p = flanc.punts[i];
    dreta.push([p.R, p.beta]);
  }
  const bFons = Math.min(flanc.betaArrel, pas / 2);
  for (let i = 1; i <= nFons; i++) {
    dreta.push([flanc.rArrel, bFons + ((pas / 2 - bFons) * i) / nFons]);
  }
  // dent: des de −pas/2 fins a +pas/2
  const dent = [];
  for (let i = dreta.length - 1; i >= 1; i--) dent.push([dreta[i][0], -dreta[i][1]]);
  for (const p of dreta) dent.push(p);

  const perDent = dent.length - 1; // l'últim coincideix amb el primer de la següent
  const sortida = new Float64Array(z * perDent * 2);
  let k = 0;
  for (let j = 0; j < z; j++) {
    const gir = j * pas;
    for (let i = 0; i < perDent; i++) {
      const [R, b] = dent[i];
      sortida[k++] = R * Math.sin(b + gir);
      sortida[k++] = R * Math.cos(b + gir);
    }
  }
  return sortida;
}

function validar({ z1, z2, m, a, perfil, relacio }) {
  const enters = [
    ['z1', z1],
    ['z2', z2],
  ];
  for (const [n, z] of enters) {
    if (!Number.isInteger(z) || z < 5) throw new Error(`${n} ha de ser un enter ≥ 5.`);
  }
  if (!(m > 0)) throw new Error('El mòdul ha de ser positiu.');
  if (!(a > 0)) throw new Error('La distància entre centres ha de ser positiva.');
  if (!PERFILS[perfil]) throw new Error(`Perfil desconegut: ${perfil}`);
  if (!(relacio > 0)) throw new Error('La relació de gruixos ha de ser positiva.');
}

function calcularRoda(z, x, m, alpha, alphaW, k, perfil) {
  const P = PERFILS[perfil];
  const d = z * m;
  const db = d * Math.cos(alpha);
  const da = d + 2 * m * (P.haP + x + k);
  const df = d - 2 * m * (P.hfP - x);
  const s = gruixReferencia(m, x, alpha);
  const sb = db * (s / d + inv(alpha));
  const dw = db / Math.cos(alphaW);
  const sw = dw * (s / d + inv(alpha) - inv(alphaW));
  const alphaA = Math.acos(Math.min(1, db / da));
  const sa = da * (s / d + inv(alpha) - inv(alphaA));
  const xMin = desplacamentMinim(z, perfil, alpha);
  return {
    z, m, x, alpha, perfil, d, db, da, df, dw, s, sb, sw, sa, alphaA, xMin,
    soscavat: x < xMin - 1e-12,
  };
}

/**
 * Càlcul de la parella pinyó/roda.
 * @param {{z1:number,z2:number,m:number,a:number,perfil?:string,relacio?:number,alpha?:number}} p
 *   relacio = s_b1 / s_b2 (gruix a la base pinyó / roda)
 */
export function calcularParella({ z1, z2, m, a, perfil = 'A', relacio = 1, alpha = ALPHA_P }) {
  validar({ z1, z2, m, a, perfil, relacio });
  const a0 = (m * (z1 + z2)) / 2;
  const cosAw = (a0 * Math.cos(alpha)) / a;
  if (cosAw > 1) {
    throw new Error(
      `Distància entre centres massa petita: ha de ser més gran que ${dec3(a0 * Math.cos(alpha))} mm.`,
    );
  }
  const alphaW = Math.acos(cosAw);
  const sumaX = sumaDesplacaments(z1, z2, alphaW, alpha);
  const [x1, x2] = repartirDesplacaments(z1, z2, sumaX, relacio, alpha);
  const k = (a - a0) / m - sumaX; // modificació de l'altura de cap (≤ 0)

  const rodes = [
    calcularRoda(z1, x1, m, alpha, alphaW, k, perfil),
    calcularRoda(z2, x2, m, alpha, alphaW, k, perfil),
  ];
  const avisos = [];
  for (const [i, rw] of rodes.entries()) {
    const nom = i === 0 ? 'Pinyó' : 'Roda';
    try {
      rw.flanc = generarFlanc(rw);
      rw.dNf = 2 * rw.flanc.rForma;
    } catch (e) {
      throw new Error(`${nom}: ${e.message}`);
    }
    if (rw.flanc.soscavaDent) avisos.push({ nivell: 'error', text: `${nom}: el soscavament destrueix la dent.` });
    else if (rw.soscavat) avisos.push({ nivell: 'avis', text: `${nom}: soscavament (x < x_min = ${dec3(rw.xMin)}).` });
    if (rw.flanc.punxegut || rw.sa <= 0) avisos.push({ nivell: 'error', text: `${nom}: dent punxeguda.` });
    else if (rw.sa < 0.2 * m) avisos.push({ nivell: 'avis', text: `${nom}: gruix al cap petit (s_a < 0,2 m).` });
  }

  const [p1, p2] = rodes;
  const rb1 = p1.db / 2;
  const rb2 = p2.db / 2;
  const ra1 = p1.flanc.rCap;
  const ra2 = p2.flanc.rCap;
  const T1T2 = a * Math.sin(alphaW);
  const gE = Math.sqrt(ra1 * ra1 - rb1 * rb1); // final de l'engranament, des de T1
  const gA = T1T2 - Math.sqrt(ra2 * ra2 - rb2 * rb2); // inici de l'engranament, des de T1
  const pb = Math.PI * m * Math.cos(alpha);
  const epsilonAlpha = (gE - gA) / pb;

  // interferència: el contacte no ha de començar per sota del diàmetre de forma
  const dSAP1 = gA >= 0 ? 2 * Math.hypot(rb1, gA) : NaN;
  const gA2 = T1T2 - gE;
  const dSAP2 = gA2 >= 0 ? 2 * Math.hypot(rb2, gA2) : NaN;
  p1.dSAP = dSAP1;
  p2.dSAP = dSAP2;
  if (!(dSAP1 >= p1.dNf - 1e-9)) avisos.push({ nivell: 'error', text: 'Interferència al peu del pinyó.' });
  if (!(dSAP2 >= p2.dNf - 1e-9)) avisos.push({ nivell: 'error', text: 'Interferència al peu de la roda.' });
  if (epsilonAlpha < 1) avisos.push({ nivell: 'error', text: `Grau de recobriment ε_α = ${dec3(epsilonAlpha)} < 1.` });
  else if (epsilonAlpha < 1.1) avisos.push({ nivell: 'avis', text: `Grau de recobriment baix (ε_α = ${dec3(epsilonAlpha)}).` });

  return {
    entrada: { z1, z2, m, a, perfil, relacio, alpha },
    a0,
    alphaW,
    sumaX,
    k,
    rodes,
    gA,
    gE,
    T1T2,
    epsilonAlpha,
    jocFons: [a - ra1 - p2.df / 2, a - ra2 - p1.df / 2],
    // lliscament específic als extrems del segment actiu (peu del pinyó a A, peu de la roda a E);
    // sense sentit si el contacte surt de T1–T2 (interferència)
    zeta1A: gA > 0 ? 1 - ((T1T2 - gA) * z1) / (gA * z2) : NaN,
    zeta2E: gE < T1T2 ? 1 - (gE * z2) / ((T1T2 - gE) * z1) : NaN,
    avisos,
  };
}

/**
 * Línia d'acció activa amb el pinyó girant en sentit antihorari (motor).
 * Sistema de la parella: centre del pinyó O1 = (0, a/2), centre de la roda O2 = (0, −a/2), Y amunt.
 * El contacte avança de T1 cap a T2 amb la velocitat de la circumferència base del pinyó.
 * Retorna T1, T2, el pol C, la direcció unitària dir (de T1 cap a T2) i punt(g) a distància g de T1.
 */
export function liniaAccio(parella) {
  const a = parella.entrada.a;
  const rw1 = parella.rodes[0].dw / 2;
  const rw2 = parella.rodes[1].dw / 2;
  const sa = Math.sin(parella.alphaW);
  const ca = Math.cos(parella.alphaW);
  const C = [0, a / 2 - rw1];
  const dir = [ca, -sa];
  const T1 = [C[0] - rw1 * sa * dir[0], C[1] - rw1 * sa * dir[1]];
  const T2 = [C[0] + rw2 * sa * dir[0], C[1] + rw2 * sa * dir[1]];
  const punt = (g) => [T1[0] + g * dir[0], T1[1] + g * dir[1]];
  return { T1, T2, C, dir, punt };
}

/**
 * Punts de contacte actius per a un gir θ del pinyó (antihorari; a θ = 0 la dent 0 apunta cap a la roda).
 * La involuta de cada flanc motor talla la línia d'acció a g = r_b1 (β_b + α_w + θ + 2πk/z1),
 * on β_b és el semiangle de la dent a la base. Només són contactes els que cauen dins [g_A, g_E].
 * Retorna una llista de distàncies g des de T1 (mm).
 */
export function contactesActius(parella, theta) {
  const p = parella.rodes[0];
  const rb = p.db / 2;
  const pb = (2 * Math.PI * rb) / p.z; // pas base
  const betaB = p.s / p.d + inv(p.alpha);
  const g0 = rb * (betaB + parella.alphaW + theta);
  const { gA, gE } = parella;
  const contactes = [];
  for (let g = g0 + pb * Math.ceil((gA - g0) / pb - 1e-12); g <= gE + 1e-12; g += pb) contactes.push(g);
  return contactes;
}

/**
 * Lliscament específic al llarg del segment d'engranament actiu.
 * g: distància des de T1 sobre la línia d'engranament (mm).
 */
export function lliscamentEspecific(parella, n = 60) {
  const { gA, gE, T1T2 } = parella;
  const { z1, z2 } = parella.entrada;
  const g = [];
  const zeta1 = [];
  const zeta2 = [];
  for (let i = 0; i <= n; i++) {
    const gi = gA + ((gE - gA) * i) / n;
    const rho1 = gi;
    const rho2 = T1T2 - gi;
    g.push(gi);
    zeta1.push(1 - (rho2 * z1) / (rho1 * z2));
    zeta2.push(1 - (rho1 * z2) / (rho2 * z1));
  }
  return { g, zeta1, zeta2, gC: (parella.rodes[0].dw / 2) * Math.sin(parella.alphaW) };
}
