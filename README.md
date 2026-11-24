# GearCalc

Càlcul i visualització d'engranatges cilíndrics de dentat recte exterior amb perfil d'evolvent,
segons **ISO 21771** i amb el perfil de referència de la cremallera **ISO 53:1998** (perfils A, B, C i D).

Aplicació web en HTML i JavaScript pur (mòduls ES), sense frameworks ni procés de compilació.
Pensada per a pantalla vertical de mòbil: el pinyó a dalt i la roda a baix.

**Prova-la:** https://jordirosg.github.io/GearCalc/

## Què fa

- **Càlcul de la parella pinyó/roda** a partir del nombre de dents (z₁, z₂), el mòdul (m) i la
  distància entre centres (a), amb joc nul entre flancs.
  - La distància entre centres fixa l'angle de pressió de funcionament α_w i la suma de
    desplaçaments x₁ + x₂.
  - La suma es reparteix amb un lliscador segons la relació de gruixos a la base s_b1 / s_b2
    (inicialment 1). Botons per igualar gruixos a la base (s_b1 = s_b2) o desplaçaments (x₁ = x₂).
  - Escurçament de cap (k·m) perquè el joc de fons sigui sempre c_P.
- **Perfil de la dent generat per tall**: la cremallera ISO 53 rodola sobre la peça en brut i el
  perfil és la traça que hi deixa l'eina (evolvent, acord de peu i soscavament inclosos).
- **Resultats** (amb explicació de cada fila): diàmetres d, d_b, d_w, d_a, d_f, de forma i d'inici
  de contacte; gruixos s, s_b, s_w, s_a; grau de recobriment ε_α; joc de fons; lliscament específic
  als extrems del contacte.
- **Avisos**: soscavament, dent punxeguda, gruix al cap petit, interferència i recobriment baix.
- **Gràfic de lliscament específic** al llarg de la línia d'engranament (Chart.js).

## Vistes

- **Engranament**: la parella engranant, amb animació. El pinyó gira en sentit antihorari i és el
  motor; es mostra la línia d'acció activa i els punts de contacte sobre el flanc del pinyó, que
  apareixen a l'inici del contacte (A) i desapareixen al final (E).
- **Generació** (botó ✂), per al pinyó o per a la roda:
  - ventall fix de posicions de la cremallera al voltant d'un buit, com a la figura clàssica;
  - animació del tall de la peça en brut durant una volta sencera;
  - línies de referència: d, d_b, línia de rodolament, desplaçament x·m, angle α i límit de
    soscavament (d/2)·sin²α.
- Velocitat de l'animació regulable (×0,05 – ×2), zoom amb la roda del ratolí o pessigant, i
  desplaçament arrossegant. Tema clar i fosc segons el sistema.

## Ús en local

No cal instal·lar res: n'hi ha prou de servir la carpeta amb qualsevol servidor web estàtic
(els mòduls ES no funcionen obrint el fitxer directament amb `file://`). Per exemple:

```sh
python -m http.server 8000
```

i obrir http://localhost:8000/.

## Tests

Les funcions de càlcul són pures i estan separades de la interfície. Els tests fan servir el
corredor integrat de Node (versió 18 o superior):

```sh
npm test        # equival a: node --test
```

Comproven, entre d'altres: el repartiment de desplaçaments, el joc nul, el joc de fons de cada
perfil, que la dent tallada no penetra la cremallera, que la traça de l'eina coincideix amb
l'evolvent i la trocoide analítiques, i que els punts de contacte cauen sobre les dues involutes.

## Estructura

```
index.html            pàgina única: llenç a pantalla completa i calaix d'entrada
css/styles.css        estils (temes clar i fosc)
js/geometry.js        càlculs purs: parella, tall per cremallera, contorns, contacte, lliscament
js/generacio.js       vista de generació (ventall i animació del tall)
js/charts.js          gràfic de lliscament específic (Chart.js des del CDN)
js/ui.js              interfície: entrades, resultats, dibuix i navegació
tests/                tests amb node --test
```

## Convencions

- Unitats en mm i graus a la interfície; angles interns en radiants.
- Codi i interfície en català.
