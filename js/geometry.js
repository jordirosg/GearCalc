// Geometría de engranajes cilíndricos de evolvente (dentado recto exterior).
// ISO 21771 (cálculo) / ISO 53:1998 (perfil de referencia de la cremallera).
// Funciones puras: sin acceso al DOM. Longitudes en mm, ángulos en radianes.

export const ALPHA_P = (20 * Math.PI) / 180; // ángulo de presión del perfil de referencia

/** Perfiles de referencia ISO 53:1998, en múltiplos del módulo. */
export const PERFILES = Object.freeze({
  A: Object.freeze({ haP: 1.0, hfP: 1.25, rhoFP: 0.38 }),
  B: Object.freeze({ haP: 1.0, hfP: 1.25, rhoFP: 0.30 }),
  C: Object.freeze({ haP: 1.0, hfP: 1.25, rhoFP: 0.25 }),
  D: Object.freeze({ haP: 1.0, hfP: 1.4, rhoFP: 0.39 }),
});

export const gradosARad = (g) => (g * Math.PI) / 180;
export const radAGrados = (r) => (r * 180) / Math.PI;

/** Función evolvente: inv α = tan α − α */
export const inv = (a) => Math.tan(a) - a;

/** Espesor del diente sobre el diámetro de referencia: s = m (π/2 + 2 x tan α) */
export const espesorReferencia = (m, x, alpha = ALPHA_P) =>
  m * (Math.PI / 2 + 2 * x * Math.tan(alpha));

/** Espesor en la base: s_b = m cos α (π/2 + 2 x tan α + z inv α) */
export const espesorBase = (z, m, x, alpha = ALPHA_P) =>
  m * Math.cos(alpha) * (Math.PI / 2 + 2 * x * Math.tan(alpha) + z * inv(alpha));

/** Suma de desplazamientos (x1+x2) que da juego nulo a la distancia de funcionamiento. */
export function sumaDesplazamientos(z1, z2, alphaW, alpha = ALPHA_P) {
  return ((inv(alphaW) - inv(alpha)) * (z1 + z2)) / (2 * Math.tan(alpha));
}

/**
 * Reparte la suma de desplazamientos para que s_b1 / s_b2 = relacion.
 * s_bi ∝ A_i + 2 x_i tan α, con A_i = π/2 + z_i inv α.
 */
export function repartirDesplazamientos(z1, z2, suma, relacion, alpha = ALPHA_P) {
  const t = Math.tan(alpha);
  const A1 = Math.PI / 2 + z1 * inv(alpha);
  const A2 = Math.PI / 2 + z2 * inv(alpha);
  const x1 = (relacion * A2 + 2 * relacion * t * suma - A1) / (2 * t * (1 + relacion));
  return [x1, suma - x1];
}

/** Desplazamiento mínimo sin socavado para la cremallera ISO 53 (con redondeo de cabeza). */
export function desplazamientoMinimo(z, perfil, alpha = ALPHA_P) {
  const P = PERFILES[perfil];
  return P.hfP - P.rhoFP * (1 - Math.sin(alpha)) - (z * Math.sin(alpha) ** 2) / 2;
}

/**
 * Datos de la cremallera generadora en su propio sistema (u, v):
 * u a lo largo de la línea de rodadura, v perpendicular (positivo hacia fuera del engranaje),
 * v = 0 en la línea de rodadura (tangente a la circunferencia de referencia).
 * El hueco de la cremallera (donde queda el diente generado) está centrado en u = 0;
 * el diente de la cremallera que talla el hueco del engranaje está centrado en u = π m / 2.
 */
export function datosCremallera(m, x, perfil, alpha = ALPHA_P) {
  const P = PERFILES[perfil];
  const hfP = P.hfP * m;
  const rho = P.rhoFP * m;
  const vT = x * m - hfP; // línea de cabeza de la cremallera (talla el fondo)
  const vC = vT + rho; // centro del redondeo de cabeza
  const uC = (Math.PI * m) / 4 + (hfP - rho) * Math.tan(alpha) + rho / Math.cos(alpha);
  const vF = vC - rho * Math.sin(alpha); // final del tramo recto del flanco
  return { m, x, alpha, hfP, rho, vT, vC, uC, vF };
}

