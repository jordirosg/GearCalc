// Gràfics amb Chart.js (carregat com a global des del CDN).

const color = (nom) => getComputedStyle(document.documentElement).getPropertyValue(nom).trim();

/** Crea el gràfic de lliscament específic. Retorna null si Chart.js no està disponible. */
export function crearGraficLliscament(canvas) {
  const Chart = window.Chart;
  if (!Chart) {
    canvas.replaceWith(Object.assign(document.createElement('p'), {
      className: 'nota',
      textContent: "No s'ha pogut carregar Chart.js.",
    }));
    return null;
  }
  const text = color('--text-suau');
  const graella = color('--vora');
  return new Chart(canvas, {
    type: 'line',
    data: {
      datasets: [
        { label: 'ζ₁ pinyó', data: [], borderColor: color('--pinyo'), borderWidth: 2, pointRadius: 0 },
        { label: 'ζ₂ roda', data: [], borderColor: color('--roda'), borderWidth: 2, pointRadius: 0 },
      ],
    },
    options: {
      animation: false,
      maintainAspectRatio: false,
      parsing: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: "Posició sobre la línia d'engranament respecte al pol C (mm)", color: text },
          ticks: { color: text },
          grid: { color: graella },
        },
        y: {
          title: { display: true, text: 'ζ', color: text },
          ticks: { color: text },
          grid: { color: graella },
        },
      },
      plugins: {
        legend: { labels: { color: text, boxHeight: 2 } },
        tooltip: {
          callbacks: {
            title: (it) => `g − g_C = ${it[0].parsed.x.toFixed(3)} mm`,
            label: (it) => `${it.dataset.label}: ${it.parsed.y.toFixed(3)}`,
          },
        },
      },
    },
  });
}

/** Actualitza el gràfic amb el resultat de lliscamentEspecific(). */
export function actualitzarGraficLliscament(grafic, dades) {
  if (!grafic) return;
  const { g, zeta1, zeta2, gC } = dades;
  grafic.data.datasets[0].data = g.map((gi, i) => ({ x: gi - gC, y: zeta1[i] }));
  grafic.data.datasets[1].data = g.map((gi, i) => ({ x: gi - gC, y: zeta2[i] }));
  // límits raonables: ζ tendeix a −∞ a prop dels punts T
  const tots = [...zeta1, ...zeta2];
  grafic.options.scales.y.min = Math.max(-4, Math.floor(Math.min(...tots)));
  grafic.options.scales.y.max = 1;
  grafic.update();
}
