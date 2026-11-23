// Gráficas en SVG dibujadas a mano (sin librerías, funcionan sin internet).
// Colores comprobados para daltonismo y contraste sobre la tarjeta oscura (#1e1b3a).
export const AZUL = '#3d8fd1', VERDE = '#2fa36e';
const ANCHO = 340, ALTO = 200, IZQ = 34, DER = 8, ARR = 12, ABA = 22;
const ddmm = (f) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
const kgTxt = (kg) => kg.toLocaleString('es-ES', { maximumFractionDigits: 1 });
const texto = (x, y, t, anclaje = 'start') =>
  `<text x="${x}" y="${y}" text-anchor="${anclaje}" font-size="11" style="fill:var(--suave)">${t}</text>`;
const lineaGuia = (y) => `<line x1="${IZQ}" x2="${ANCHO - DER}" y1="${y}" y2="${y}" style="stroke:var(--linea)" stroke-width="1"/>`;
const svg = (dentro, desc) =>
  `<svg viewBox="0 0 ${ANCHO} ${ALTO}" width="100%" role="img" aria-label="${desc}" style="display:block">${dentro}</svg>`;

// Peso: puntos (cada pesada), línea de la media móvil y línea discontinua del objetivo.
// Cada punto lleva data-info para mostrar su valor al tocarlo.
export function graficaPeso(pesos, media, objetivo) {
  const t = (f) => new Date(f + 'T12:00').getTime();
  const t0 = t(pesos[0].fecha), t1 = Math.max(t(pesos.at(-1).fecha), t0 + 864e5);
  const valores = pesos.map(p => p.kg).concat(objetivo > 0 ? [objetivo] : []);
  const min = Math.floor(Math.min(...valores) - 0.5), max = Math.ceil(Math.max(...valores) + 0.5);
  const x = (f) => IZQ + (t(f) - t0) / (t1 - t0) * (ANCHO - IZQ - DER);
  const y = (kg) => ARR + (max - kg) / (max - min) * (ALTO - ARR - ABA);
  const medio = (min + max) / 2;
  return svg(
    [min, medio, max].map(v => lineaGuia(y(v)) + texto(IZQ - 4, y(v) + 4, kgTxt(v), 'end')).join('')
    + (objetivo > 0 ? `<line x1="${IZQ}" x2="${ANCHO - DER}" y1="${y(objetivo)}" y2="${y(objetivo)}" style="stroke:var(--suave)" stroke-width="1.5" stroke-dasharray="5 4"/>`
      + texto(ANCHO - DER, y(objetivo) - 4, `Objetivo ${kgTxt(objetivo)}`, 'end') : '')
    + `<polyline fill="none" stroke="${VERDE}" stroke-width="2" stroke-linejoin="round" points="${media.map(p => `${x(p.fecha)},${y(p.kg)}`).join(' ')}"/>`
    + pesos.map(p => `<circle cx="${x(p.fecha)}" cy="${y(p.kg)}" r="4" fill="${AZUL}" style="stroke:var(--tarjeta)" stroke-width="2"/>
       <circle cx="${x(p.fecha)}" cy="${y(p.kg)}" r="14" fill="transparent" data-info="${ddmm(p.fecha)}: ${kgTxt(p.kg)} kg"><title>${ddmm(p.fecha)}: ${kgTxt(p.kg)} kg</title></circle>`).join('')
    + texto(IZQ, ALTO - 6, ddmm(pesos[0].fecha)) + texto(ANCHO - DER, ALTO - 6, ddmm(pesos.at(-1).fecha), 'end'),
    'Evolución del peso');
}

// Semana: una barra de kcal por día (lunes a domingo) y línea discontinua del objetivo
export function graficaSemana(dias, objetivo) {
  const max = Math.max(objetivo * 1.15, ...dias.map(d => d.kcal), 100);
  const y = (k) => ARR + (1 - k / max) * (ALTO - ARR - ABA);
  const base = y(0), hueco = (ANCHO - IZQ - DER) / dias.length, anchoBarra = hueco - 8;
  const letras = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  return svg(
    lineaGuia(base)
    + dias.map((d, i) => {
      const x0 = IZQ + i * hueco + 4, h = base - y(d.kcal);
      // Barra con la parte de arriba redondeada (rect redondeado + cuadrado que tapa el redondeo de abajo)
      const barra = d.kcal > 0 ? `<rect x="${x0}" y="${y(d.kcal)}" width="${anchoBarra}" height="${h}" rx="4" fill="${AZUL}"/>
        <rect x="${x0}" y="${base - Math.min(4, h)}" width="${anchoBarra}" height="${Math.min(4, h)}" fill="${AZUL}"/>` : '';
      return barra + texto(x0 + anchoBarra / 2, ALTO - 6, letras[i], 'middle')
        + `<rect x="${x0 - 4}" y="${ARR}" width="${hueco}" height="${base - ARR}" fill="transparent" data-info="${d.etiqueta}: ${d.kcal ? Math.round(d.kcal) + ' kcal' : 'sin datos'}"><title>${d.etiqueta}</title></rect>`;
    }).join('')
    + `<line x1="${IZQ}" x2="${ANCHO - DER}" y1="${y(objetivo)}" y2="${y(objetivo)}" style="stroke:var(--suave)" stroke-width="1.5" stroke-dasharray="5 4"/>`
    + texto(IZQ - 4, y(objetivo) + 4, Math.round(objetivo), 'end') + texto(IZQ - 4, base + 4, '0', 'end'),
    'Kcal de cada día de la semana frente al objetivo');
}
