import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avancarAnimacio, phiAnimacio } from '../js/generacio.js';

const g = { duradaTall: 10, phiIni: -1, phiFiAnim: 7 };

test("animació: el progrés depèn de la velocitat", () => {
  const a = avancarAnimacio(g, { progres: 0, pausa: 0 }, 2, 1);
  const b = avancarAnimacio(g, { progres: 0, pausa: 0 }, 2, 0.25);
  assert.equal(a.progres, 0.2);
  assert.equal(b.progres, 0.05);
});

test('animació: canviar la velocitat no fa saltar φ', () => {
  const e = avancarAnimacio(g, { progres: 0, pausa: 0 }, 3, 1);
  const abans = phiAnimacio(g, e.progres);
  avancarAnimacio(g, e, 0, 0.05); // canvi de velocitat sense temps transcorregut
  assert.equal(phiAnimacio(g, e.progres), abans);
});

test('animació: pausa final en temps real i reinici', () => {
  const e = { progres: 0.99, pausa: 0 };
  avancarAnimacio(g, e, 1, 0.05); // a velocitat baixa encara no acaba
  assert.ok(e.progres < 1);
  avancarAnimacio(g, e, 100, 1); // acaba
  assert.equal(e.progres, 1);
  assert.equal(phiAnimacio(g, e.progres), g.phiFiAnim);
  avancarAnimacio(g, e, 1, 0.05); // la pausa no depèn de la velocitat
  assert.equal(e.pausa, 1);
  avancarAnimacio(g, e, 1, 0.05);
  assert.equal(e.progres, 0);
  assert.equal(e.pausa, 0);
});