/**
 * Punto del flanco derecho de la cremallera (frontera izquierda de su diente) en función de v.
 * Devuelve u, o null si v está por debajo de la cabeza de la cremallera.
 */
export function fronteraCremallera(v, cr) {
  if (v < cr.vT) return null;
  if (v >= cr.vF) return (Math.PI * cr.m) / 4 + (cr.x * cr.m - v) * Math.tan(cr.alpha);
  const dv = v - cr.vC;
  return cr.uC - Math.sqrt(Math.max(0, cr.rho * cr.rho - dv * dv));
}

/**
 * Punto del perfil generado por el redondeo de cabeza de la cremallera (trocoide equidistante)
 * para el ángulo de rodadura φ. Devuelve coordenadas polares en el sistema de la rueda:
 * R (radio) y beta (ángulo desde el eje del diente, positivo hacia el flanco derecho).
 */
export function puntoTrocoide(phi, r, cr) {
  // Sistema fijo: centro de la rueda en el origen, línea de rodadura en Y = r.
  // La rueda gira φ (horario) y la cremallera avanza r φ.
  const Xc = cr.uC + r * phi;
  const Yc = r + cr.vC;
  const dx = -Xc; // vector hacia el polo de rodadura I = (0, r)
  const dy = r - Yc;
  const len = Math.hypot(dx, dy);
  let nx = 0;
  let ny = -1;
  if (len > 1e-14) {
    nx = dx / len;
    ny = dy / len;
    // la normal exterior del redondeo en el contacto apunta hacia el engranaje
    if (ny > 0 || (ny === 0 && nx > 0)) {
      nx = -nx;
      ny = -ny;
    }
  }
  const Qx = Xc + cr.rho * nx;
  const Qy = Yc + cr.rho * ny;
  // al sistema de la rueda: girar φ en sentido antihorario
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  const gx = Qx * c - Qy * s;
  const gy = Qx * s + Qy * c;
  return { R: Math.hypot(gx, gy), beta: Math.atan2(gx, gy) };
}

/** Semiángulo de espesor de la evolvente en el radio R (R ≥ rb). */
export function semiAnguloEvolvente(R, rueda) {
  const aR = Math.acos(Math.min(1, rueda.db / (2 * R)));
  return rueda.s / rueda.d + inv(rueda.alpha) - inv(aR);
}

/**
 * Contorno de un diente de la herramienta (cremallera ISO 53) en coordenadas (u, v):
 * mitad izquierda, desde arriba del flanco hasta el centro de la cabeza (u = π m / 2).
 * Es la mitad que talla el flanco derecho del diente 0 del engranaje.
 */
export function contornoHerramienta(rueda, { nRedondeo = 64 } = {}) {
  const { m, x, alpha, perfil } = rueda;
  const cr = datosCremallera(m, x, perfil, alpha);
  const r = rueda.d / 2;
  const vTop = rueda.da / 2 - r + 0.5 * m; // la herramienta sobrepasa la cabeza del bruto
  const flanco = (v) => (Math.PI * m) / 4 + (x * m - v) * Math.tan(alpha);
  const pts = [[flanco(vTop), vTop]];
  // redondeo de cabeza: normal desde (−cos α, −sin α) hasta (0, −1)
  for (let i = 0; i <= nRedondeo; i++) {
    const th = Math.PI + alpha + ((Math.PI / 2 - alpha) * i) / nRedondeo;
    pts.push([cr.uC + cr.rho * Math.cos(th), cr.vC + cr.rho * Math.sin(th)]);
  }
  pts.push([(Math.PI * m) / 2, cr.vT]);
  return { pts, cr, vTop };
}

/** Herramienta colocada para el ángulo de rodadura φ, en el sistema de la rueda. */
export function posicionHerramienta(phi, r, pts) {
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  return pts.map(([u, v]) => {
    const X = u + r * phi;
    const Y = r + v;
    return [X * c - Y * s, X * s + Y * c];
  });
}

