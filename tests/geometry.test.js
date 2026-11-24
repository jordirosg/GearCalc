import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALPHA_P,
  PERFILES,
  inv,
  espesorBase,
  calcularPareja,
  datosCremallera,
  fronteraCremallera,
  puntoTrocoide,
  semiAnguloEvolvente,
  contornoRueda,
  deslizamientoEspecifico,
  desplazamientoMinimo,
} from '../js/geometry.js';

const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} ≠ ${b} (tol ${tol})`);

test('función evolvente', () => {
  cerca(inv(ALPHA_P), 0.014904383867336446, 1e-15);
  cerca(inv(0), 0, 1e-15);
});

test('perfiles ISO 53', () => {
  assert.deepEqual(Object.keys(PERFILES), ['A', 'B', 'C', 'D']);
  assert.equal(PERFILES.D.hfP, 1.4);
  assert.equal(PERFILES.C.rhoFP, 0.25);
});

test('a = a0 con z1 = z2: engranaje normal sin desplazamiento', () => {
  const p = calcularPareja({ z1: 20, z2: 20, m: 1, a: 20 });
  cerca(p.alphaW, ALPHA_P, 1e-12);
  cerca(p.sumaX, 0, 1e-12);
  cerca(p.ruedas[0].x, 0, 1e-12);
  cerca(p.k, 0, 1e-12);
  // ε_α de referencia para 20/20 normal: 1,557
  cerca(p.epsilonAlpha, 1.557, 1e-3);
});

test('relación de espesores en la base y suma de desplazamientos', () => {
  for (const relacion of [0.6, 1, 1.37, 2]) {
    const p = calcularPareja({ z1: 13, z2: 47, m: 2.5, a: 76.3, relacion });
    const [r1, r2] = p.ruedas;
    cerca(r1.sb / r2.sb, relacion, 1e-12, 'sb1/sb2');
    cerca(r1.sb, espesorBase(13, 2.5, r1.x), 1e-12);
    cerca(r1.x + r2.x, p.sumaX, 1e-12);
  }
});

test('juego nulo: s_w1 + s_w2 = paso de funcionamiento', () => {
  for (const a of [55.5, 57, 58, 60.2]) {
    const p = calcularPareja({ z1: 17, z2: 40, m: 2, a, relacion: 1.2 });
    const [r1, r2] = p.ruedas;
    cerca(r1.sw + r2.sw, (Math.PI * r1.dw) / 17, 1e-10);
    cerca(r1.dw / 2 + r2.dw / 2, a, 1e-10);
  }
});

test('holgura de fondo = c_P en ambos lados para cada perfil', () => {
  for (const perfil of ['A', 'B', 'C', 'D']) {
    const p = calcularPareja({ z1: 17, z2: 40, m: 2, a: 58.4, perfil, relacion: 0.8 });
    const cP = (PERFILES[perfil].hfP - PERFILES[perfil].haP) * 2;
    cerca(p.holgura[0], cP, 1e-10, perfil);
    cerca(p.holgura[1], cP, 1e-10, perfil);
    assert.ok(p.k <= 1e-12, 'k ≤ 0');
  }
});

test('desplazamiento mínimo sin socavado', () => {
  // perfil A: (1,25 − 0,38(1 − sen20°)) − z sen²20° / 2
  cerca(desplazamientoMinimo(17, 'A'), 1.25 - 0.38 * (1 - Math.sin(ALPHA_P)) - 17 * Math.sin(ALPHA_P) ** 2 / 2, 1e-12);
  const p = calcularPareja({ z1: 10, z2: 10, m: 1, a: 10 });
  assert.ok(p.ruedas[0].socavado);
  const q = calcularPareja({ z1: 30, z2: 30, m: 1, a: 30 });
  assert.ok(!q.ruedas[0].socavado);
});

test('distancia entre centros imposible', () => {
  assert.throws(() => calcularPareja({ z1: 20, z2: 20, m: 1, a: 18 }), /demasiado pequeña/);
  assert.throws(() => calcularPareja({ z1: 20.5, z2: 20, m: 1, a: 20 }), /entero/);
});

test('trocoide: empieza en el fondo y enlaza tangente con la evolvente', () => {
  for (const perfil of ['A', 'B', 'C', 'D']) {
    const p = calcularPareja({ z1: 25, z2: 40, m: 3, a: 99, perfil });
    for (const rw of p.ruedas) {
      const cr = datosCremallera(rw.m, rw.x, perfil);
      const r = rw.d / 2;
      const phi0 = -cr.uC / r;
      const phi1 = (cr.vC / Math.tan(ALPHA_P) - cr.uC) / r;
      const ini = puntoTrocoide(phi0, r, cr);
      cerca(ini.R, rw.df / 2, 1e-9, 'radio de fondo');
      const fin = puntoTrocoide(phi1, r, cr);
      cerca(fin.R, rw.flanco.rForma, 1e-9, 'radio de forma');
      cerca(fin.beta, semiAnguloEvolvente(fin.R, rw), 1e-9, 'enlace con la evolvente');
    }
  }
});

/** Penetración máxima (mm) del contorno en la cremallera generadora, para muchas posiciones. */
function penetracionMaxima(rw, xy) {
  const cr = datosCremallera(rw.m, rw.x, rw.perfil);
  const r = rw.d / 2;
  const pm = Math.PI * rw.m;
  let peor = 0;
  for (let k = -60; k <= 60; k++) {
    const phi = (k / 60) * (2.2 * Math.PI) / rw.z;
    const c = Math.cos(phi);
    const s = Math.sin(phi);
    for (let i = 0; i < xy.length; i += 2) {
      // rueda → sistema fijo (giro horario φ) → cremallera
      const X = xy[i] * c + xy[i + 1] * s;
      const Y = -xy[i] * s + xy[i + 1] * c;
      let u = X - r * phi;
      const v = Y - r;
      if (v < cr.vT) continue;
      // diente de cremallera más cercano (centrados en π m / 2 + j π m)
      u = u - pm * Math.round((u - pm / 2) / pm);
      const ub = fronteraCremallera(v, cr);
      const semi = pm / 2 - ub;
      const dentro = semi - Math.abs(u - pm / 2);
      // proyección aproximada a la normal del flanco
      if (dentro > 0) peor = Math.max(peor, Math.min(dentro * Math.cos(ALPHA_P), v - cr.vT));
    }
  }
  return peor;
}

test('el diente generado no penetra en la cremallera (normal y con socavado)', () => {
  const casos = [
    { z1: 17, z2: 40, m: 2, a: 58, perfil: 'A' },
    { z1: 30, z2: 31, m: 1, a: 30.5, perfil: 'D' },
    { z1: 8, z2: 8, m: 1, a: 8, perfil: 'C' }, // socavado fuerte
    { z1: 9, z2: 60, m: 1, a: 34.5, perfil: 'B', relacion: 0.7 },
  ];
  for (const caso of casos) {
    const p = calcularPareja(caso);
    for (const rw of p.ruedas) {
      const xy = contornoRueda(rw.flanco, rw.z);
      const porDiente = xy.length / rw.z;
      const pen = penetracionMaxima(rw, xy.subarray(0, porDiente));
      assert.ok(pen < 2e-3 * rw.m, `${JSON.stringify(caso)} z=${rw.z}: penetración ${pen}`);
    }
  }
});

/** Trocoide analítica del redondeo interpolada en el radio R (referencia independiente). */
function betaTrocoide(rw, R) {
  const cr = datosCremallera(rw.m, rw.x, rw.perfil);
  const r = rw.d / 2;
  const phi0 = -cr.uC / r;
  const phi1 = (cr.vC / Math.tan(ALPHA_P) - cr.uC) / r;
  let prev = puntoTrocoide(phi0, r, cr);
  let b = Infinity;
  for (let i = 1; i <= 2000; i++) {
    const q = puntoTrocoide(phi0 + ((phi1 - phi0) * i) / 2000, r, cr);
    if ((R - prev.R) * (R - q.R) <= 0 && q.R !== prev.R) {
      b = Math.min(b, prev.beta + ((q.beta - prev.beta) * (R - prev.R)) / (q.R - prev.R));
    }
    prev = q;
  }
  return b;
}

test('la traza de la herramienta coincide con la evolvente y la trocoide analíticas', () => {
  const casos = [
    { z1: 17, z2: 40, m: 2, a: 58, perfil: 'A' },
    { z1: 25, z2: 31, m: 3, a: 85, perfil: 'D', relacion: 1.4 },
    { z1: 9, z2: 60, m: 1, a: 34.5, perfil: 'B', relacion: 0.7 },
  ];
  for (const caso of casos) {
    const p = calcularPareja(caso);
    for (const rw of p.ruedas) {
      const tol = 2e-3 * rw.m; // mm, medidos sobre el arco
      for (const { R, beta } of rw.flanco.puntos) {
        if (R <= rw.df / 2 + 1e-9) continue;
        // la evolvente sólo se genera por encima del punto de forma (o desde la base si hay socavado)
        const cr = datosCremallera(rw.m, rw.x, rw.perfil);
        const L = (rw.d / 2) * Math.sin(ALPHA_P) + cr.vF / Math.sin(ALPHA_P);
        const rEvol = L >= 0 ? Math.hypot(rw.db / 2, L) : rw.db / 2;
        let ref = betaTrocoide(rw, R);
        if (R >= rEvol) ref = Math.min(ref, semiAnguloEvolvente(R, rw));
        if (!Number.isFinite(ref)) continue;
        assert.ok(R * Math.abs(beta - ref) < tol, `${JSON.stringify(caso)} z=${rw.z} R=${R}: ${R * (beta - ref)} mm`);
      }
    }
  }
});

test('contorno: cerrado, entre fondo y cabeza, simétrico', () => {
  const p = calcularPareja({ z1: 17, z2: 40, m: 2, a: 58 });
  const rw = p.ruedas[0];
  const xy = contornoRueda(rw.flanco, rw.z);
  assert.equal(xy.length % (2 * rw.z), 0);
  let rMin = Infinity;
  let rMax = 0;
  for (let i = 0; i < xy.length; i += 2) {
    const R = Math.hypot(xy[i], xy[i + 1]);
    rMin = Math.min(rMin, R);
    rMax = Math.max(rMax, R);
  }
  cerca(rMin, rw.df / 2, 1e-9);
  cerca(rMax, rw.da / 2, 1e-9);
  // simetría: el diente 0 (centrado en +Y) es simétrico respecto al eje Y.
  // El punto n es el primero del diente 1 y cierra el diente 0 por la derecha.
  const n = xy.length / 2 / rw.z;
  for (let i = 0; i <= n; i++) {
    cerca(xy[2 * i], -xy[2 * (n - i)], 1e-9, 'x simétrica');
    cerca(xy[2 * i + 1], xy[2 * (n - i) + 1], 1e-9, 'y simétrica');
  }
});

test('deslizamiento específico: nulo en el polo, ζ1 = ζ2 en extremos inversos', () => {
  const p = calcularPareja({ z1: 17, z2: 40, m: 2, a: 58 });
  const d = deslizamientoEspecifico(p, 200);
  // en el polo de engrane ζ = 0
  const z1 = 17;
  const z2 = 40;
  const rho1 = d.gC;
  const rho2 = p.T1T2 - d.gC;
  cerca(1 - (rho2 * z1) / (rho1 * z2), 0, 1e-12);
  assert.ok(d.g[0] < d.gC && d.gC < d.g[d.g.length - 1]);
  assert.ok(d.zeta1[0] < 0 && d.zeta1[d.zeta1.length - 1] > 0);
});
