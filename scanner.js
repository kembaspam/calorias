// Escáner de códigos de barras y consulta a Open Food Facts.
// Usa html5-qrcode: aprovecha BarcodeDetector cuando el navegador lo tiene (Android/Chrome)
// y si no (iPhone/Safari) lee el código con su propio motor.
const LIBRERIA = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
// Huella de la versión exacta: si alguien cambiara el archivo en el CDN, el navegador no lo ejecutaría
const HUELLA = 'sha384-c9d8RFSL+u3exBOJ4Yp3HUJXS4znl9f+z66d1y54ig+ea249SpqR+w1wyvXz/lk+';

let carga;
function cargarLibreria() {
  return carga ??= new Promise((ok, ko) => {
    const s = document.createElement('script');
    Object.assign(s, { src: LIBRERIA, integrity: HUELLA, crossOrigin: 'anonymous' });
    s.onload = () => ok(window.__Html5QrcodeLibrary__);
    s.onerror = () => { carga = null; ko(new Error('no se pudo cargar el escáner (¿sin internet?)')); };
    document.head.append(s);
  });
}

let lector = null; // escáner activo, para poder apagar la cámara

// Enciende la cámara dentro del elemento con ese id y llama a alLeer(codigo) una sola vez
export async function iniciarEscaner(idElemento, alLeer) {
  const { Html5Qrcode, Html5QrcodeSupportedFormats: F } = await cargarLibreria();
  const l = new Html5Qrcode(idElemento, {
    formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E],
    useBarCodeDetectorIfSupported: true,
    experimentalFeatures: { useBarCodeDetectorIfSupported: true },
    verbose: false,
  });
  lector = l;
  await l.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 260, height: 140 } }, (codigo) => {
    if (lector !== l) return; // ya leído: ignora lecturas repetidas
    detenerEscaner();
    alLeer(codigo);
  });
  if (lector !== l) l.stop().catch(() => {}); // se cerró la ventana mientras arrancaba
}

export function detenerEscaner() {
  const l = lector;
  lector = null;
  if (l?.isScanning) l.stop().catch(() => {});
}

// Busca el producto. Devuelve null si no existe; los valores que falten quedan vacíos para rellenarlos a mano.
export async function buscarProducto(codigo) {
  const campos = 'product_name,product_name_es,brands,nutriments,serving_quantity,serving_size';
  const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(codigo)}.json?fields=${campos}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('Open Food Facts no responde');
  const d = await r.json();
  if (d.status !== 1 || !d.product) return null;
  const p = d.product, n = p.nutriments || {};
  const valor = (x) => { const v = parseFloat(x); return Number.isFinite(v) && v >= 0 ? Math.round(v * 10) / 10 : undefined; };
  const kj = valor(n.energy_100g); // algunos productos solo traen kJ
  const racion = valor(p.serving_quantity);
  return {
    nombre: [p.product_name_es || p.product_name, p.brands?.split(',')[0]].filter(Boolean).join(' - '),
    kcal: valor(n['energy-kcal_100g']) ?? (kj !== undefined ? Math.round(kj / 4.184) : undefined),
    prot: valor(n.proteins_100g), hc: valor(n.carbohydrates_100g), grasa: valor(n.fat_100g), fibra: valor(n.fiber_100g),
    racion: racion > 0 ? { nombre: String(p.serving_size || '1 ración').slice(0, 40), g: racion } : null,
    codigo, origen: 'escaneado', favorito: false,
  };
}