/**
 * Talla el flanco derecho de un diente: la cremallera rueda sobre la circunferencia de
 * referencia (desplazada x·m) y el perfil es la traza que deja la herramienta sobre el bruto
 * (Ø d_a). Para cada radio R se toma el ángulo mínimo alcanzado por la herramienta en todas
 * sus posiciones: lo que queda es el material que la herramienta nunca toca.
 * Devuelve puntos {R, beta} de pie a cabeza (beta desde el eje del diente).
 */
export function generarFlanco(rueda, { nRadios = 200, pasoRodadura = rueda.m / 100 } = {}) {
  const { m, alpha } = rueda;
  const r = rueda.d / 2;
  const rb = rueda.db / 2;
  const rf = rueda.df / 2;
  const ra = rueda.da / 2;
  if (ra <= rf) throw new Error('El diámetro de cabeza no supera al de fondo.');
  const { pts, cr, vTop } = contornoHerramienta(rueda);

  // rejilla de radios, más densa junto al fondo
  const Rs = new Float64Array(nRadios + 1);
  for (let i = 0; i <= nRadios; i++) Rs[i] = rf + (ra - rf) * (i / nRadios) ** 2;
  const indice = (R) => nRadios * Math.sqrt(Math.max(0, (R - rf) / (ra - rf)));
  const mejor = new Float64Array(nRadios + 1).fill(Infinity);

  // recorrido de la herramienta mientras toca el bruto
  const W = Math.sqrt(ra * ra - rf * rf);
  const H = W + (Math.PI * m) / 2 + (vTop - cr.vT) * Math.tan(alpha);
  const uIni = -H - (Math.PI * m) / 2;
  const uFin = H - (Math.PI * m) / 2;
  const nPasos = Math.ceil((uFin - uIni) / pasoRodadura);
  const n = pts.length;
  const gx = new Float64Array(n);
  const gy = new Float64Array(n);

  for (let k = 0; k <= nPasos; k++) {
    const phi = (uIni + ((uFin - uIni) * k) / nPasos) / r;
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
      const i0 = Math.max(1, Math.ceil(indice(Rmin)));
      const i1 = Math.min(nRadios, Math.floor(indice(Rmax)));
      for (let i = i0; i <= i1; i++) {
        const R = Rs[i];
        const disc = b * b - a2 * (A2 - R * R);
        if (disc < 0) continue;
        const sq = Math.sqrt(disc);
        for (const t of [(-b - sq) / a2, (-b + sq) / a2]) {
          if (t < 0 || t > 1) continue;
          const beta = Math.atan2(ax + t * dx, ay + t * dy);
          if (beta < mejor[i]) mejor[i] = beta;
        }
      }
    }
  }

  const puntos = [];
  let socavaDiente = false;
  let puntiagudo = false;
  for (let i = 1; i <= nRadios; i++) {
    let beta = mejor[i];
    if (!Number.isFinite(beta)) continue;
    if (beta <= 0) {
      if (Rs[i] > rb && puntos.length) {
        // punta del diente: interpolar el radio donde el espesor se anula
        const p = puntos[puntos.length - 1];
        const R0 = p.R + ((Rs[i] - p.R) * p.beta) / (p.beta - beta);
        puntos.push({ R: R0, beta: 0 });
        puntiagudo = true;
        break;
      }
      socavaDiente = true;
      beta = 0;
    }
    if (!puntos.length) puntos.push({ R: rf, beta }); // arranque en el fondo
    puntos.push({ R: Rs[i], beta });
  }
  if (puntos.length < 3) throw new Error('La herramienta no deja diente.');
  const top = puntos[puntos.length - 1];

  // diámetro de forma del pie (comienzo de la evolvente)
  let rForma;
  const L = r * Math.sin(alpha) + cr.vF / Math.sin(alpha);
  if (L >= 0) {
    rForma = Math.hypot(rb, L);
  } else {
    // socavado: punto más bajo en que la traza sigue coincidiendo con la evolvente
    rForma = top.R;
    const tol = 2e-3 * m;
    for (let i = puntos.length - 1; i >= 0; i--) {
      const p = puntos[i];
      if (p.R < rb || p.R * Math.abs(p.beta - semiAnguloEvolvente(p.R, rueda)) > tol) break;
      rForma = p.R;
    }
  }

  return {
    puntos,
    rTop: top.R,
    betaTop: top.beta,
    rRaiz: rf,
    betaRaiz: puntos[0].beta,
    rForma,
    puntiagudo,
    socavaDiente,
  };
}

