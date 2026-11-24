import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALPHA_P,
  PERFILS,
  inv,
  gruixBase,
  calcularParella,
  dadesCremallera,
  fronteraCremallera,
  puntTrocoide,
  semiAngleEvolvent,
  contornRoda,
  lliscamentEspecific,
  desplacamentMinim,
  relacioDesplacamentsIguals,
  contornCremallera,
  finestraGeneracio,
  liniaAccio,
  contactesActius,
} from '../js/geometry.js';

const aprop = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} ≠ ${b} (tol ${tol})`);

test('funció evolvent', () => {
  aprop(inv(ALPHA_P), 0.014904383867336446, 1e-15);
  aprop(inv(0), 0, 1e-15);
});

test('perfils ISO 53', () => {
  assert.deepEqual(Object.keys(PERFILS), ['A', 'B', 'C', 'D']);
  assert.equal(PERFILS.D.hfP, 1.4);
  assert.equal(PERFILS.C.rhoFP, 0.25);
});

test('a = a0 amb z1 = z2: engranatge normal sense desplaçament', () => {
  const p = calcularParella({ z1: 20, z2: 20, m: 1, a: 20 });
  aprop(p.alphaW, ALPHA_P, 1e-12);
  aprop(p.sumaX, 0, 1e-12);
  aprop(p.rodes[0].x, 0, 1e-12);
  aprop(p.k, 0, 1e-12);
  // ε_α de referència per a 20/20 normal: 1,557
  aprop(p.epsilonAlpha, 1.557, 1e-3);
});

test('relació de gruixos a la base i suma de desplaçaments', () => {
  for (const relacio of [0.6, 1, 1.37, 2]) {
    const p = calcularParella({ z1: 13, z2: 47, m: 2.5, a: 76.3, relacio });
    const [r1, r2] = p.rodes;
    aprop(r1.sb / r2.sb, relacio, 1e-12, 'sb1/sb2');
    aprop(r1.sb, gruixBase(13, 2.5, r1.x), 1e-12);
    aprop(r1.x + r2.x, p.sumaX, 1e-12);
  }
});

test('relació per a desplaçaments iguals: x1 = x2', () => {
  for (const [z1, z2, m, a] of [[11, 25, 2.25, 43], [17, 40, 2, 58], [10, 200, 1, 106]]) {
    const base = calcularParella({ z1, z2, m, a });
    const relacio = relacioDesplacamentsIguals(z1, z2, base.sumaX);
    const p = calcularParella({ z1, z2, m, a, relacio });
    aprop(p.rodes[0].x, p.rodes[1].x, 1e-12, `${z1}/${z2}`);
    aprop(p.rodes[0].x, base.sumaX / 2, 1e-12);
  }
});

test('joc nul: s_w1 + s_w2 = pas de funcionament', () => {
  for (const a of [55.5, 57, 58, 60.2]) {
    const p = calcularParella({ z1: 17, z2: 40, m: 2, a, relacio: 1.2 });
    const [r1, r2] = p.rodes;
    aprop(r1.sw + r2.sw, (Math.PI * r1.dw) / 17, 1e-10);
    aprop(r1.dw / 2 + r2.dw / 2, a, 1e-10);
  }
});

test('joc de fons = c_P als dos costats per a cada perfil', () => {
  for (const perfil of ['A', 'B', 'C', 'D']) {
    const p = calcularParella({ z1: 17, z2: 40, m: 2, a: 58.4, perfil, relacio: 0.8 });
    const cP = (PERFILS[perfil].hfP - PERFILS[perfil].haP) * 2;
    aprop(p.jocFons[0], cP, 1e-10, perfil);
    aprop(p.jocFons[1], cP, 1e-10, perfil);
    assert.ok(p.k <= 1e-12, 'k ≤ 0');
  }
});

test('desplaçament mínim sense soscavament', () => {
  // perfil A: (1,25 − 0,38(1 − sin20°)) − z sin²20° / 2
  aprop(desplacamentMinim(17, 'A'), 1.25 - 0.38 * (1 - Math.sin(ALPHA_P)) - 17 * Math.sin(ALPHA_P) ** 2 / 2, 1e-12);
  const p = calcularParella({ z1: 10, z2: 10, m: 1, a: 10 });
  assert.ok(p.rodes[0].soscavat);
  const q = calcularParella({ z1: 30, z2: 30, m: 1, a: 30 });
  assert.ok(!q.rodes[0].soscavat);
});

test('distància entre centres impossible', () => {
  assert.throws(() => calcularParella({ z1: 20, z2: 20, m: 1, a: 18 }), /massa petita/);
  assert.throws(() => calcularParella({ z1: 20.5, z2: 20, m: 1, a: 20 }), /enter/);
});

test('trocoide: comença al fons i enllaça tangent amb l\'evolvent', () => {
  for (const perfil of ['A', 'B', 'C', 'D']) {
    const p = calcularParella({ z1: 25, z2: 40, m: 3, a: 99, perfil });
    for (const rw of p.rodes) {
      const cr = dadesCremallera(rw.m, rw.x, perfil);
      const r = rw.d / 2;
      const phi0 = -cr.uC / r;
      const phi1 = (cr.vC / Math.tan(ALPHA_P) - cr.uC) / r;
      const inici = puntTrocoide(phi0, r, cr);
      aprop(inici.R, rw.df / 2, 1e-9, 'radi de fons');
      const fi = puntTrocoide(phi1, r, cr);
      aprop(fi.R, rw.flanc.rForma, 1e-9, 'radi de forma');
      aprop(fi.beta, semiAngleEvolvent(fi.R, rw), 1e-9, "enllaç amb l'evolvent");
    }
  }
});

/** Penetració màxima (mm) del contorn dins la cremallera generadora, per a moltes posicions. */
function penetracioMaxima(rw, xy) {
  const cr = dadesCremallera(rw.m, rw.x, rw.perfil);
  const r = rw.d / 2;
  const pm = Math.PI * rw.m;
  let pitjor = 0;
  for (let k = -60; k <= 60; k++) {
    const phi = (k / 60) * (2.2 * Math.PI) / rw.z;
    const c = Math.cos(phi);
    const s = Math.sin(phi);
    for (let i = 0; i < xy.length; i += 2) {
      // roda → sistema fix (gir horari φ) → cremallera
      const X = xy[i] * c + xy[i + 1] * s;
      const Y = -xy[i] * s + xy[i + 1] * c;
      let u = X - r * phi;
      const v = Y - r;
      if (v < cr.vT) continue;
      // dent de cremallera més propera (centrades a π m / 2 + j π m)
      u = u - pm * Math.round((u - pm / 2) / pm);
      const ub = fronteraCremallera(v, cr);
      const semi = pm / 2 - ub;
      const dins = semi - Math.abs(u - pm / 2);
      // projecció aproximada sobre la normal del flanc
      if (dins > 0) pitjor = Math.max(pitjor, Math.min(dins * Math.cos(ALPHA_P), v - cr.vT));
    }
  }
  return pitjor;
}

test('la dent generada no penetra la cremallera (normal i amb soscavament)', () => {
  const casos = [
    { z1: 17, z2: 40, m: 2, a: 58, perfil: 'A' },
    { z1: 30, z2: 31, m: 1, a: 30.5, perfil: 'D' },
    { z1: 8, z2: 8, m: 1, a: 8, perfil: 'C' }, // soscavament fort
    { z1: 9, z2: 60, m: 1, a: 34.5, perfil: 'B', relacio: 0.7 },
  ];
  for (const cas of casos) {
    const p = calcularParella(cas);
    for (const rw of p.rodes) {
      const xy = contornRoda(rw.flanc, rw.z);
      const perDent = xy.length / rw.z;
      const pen = penetracioMaxima(rw, xy.subarray(0, perDent));
      assert.ok(pen < 2e-3 * rw.m, `${JSON.stringify(cas)} z=${rw.z}: penetració ${pen}`);
    }
  }
});

/** Trocoide analítica de l'arrodoniment interpolada al radi R (referència independent). */
function betaTrocoide(rw, R) {
  const cr = dadesCremallera(rw.m, rw.x, rw.perfil);
  const r = rw.d / 2;
  const phi0 = -cr.uC / r;
  const phi1 = (cr.vC / Math.tan(ALPHA_P) - cr.uC) / r;
  let anterior = puntTrocoide(phi0, r, cr);
  let b = Infinity;
  for (let i = 1; i <= 2000; i++) {
    const q = puntTrocoide(phi0 + ((phi1 - phi0) * i) / 2000, r, cr);
    if ((R - anterior.R) * (R - q.R) <= 0 && q.R !== anterior.R) {
      b = Math.min(b, anterior.beta + ((q.beta - anterior.beta) * (R - anterior.R)) / (q.R - anterior.R));
    }
    anterior = q;
  }
  return b;
}

test("la traça de l'eina coincideix amb l'evolvent i la trocoide analítiques", () => {
  const casos = [
    { z1: 17, z2: 40, m: 2, a: 58, perfil: 'A' },
    { z1: 25, z2: 31, m: 3, a: 85, perfil: 'D', relacio: 1.4 },
    { z1: 9, z2: 60, m: 1, a: 34.5, perfil: 'B', relacio: 0.7 },
  ];
  for (const cas of casos) {
    const p = calcularParella(cas);
    for (const rw of p.rodes) {
      const tol = 2e-3 * rw.m; // mm, mesurats sobre l'arc
      for (const { R, beta } of rw.flanc.punts) {
        if (R <= rw.df / 2 + 1e-9) continue;
        // l'evolvent només es genera per sobre del punt de forma (o des de la base si hi ha soscavament)
        const cr = dadesCremallera(rw.m, rw.x, rw.perfil);
        const L = (rw.d / 2) * Math.sin(ALPHA_P) + cr.vF / Math.sin(ALPHA_P);
        const rEvol = L >= 0 ? Math.hypot(rw.db / 2, L) : rw.db / 2;
        let ref = betaTrocoide(rw, R);
        if (R >= rEvol) ref = Math.min(ref, semiAngleEvolvent(R, rw));
        if (!Number.isFinite(ref)) continue;
        assert.ok(R * Math.abs(beta - ref) < tol, `${JSON.stringify(cas)} z=${rw.z} R=${R}: ${R * (beta - ref)} mm`);
      }
    }
  }
});

test('contorn: tancat, entre fons i cap, simètric', () => {
  const p = calcularParella({ z1: 17, z2: 40, m: 2, a: 58 });
  const rw = p.rodes[0];
  const xy = contornRoda(rw.flanc, rw.z);
  assert.equal(xy.length % (2 * rw.z), 0);
  let rMin = Infinity;
  let rMax = 0;
  for (let i = 0; i < xy.length; i += 2) {
    const R = Math.hypot(xy[i], xy[i + 1]);
    rMin = Math.min(rMin, R);
    rMax = Math.max(rMax, R);
  }
  aprop(rMin, rw.df / 2, 1e-9);
  aprop(rMax, rw.da / 2, 1e-9);
  // simetria: la dent 0 (centrada a +Y) és simètrica respecte de l'eix Y.
  // El punt n és el primer de la dent 1 i tanca la dent 0 per la dreta.
  const n = xy.length / 2 / rw.z;
  for (let i = 0; i <= n; i++) {
    aprop(xy[2 * i], -xy[2 * (n - i)], 1e-9, 'x simètrica');
    aprop(xy[2 * i + 1], xy[2 * (n - i) + 1], 1e-9, 'y simètrica');
  }
});

test('lliscament específic: nul al pol, signes oposats als extrems', () => {
  const p = calcularParella({ z1: 17, z2: 40, m: 2, a: 58 });
  const d = lliscamentEspecific(p, 200);
  // al pol d'engranament ζ = 0
  const z1 = 17;
  const z2 = 40;
  const rho1 = d.gC;
  const rho2 = p.T1T2 - d.gC;
  aprop(1 - (rho2 * z1) / (rho1 * z2), 0, 1e-12);
  assert.ok(d.g[0] < d.gC && d.gC < d.g[d.g.length - 1]);
  assert.ok(d.zeta1[0] < 0 && d.zeta1[d.zeta1.length - 1] > 0);
});

test('cremallera: contorn simètric respecte de la dent central i cap a v_T', () => {
  const p = calcularParella({ z1: 17, z2: 40, m: 2, a: 58, perfil: 'D' });
  const rw = p.rodes[0];
  const { tancat, dents } = contornCremallera(rw, { dents: 2 });
  const pm = Math.PI * rw.m;
  const n = dents.length;
  for (let i = 0; i < n; i++) {
    aprop(dents[i][0], pm - dents[n - 1 - i][0], 1e-12, 'u simètrica');
    aprop(dents[i][1], dents[n - 1 - i][1], 1e-12, 'v simètrica');
  }
  assert.equal(tancat.length, n + 2, "tancat pel cos de l'eina");
  const cr = dadesCremallera(rw.m, rw.x, 'D');
  aprop(Math.min(...dents.map(([, v]) => v)), cr.vT, 1e-12, 'cap de la cremallera');
});

test("finestra de generació: fora d'ella l'eina no toca la peça en brut", () => {
  const p = calcularParella({ z1: 17, z2: 40, m: 2, a: 58 });
  const rw = p.rodes[0];
  const { phiIni, phiFi } = finestraGeneracio(rw);
  const r = rw.d / 2;
  const ra = rw.da / 2;
  const { dents } = contornCremallera(rw, { dents: 0 });
  for (const phi of [phiIni, phiFi]) {
    // dent 0 de l'eina col·locada a φ, en el sistema de la roda
    const c = Math.cos(phi);
    const s = Math.sin(phi);
    const rMin = Math.min(...dents.map(([u, v]) => Math.hypot((u + r * phi) * c - (r + v) * s, (u + r * phi) * s + (r + v) * c)));
    assert.ok(rMin >= ra - 1e-9, `φ=${phi}: rMin ${rMin} < ra ${ra}`);
  }
});

test("contacte: el punt cau sobre la involuta motora del pinyó i sobre la de la roda", () => {
  for (const cas of [{ z1: 17, z2: 40, m: 2, a: 58 }, { z1: 12, z2: 30, m: 2, a: 43, perfil: 'C', relacio: 0.89 }]) {
    const p = calcularParella(cas);
    const [P, W] = p.rodes;
    const { punt } = liniaAccio(p);
    const a = cas.a;
    const pas1 = (2 * Math.PI) / P.z;
    const pas2 = (2 * Math.PI) / W.z;
    let vistos = 0;
    for (let k = 0; k < 50; k++) {
      const theta = (k / 50) * pas1 * 3;
      for (const g of contactesActius(p, theta)) {
        vistos++;
        const [x, y] = punt(g);
        // al sistema local del pinyó (dent 0 a +Y): desfer el gir π + θ
        const f1 = -(Math.PI + theta);
        const lx = x * Math.cos(f1) - (y - a / 2) * Math.sin(f1);
        const ly = x * Math.sin(f1) + (y - a / 2) * Math.cos(f1);
        const R1 = Math.hypot(lx, ly);
        let b1 = Math.atan2(lx, ly);
        b1 -= pas1 * Math.round(b1 / pas1);
        aprop(Math.abs(b1), semiAngleEvolvent(R1, P), 1e-9, `pinyó θ=${theta}`);
        // i a la roda (gir π/z2 − θ z1/z2)
        const f2 = -(Math.PI / W.z - (theta * P.z) / W.z);
        const mx = x * Math.cos(f2) - (y + a / 2) * Math.sin(f2);
        const my = x * Math.sin(f2) + (y + a / 2) * Math.cos(f2);
        const R2 = Math.hypot(mx, my);
        let b2 = Math.atan2(mx, my);
        b2 -= pas2 * Math.round(b2 / pas2);
        aprop(Math.abs(b2), semiAngleEvolvent(R2, W), 1e-9, `roda θ=${theta}`);
        assert.ok(g >= p.gA - 1e-9 && g <= p.gE + 1e-9);
      }
    }
    // de mitjana hi ha ε_α parells en contacte
    aprop(vistos / 50, p.epsilonAlpha, 0.05, 'ε_α');
  }
});

test('lliscament als extrems: coincideix amb la corba i es reequilibra amb el repartiment', () => {
  const p = calcularParella({ z1: 17, z2: 40, m: 2, a: 58 });
  const d = lliscamentEspecific(p, 100);
  aprop(p.zeta1A, d.zeta1[0], 1e-12, 'ζ1 a A');
  aprop(p.zeta2E, d.zeta2[d.zeta2.length - 1], 1e-12, 'ζ2 a E');
  assert.ok(p.zeta1A < 0 && p.zeta2E < 0, 'als peus el lliscament és negatiu');
  // més desplaçament al pinyó (s_b1 / s_b2 més gran) → baixa |ζ1 a A| i puja |ζ2 a E|
  const q = calcularParella({ z1: 17, z2: 40, m: 2, a: 58, relacio: 1.3 });
  assert.ok(q.rodes[0].x > p.rodes[0].x);
  assert.ok(Math.abs(q.zeta1A) < Math.abs(p.zeta1A));
  assert.ok(Math.abs(q.zeta2E) > Math.abs(p.zeta2E));
});

test('lliscament als extrems: sense valor si hi ha interferència', () => {
  const p = calcularParella({ z1: 8, z2: 8, m: 1, a: 8, perfil: 'C' });
  assert.ok(p.gA <= 0);
  assert.ok(Number.isNaN(p.zeta1A));
});
