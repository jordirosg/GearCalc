// Gráficos con Chart.js (cargado como global desde CDN).

const color = (nombre) => getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();

/** Crea el gráfico de deslizamiento específico. Devuelve null si Chart.js no está disponible. */
export function crearGraficoDeslizamiento(canvas) {
  const Chart = window.Chart;
  if (!Chart) {
    canvas.replaceWith(Object.assign(document.createElement('p'), {
      className: 'nota',
      textContent: 'No se ha podido cargar Chart.js.',
    }));
    return null;
  }
  const texto = color('--texto-suave');
  const rejilla = color('--borde');
  return new Chart(canvas, {
    type: 'line',
    data: {
      datasets: [
        { label: 'ζ₁ piñón', data: [], borderColor: color('--pinon'), borderWidth: 2, pointRadius: 0 },
        { label: 'ζ₂ rueda', data: [], borderColor: color('--rueda'), borderWidth: 2, pointRadius: 0 },
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
          title: { display: true, text: 'Posición sobre la línea de engrane respecto al polo C (mm)', color: texto },
          ticks: { color: texto },
          grid: { color: rejilla },
        },
        y: {
          title: { display: true, text: 'ζ', color: texto },
          ticks: { color: texto },
          grid: { color: rejilla },
        },
      },
      plugins: {
        legend: { labels: { color: texto, boxHeight: 2 } },
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

/** Actualiza el gráfico con el resultado de deslizamientoEspecifico(). */
export function actualizarGraficoDeslizamiento(grafico, datos) {
  if (!grafico) return;
  const { g, zeta1, zeta2, gC } = datos;
  grafico.data.datasets[0].data = g.map((gi, i) => ({ x: gi - gC, y: zeta1[i] }));
  grafico.data.datasets[1].data = g.map((gi, i) => ({ x: gi - gC, y: zeta2[i] }));
  // límites razonables: ζ tiende a −∞ cerca de los puntos T
  const todos = [...zeta1, ...zeta2];
  grafico.options.scales.y.min = Math.max(-4, Math.floor(Math.min(...todos)));
  grafico.options.scales.y.max = 1;
  grafico.update();
}