/**
 * Contorno cerrado de la rueda completa, diente 0 centrado en +Y.
 * Devuelve Float64Array [x0, y0, x1, y1, ...] en mm.
 */
export function contornoRueda(flanco, z, { nCabeza = 6, nFondo = 6 } = {}) {
  const paso = (2 * Math.PI) / z;
  const derecha = [];
  for (let i = 0; i <= nCabeza; i++) derecha.push([flanco.rTop, (flanco.betaTop * i) / nCabeza]);
  for (let i = flanco.puntos.length - 2; i >= 0; i--) {
    const p = flanco.puntos[i];
    derecha.push([p.R, p.beta]);
  }
  const bFondo = Math.min(flanco.betaRaiz, paso / 2);
  for (let i = 1; i <= nFondo; i++) {
    derecha.push([flanco.rRaiz, bFondo + ((paso / 2 - bFondo) * i) / nFondo]);
  }
  // diente: desde −paso/2 hasta +paso/2
  const diente = [];
  for (let i = derecha.length - 1; i >= 1; i--) diente.push([derecha[i][0], -derecha[i][1]]);
  for (const p of derecha) diente.push(p);

  const porDiente = diente.length - 1; // el último coincide con el primero del siguiente
  const out = new Float64Array(z * porDiente * 2);
  let k = 0;
  for (let j = 0; j < z; j++) {
    const giro = j * paso;
    for (let i = 0; i < porDiente; i++) {
      const [R, b] = diente[i];
      out[k++] = R * Math.sin(b + giro);
      out[k++] = R * Math.cos(b + giro);
    }
  }
  return out;
}

function validar({ z1, z2, m, a, perfil, relacion }) {
  const enteros = [
    ['z1', z1],
    ['z2', z2],
  ];
  for (const [n, z] of enteros) {
    if (!Number.isInteger(z) || z < 5) throw new Error(`${n} debe ser un entero ≥ 5.`);
  }
  if (!(m > 0)) throw new Error('El módulo debe ser positivo.');
  if (!(a > 0)) throw new Error('La distancia entre centros debe ser positiva.');
  if (!PERFILES[perfil]) throw new Error(`Perfil desconocido: ${perfil}`);
  if (!(relacion > 0)) throw new Error('La relación de espesores debe ser positiva.');
}

function calcularRueda(z, x, m, alpha, alphaW, k, perfil) {
  const P = PERFILES[perfil];
  const d = z * m;
  const db = d * Math.cos(alpha);
  const da = d + 2 * m * (P.haP + x + k);
  const df = d - 2 * m * (P.hfP - x);
  const s = espesorReferencia(m, x, alpha);
  const sb = db * (s / d + inv(alpha));
  const dw = db / Math.cos(alphaW);
  const sw = dw * (s / d + inv(alpha) - inv(alphaW));
  const alphaA = Math.acos(Math.min(1, db / da));
  const sa = da * (s / d + inv(alpha) - inv(alphaA));
  const xMin = desplazamientoMinimo(z, perfil, alpha);
  return {
    z, m, x, alpha, perfil, d, db, da, df, dw, s, sb, sw, sa, alphaA, xMin,
    socavado: x < xMin - 1e-12,
  };
}

/**
 * Cálculo de la pareja piñón/rueda.
 * @param {{z1:number,z2:number,m:number,a:number,perfil?:string,relacion?:number,alpha?:number}} p
 *   relacion = s_b1 / s_b2 (espesor en la base piñón / rueda)
 */
