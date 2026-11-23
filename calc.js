// Cálculos puros (sin pantalla ni base de datos), probados en calc.test.js.

export const NUTRIENTES = ['kcal', 'prot', 'hc', 'grasa', 'fibra'];

// Valores de un alimento (definido por 100 g) para una cantidad en gramos
export const paraGramos = (a, g) => Object.fromEntries(NUTRIENTES.map(k => [k, (a[k] || 0) * g / 100]));

// Suma los nutrientes de una lista de entradas
export const sumar = (lista) => Object.fromEntries(NUTRIENTES.map(k => [k, lista.reduce((s, e) => s + (e[k] || 0), 0)]));

export const ACTIVIDAD = {
  sedentario: { factor: 1.2, texto: 'Sedentario (poco o nada de ejercicio)' },
  ligero: { factor: 1.375, texto: 'Ligero (ejercicio 1-3 días/semana)' },
  moderado: { factor: 1.55, texto: 'Moderado (ejercicio 3-5 días/semana)' },
  alto: { factor: 1.725, texto: 'Alto (ejercicio 6-7 días/semana)' },
  muyAlto: { factor: 1.9, texto: 'Muy alto (trabajo físico + deporte)' },
};

// Metabolismo basal, fórmula de Mifflin-St Jeor. sexo: 'h' (hombre) o 'm' (mujer)
export const metabolismoBasal = ({ sexo, edad, altura, peso }) =>
  10 * peso + 6.25 * altura - 5 * edad + (sexo === 'h' ? 5 : -161);

export const gastoDiario = (p) => metabolismoBasal(p) * ACTIVIDAD[p.actividad].factor;

// Por debajo de esto es difícil cubrir los nutrientes sin supervisión médica
export const minimoSaludable = (sexo) => (sexo === 'h' ? 1500 : 1200);

// Déficit de 500 kcal/día (~0,5 kg/semana), sin bajar nunca del mínimo saludable
export const kcalPropuestas = (p) => Math.max(Math.round((gastoDiario(p) - 500) / 10) * 10, minimoSaludable(p.sexo));

// 1,6 g por kg de peso: ayuda a conservar músculo mientras se pierde grasa
export const protPropuesta = (p) => Math.round(p.peso * 1.6);

// Reparto del resto: 30 % de las kcal en grasa, hidratos lo que queda, fibra 25 g (recomendación EFSA)
export function objetivosMacros(kcal, prot) {
  const grasa = kcal * 0.3 / 9;
  return { prot, grasa, hc: Math.max(0, (kcal - prot * 4 - grasa * 9) / 4), fibra: 25 };
}

// Receta: ingredientes [{g, kcal, prot...por 100 g}] → valores por 100 g y peso de una ración
export function valoresReceta(ingredientes, raciones) {
  const total = ingredientes.reduce((s, i) => s + i.g, 0);
  const suma = sumar(ingredientes.map(i => paraGramos(i, i.g)));
  const por100 = Object.fromEntries(NUTRIENTES.map(k => [k, total ? suma[k] * 100 / total : 0]));
  return { ...por100, pesoTotal: total, kcalTotal: suma.kcal, racion: { nombre: '1 ración', g: Math.round(total / (raciones || 1)) } };
}

// Fechas como texto 'AAAA-MM-DD' en hora local
export const fechaISO = (d = new Date()) => new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export function sumarDias(fecha, n) {
  const d = new Date(fecha + 'T12:00'); // mediodía: evita saltos por cambio de hora
  d.setDate(d.getDate() + n);
  return fechaISO(d);
}
