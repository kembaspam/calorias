// Acceso a IndexedDB (los datos viven solo en el móvil) + copia de seguridad en JSON.
import { ALIMENTOS_BASE, ANADIDOS } from './alimentos.js';

const ALMACENES = ['alimentos', 'entradas', 'pesos'];
let conexion;

function abrir() {
  return conexion ??= new Promise((ok, ko) => {
    const r = indexedDB.open('calorias', Math.max(...Object.keys(ANADIDOS)));
    r.onupgradeneeded = (e) => {
      const db = r.result;
      if (e.oldVersion < 1) { // primera vez que se abre la app
        const al = db.createObjectStore('alimentos', { keyPath: 'id', autoIncrement: true });
        db.createObjectStore('entradas', { keyPath: 'id', autoIncrement: true }).createIndex('fecha', 'fecha');
        db.createObjectStore('pesos', { keyPath: 'fecha' });
        db.createObjectStore('ajustes'); // clave libre: 'perfil'
        ALIMENTOS_BASE.forEach(a => al.put(a));
      }
      for (const [version, lista] of Object.entries(ANADIDOS)) {
        if (e.oldVersion < version) lista.forEach(a => r.transaction.objectStore('alimentos').put(a));
      }
    };
    r.onsuccess = () => {
      r.result.onversionchange = () => r.result.close(); // deja actualizar la base si se abre una versión nueva de la app
      ok(r.result);
    };
    r.onerror = () => ko(r.error);
  });
}

// Ejecuta una operación sobre un almacén y devuelve su resultado cuando la transacción termina
async function op(almacen, modo, fn) {
  const db = await abrir();
  return new Promise((ok, ko) => {
    const tx = db.transaction(almacen, modo);
    const r = fn(tx.objectStore(almacen));
    tx.oncomplete = () => ok(r.result);
    tx.onerror = () => ko(tx.error);
  });
}

export const todos = (almacen) => op(almacen, 'readonly', s => s.getAll());
export const uno = (almacen, clave) => op(almacen, 'readonly', s => s.get(clave));
export const guardar = (almacen, valor, clave) => op(almacen, 'readwrite', s => s.put(valor, clave));
export const borrar = (almacen, clave) => op(almacen, 'readwrite', s => s.delete(clave));
export const delDia = (fecha) => op('entradas', 'readonly', s => s.index('fecha').getAll(fecha));

// Copia de seguridad: todo menos la API key (para que no viaje en el archivo)
export async function exportar() {
  const datos = { app: 'calorias', version: 1, fecha: new Date().toISOString(), perfil: await uno('ajustes', 'perfil') };
  for (const a of ALMACENES) datos[a] = await todos(a);
  return datos;
}

// Reemplaza todos los datos por los de la copia. Una sola transacción: si algo falla, no se toca nada.
export async function importar(datos) {
  if (datos?.app !== 'calorias' || !ALMACENES.every(a => Array.isArray(datos[a]))) {
    throw new Error('El archivo no es una copia de seguridad de esta app');
  }
  const db = await abrir();
  return new Promise((ok, ko) => {
    const tx = db.transaction([...ALMACENES, 'ajustes'], 'readwrite');
    tx.oncomplete = ok;
    tx.onerror = () => ko(tx.error);
    try {
      for (const a of ALMACENES) {
        tx.objectStore(a).clear();
        datos[a].forEach(v => tx.objectStore(a).put(v));
      }
      if (datos.perfil) tx.objectStore('ajustes').put(datos.perfil, 'perfil');
    } catch (e) {
      tx.abort();
      ko(e);
    }
  });
}