export function calcularPareja({ z1, z2, m, a, perfil = 'A', relacion = 1, alpha = ALPHA_P }) {
  validar({ z1, z2, m, a, perfil, relacion });
  const a0 = (m * (z1 + z2)) / 2;
  const cosAw = (a0 * Math.cos(alpha)) / a;
  if (cosAw > 1) {
    throw new Error(
      `Distancia entre centros demasiado pequeña: debe ser mayor que ${(a0 * Math.cos(alpha)).toFixed(3)} mm.`,
    );
  }
  const alphaW = Math.acos(cosAw);
  const sumaX = sumaDesplazamientos(z1, z2, alphaW, alpha);
  const [x1, x2] = repartirDesplazamientos(z1, z2, sumaX, relacion, alpha);
  const k = (a - a0) / m - sumaX; // modificación de la altura de cabeza (≤ 0)

  const ruedas = [
    calcularRueda(z1, x1, m, alpha, alphaW, k, perfil),
    calcularRueda(z2, x2, m, alpha, alphaW, k, perfil),
  ];
  const avisos = [];
  for (const [i, rw] of ruedas.entries()) {
    const nombre = i === 0 ? 'Piñón' : 'Rueda';
    try {
      rw.flanco = generarFlanco(rw);
      rw.dNf = 2 * rw.flanco.rForma;
    } catch (e) {
      throw new Error(`${nombre}: ${e.message}`);
    }
    if (rw.flanco.socavaDiente) avisos.push({ nivel: 'error', texto: `${nombre}: el socavado destruye el diente.` });
    else if (rw.socavado) avisos.push({ nivel: 'aviso', texto: `${nombre}: socavado (x < x_min = ${rw.xMin.toFixed(3)}).` });
    if (rw.flanco.puntiagudo || rw.sa <= 0) avisos.push({ nivel: 'error', texto: `${nombre}: diente apuntado.` });
    else if (rw.sa < 0.2 * m) avisos.push({ nivel: 'aviso', texto: `${nombre}: espesor en cabeza pequeño (s_a < 0,2 m).` });
  }

  const [p1, p2] = ruedas;
  const rb1 = p1.db / 2;
  const rb2 = p2.db / 2;
  const ra1 = p1.flanco.rTop;
  const ra2 = p2.flanco.rTop;
  const T1T2 = a * Math.sin(alphaW);
  const gE = Math.sqrt(ra1 * ra1 - rb1 * rb1); // fin de engrane, desde T1
  const gA = T1T2 - Math.sqrt(ra2 * ra2 - rb2 * rb2); // comienzo de engrane, desde T1
  const pb = Math.PI * m * Math.cos(alpha);
  const epsilonAlpha = (gE - gA) / pb;

  // interferencia: el contacto no debe empezar por debajo del diámetro de forma
  const dSAP1 = gA >= 0 ? 2 * Math.hypot(rb1, gA) : NaN;
  const gA2 = T1T2 - gE;
  const dSAP2 = gA2 >= 0 ? 2 * Math.hypot(rb2, gA2) : NaN;
  p1.dSAP = dSAP1;
  p2.dSAP = dSAP2;
  if (!(dSAP1 >= p1.dNf - 1e-9)) avisos.push({ nivel: 'error', texto: 'Interferencia en el pie del piñón.' });
  if (!(dSAP2 >= p2.dNf - 1e-9)) avisos.push({ nivel: 'error', texto: 'Interferencia en el pie de la rueda.' });
  if (epsilonAlpha < 1) avisos.push({ nivel: 'error', texto: `Grado de recubrimiento ε_α = ${epsilonAlpha.toFixed(3)} < 1.` });
  else if (epsilonAlpha < 1.1) avisos.push({ nivel: 'aviso', texto: `Grado de recubrimiento bajo (ε_α = ${epsilonAlpha.toFixed(3)}).` });

  return {
    entrada: { z1, z2, m, a, perfil, relacion, alpha },
    a0,
    alphaW,
    sumaX,
    k,
    ruedas,
    gA,
    gE,
    T1T2,
    epsilonAlpha,
    holgura: [a - ra1 - p2.df / 2, a - ra2 - p1.df / 2],
    avisos,
  };
}

/**
 * Deslizamiento específico a lo largo del segmento de engrane activo.
 * g: distancia desde T1 sobre la línea de engrane (mm).
 */
export function deslizamientoEspecifico(par, n = 60) {
  const { gA, gE, T1T2 } = par;
  const { z1, z2 } = par.entrada;
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
  return { g, zeta1, zeta2, gC: (par.ruedas[0].dw / 2) * Math.sin(par.alphaW) };
}
