// Foto + descripción → Claude estima alimentos, gramos, kcal y macros.
// Se llama directamente desde el móvil con tu clave (guardada solo en el móvil), sin servidor intermedio.
// shortcut: llamada con fetch y no con el SDK de Anthropic, porque la app no tiene paso de build.
const MODELO = 'claude-sonnet-5-5';

const SISTEMA = `Eres un nutricionista que estima el contenido de un plato a partir de una foto y/o una descripción.
Separa cada alimento (incluye aceite, salsas o pan si se ven o son habituales en esa preparación española).
Para cada uno estima los gramos de la ración tal como se come (cocinado) y calcula para esos gramos:
kcal, proteínas, hidratos disponibles (sin fibra), grasas y fibra, con valores de tablas como BEDCA.
Si la descripción da cantidades o detalles, tienen prioridad sobre lo que parece en la foto.
Nombres en español, cortos. "confianza": alta si la ración se ve clara, media lo normal, baja si hay mucha incertidumbre.
"comentario": una frase corta con lo más dudoso (por ejemplo, la cantidad de aceite).`;

const NUM = { type: 'number' };
const ESQUEMA = {
  type: 'object', additionalProperties: false, required: ['alimentos', 'confianza', 'comentario'],
  properties: {
    alimentos: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['nombre', 'gramos', 'kcal', 'prot', 'hc', 'grasa', 'fibra'],
        properties: { nombre: { type: 'string' }, gramos: NUM, kcal: NUM, prot: NUM, hc: NUM, grasa: NUM, fibra: NUM },
      },
    },
    confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
    comentario: { type: 'string' },
  },
};

// Reduce la foto a 1024 px de lado mayor en JPEG: menos datos que enviar = más barato y rápido
export async function reducirFoto(archivo, lado = 1024) {
  const img = await createImageBitmap(archivo);
  const k = Math.min(1, lado / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8); // "data:image/jpeg;base64,..."
}

const ESQUEMA_ETIQUETA = {
  type: 'object', additionalProperties: false,
  required: ['legible', 'nombre', 'kcal', 'prot', 'hc', 'grasa', 'fibra', 'racion_nombre', 'racion_g'],
  properties: { legible: { type: 'boolean' }, nombre: { type: 'string' }, kcal: NUM, prot: NUM, hc: NUM, grasa: NUM, fibra: NUM,
    racion_nombre: { type: 'string' }, racion_g: NUM },
};

const SISTEMA_ETIQUETA = `Lees la tabla de información nutricional de la foto de un envase.
Devuelve los valores POR 100 g (o 100 ml). Si la tabla solo da valores por ración y dice cuánto pesa la ración, conviértelos a 100 g.
Si solo aparece la energía en kJ, pásala a kcal (kJ / 4,184). "hc" son los hidratos de carbono (no los azúcares).
Si la fibra no aparece, pon 0. "nombre": el producto y la marca si se ven en la foto; si no, cadena vacía.
"racion_nombre" y "racion_g": la ración o unidad que indique el envase (ej. "1 galleta", 12); si no hay, "" y 0.
"legible": false si la tabla está cortada, borrosa o no es una tabla nutricional.`;

// Hace una petición a Claude con una imagen y devuelve el JSON que cumple el esquema
async function preguntar({ clave, sistema, esquema, fotoDataUrl, texto }) {
  const contenido = [];
  if (fotoDataUrl) contenido.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: fotoDataUrl.split(',')[1] } });
  contenido.push({ type: 'text', text: texto });

  let r;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': clave,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true', // permite llamar desde el navegador (la clave es tuya y está en tu móvil)
        'anthropic-beta': 'server-side-fallback-2026-07-01',
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 16000,
        system: sistema,
        fallbacks: 'default', // si el modelo rechazara la petición, la repite otro modelo automáticamente
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: esquema } },
        messages: [{ role: 'user', content: contenido }],
      }),
    });
  } catch {
    throw new Error('Sin conexión a internet');
  }

  const datos = await r.json().catch(() => ({}));
  if (!r.ok) {
    const mensajes = { 401: 'La clave de Anthropic no es válida. Revísala en Ajustes.', 402: 'Tu cuenta de Anthropic no tiene saldo.',
      429: 'Demasiadas peticiones seguidas. Espera un minuto.', 529: 'El servicio está saturado. Prueba en un rato.' };
    throw new Error(mensajes[r.status] || `Error ${r.status}: ${datos.error?.message || 'respuesta inesperada'}`);
  }
  if (datos.stop_reason === 'refusal') throw new Error('Claude no ha querido analizar esta imagen.');
  if (datos.stop_reason === 'max_tokens') throw new Error('La respuesta se cortó. Prueba otra vez.');
  try { return JSON.parse(datos.content?.find(b => b.type === 'text')?.text); }
  catch { throw new Error('Respuesta no válida de Claude. Prueba otra vez.'); }
}

// Limpieza defensiva: números válidos y no negativos (redondeados a 1 decimal)
const n = (v) => (Number.isFinite(+v) && +v > 0 ? Math.round(+v * 10) / 10 : 0);

// Devuelve { alimentos: [{nombre, gramos, kcal, prot, hc, grasa, fibra}], confianza, comentario }
export async function estimarPlato({ clave, fotoDataUrl, descripcion }) {
  const res = await preguntar({ clave, sistema: SISTEMA, esquema: ESQUEMA, fotoDataUrl,
    texto: `Descripción: ${descripcion || '(sin descripción, usa solo la foto)'}` });
  return {
    confianza: res.confianza,
    comentario: String(res.comentario || ''),
    alimentos: (res.alimentos || []).map(a => ({
      nombre: String(a.nombre || 'Alimento').slice(0, 80),
      gramos: n(a.gramos), kcal: n(a.kcal), prot: n(a.prot), hc: n(a.hc), grasa: n(a.grasa), fibra: n(a.fibra),
    })),
  };
}

// Foto de la tabla nutricional → valores por 100 g listos para el formulario de alimento
export async function leerEtiqueta({ clave, fotoDataUrl }) {
  const e = await preguntar({ clave, sistema: SISTEMA_ETIQUETA, esquema: ESQUEMA_ETIQUETA, fotoDataUrl, texto: 'Lee esta tabla nutricional.' });
  const racionG = n(e.racion_g);
  return {
    legible: e.legible !== false,
    nombre: String(e.nombre || '').slice(0, 80),
    kcal: n(e.kcal), prot: n(e.prot), hc: n(e.hc), grasa: n(e.grasa), fibra: n(e.fibra),
    racion: racionG > 0 ? { nombre: String(e.racion_nombre || '1 ración').slice(0, 40), g: racionG } : null,
  };
}
