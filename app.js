// Interfaz de la app: pestañas, diario, alimentos, recetas y ajustes.
import * as db from './db.js';
import {
  NUTRIENTES, ACTIVIDAD, paraGramos, sumar, gastoDiario, kcalPropuestas, protPropuesta, minimoSaludable,
  objetivosMacros, valoresReceta, fechaISO, sumarDias,
} from './calc.js';

const COMIDAS = { desayuno: 'Desayuno', comida: 'Comida', merienda: 'Merienda', cena: 'Cena', picoteo: 'Picoteo' };
const S = { fecha: fechaISO(), alimentos: [], perfil: null, buscarAl: '' }; // estado en memoria
const $ = (sel) => document.querySelector(sel);
const vista = $('#vista'), hoja = $('#hoja'), hojaC = $('#hoja-c');

// ---------- Utilidades ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`); // texto seguro dentro del HTML
const r0 = (n) => Math.round(n || 0);
const r1 = (n) => Math.round((n || 0) * 10) / 10;
const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : 0; }; // acepta "1,5"
const sinAcentos = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

let temporizador;
// Aviso abajo de la pantalla; usa popover para quedar por encima de las ventanas abiertas.
// shortcut: sin popover (iOS < 17) el aviso no se ve; si molesta, cambiar a alert().
function toast(msg, accion) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>` + (accion ? `<button>${esc(accion.texto)}</button>` : '');
  if (accion) t.querySelector('button').onclick = () => { t.hidePopover?.(); accion.fn(); };
  if (t.matches?.(':popover-open')) t.hidePopover();
  t.showPopover?.();
  clearTimeout(temporizador);
  temporizador = setTimeout(() => t.matches?.(':popover-open') && t.hidePopover(), 4000);
}

// Ventana a pantalla completa. "volver" cambia la ✕ por ‹ para regresar al paso anterior.
function abrirHoja(titulo, html, volver) {
  hojaC.innerHTML = `<div class="cab"><button class="redondo" id="cerrar" aria-label="${volver ? 'Volver' : 'Cerrar'}">${volver ? '‹' : '✕'}</button>
    <h2>${titulo}</h2></div>${html}`;
  $('#cerrar').onclick = volver || cerrarHoja;
  if (!hoja.open) hoja.showModal();
  hoja.scrollTop = 0;
}
const cerrarHoja = () => hoja.close();

async function cargarAlimentos() { S.alimentos = await db.todos('alimentos'); }
async function cargarTodo() { await cargarAlimentos(); S.perfil = await db.uno('ajustes', 'perfil'); }

// ---------- Pestañas ----------
const PANTALLAS = { hoy: pintarHoy, alimentos: pintarAlimentos, ajustes: pintarAjustes };
let pestana = 'hoy';
function ir(p) {
  pestana = p;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === p));
  vista.onclick = vista.oninput = null;
  scrollTo(0, 0);
  PANTALLAS[p]();
}
const refrescar = () => PANTALLAS[pestana]();
$('#tabs').onclick = (e) => { const b = e.target.closest('button'); if (b) ir(b.dataset.tab); };

// ---------- Diario ----------
function anillo(fraccion) {
  const r = 42, largo = 2 * Math.PI * r;
  const color = fraccion > 1 ? 'var(--rojo)' : 'var(--verde)';
  return `<svg width="110" height="110" viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" r="${r}" fill="none" style="stroke:var(--linea)" stroke-width="10"/>
    <circle cx="50" cy="50" r="${r}" fill="none" style="stroke:${color}" stroke-width="10" stroke-linecap="round"
      stroke-dasharray="${largo * Math.min(fraccion, 1)} ${largo}" transform="rotate(-90 50 50)"/>
    <text x="50" y="56" text-anchor="middle" style="fill:var(--texto)" font-size="18" font-weight="700">${r0(fraccion * 100)}%</text></svg>`;
}

const barra = (nombre, valor, objetivo, color) => `<div class="barra">
  <div class="txt"><span>${nombre}</span><span class="suave">${r0(valor)} / ${r0(objetivo)} g</span></div>
  <div class="fondo"><div class="relleno" style="width:${Math.min(100, objetivo ? valor / objetivo * 100 : 0)}%;background:var(--${color})"></div></div></div>`;

const filaEntrada = (e) => `<div class="desliza"><div class="borrar">Borrar</div>
  <div class="entrada" data-entrada="${e.id}">
    <div><div>${esc(e.nombre)}</div><div class="suave peq">${e.g ? r0(e.g) + ' g · ' : ''}P ${r0(e.prot)} · H ${r0(e.hc)} · G ${r0(e.grasa)}</div></div>
    <b>${r0(e.kcal)}</b></div></div>`;

function nombreDia(f) {
  if (f === fechaISO()) return 'Hoy';
  if (f === sumarDias(fechaISO(), -1)) return 'Ayer';
  return new Date(f + 'T12:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

async function pintarHoy() {
  const entradas = await db.delDia(S.fecha);
  const total = sumar(entradas);
  const kcalObj = S.perfil?.objetivoKcal || 2000;
  const macros = objetivosMacros(kcalObj, S.perfil?.objetivoProt || 100);
  const quedan = kcalObj - total.kcal;

  vista.innerHTML = `
    <div class="dia">
      <button class="redondo" data-dia="-1" aria-label="Día anterior">‹</button>
      <div><h2 style="margin:0">${nombreDia(S.fecha)}</h2><input type="date" id="fecha" value="${S.fecha}" aria-label="Elegir día"></div>
      <button class="redondo" data-dia="1" aria-label="Día siguiente">›</button>
    </div>
    ${S.perfil ? '' : '<p class="aviso">Aún no has puesto tu objetivo: ve a Ajustes ⚙️</p>'}
    <section class="tarjeta resumen">
      ${anillo(total.kcal / kcalObj)}
      <div><div class="grande">${r0(Math.abs(quedan))}</div>
        <div>${quedan >= 0 ? 'kcal restantes' : 'kcal por encima'}</div>
        <div class="suave peq">${r0(total.kcal)} de ${r0(kcalObj)} kcal</div></div>
    </section>
    <section class="tarjeta">
      ${barra('Proteínas', total.prot, macros.prot, 'prot')}${barra('Hidratos', total.hc, macros.hc, 'hc')}
      ${barra('Grasas', total.grasa, macros.grasa, 'grasa')}${barra('Fibra', total.fibra, macros.fibra, 'fibra')}
    </section>
    ${Object.entries(COMIDAS).map(([c, nombre]) => {
      const lista = entradas.filter(e => e.comida === c);
      return `<section class="tarjeta">
        <div class="cab-comida"><h3>${nombre} <span class="suave peq">${r0(sumar(lista).kcal)} kcal</span></h3>
          <button class="redondo" data-copiar="${c}" aria-label="Copiar ${nombre} de otro día">⧉</button>
          <button class="redondo prin" data-anadir="${c}" aria-label="Añadir a ${nombre}">+</button></div>
        ${lista.map(filaEntrada).join('')}</section>`;
    }).join('')}
    <p class="suave peq" style="text-align:center">Toca un alimento para cambiar la cantidad · desliza a la izquierda para borrar · ⧉ copia de otro día</p>`;

  vista.onclick = (e) => {
    const b = e.target.closest('[data-dia],[data-anadir],[data-copiar],[data-entrada]');
    if (!b) return;
    if (b.dataset.dia) { S.fecha = sumarDias(S.fecha, +b.dataset.dia); pintarHoy(); }
    else if (b.dataset.anadir) anadirA(b.dataset.anadir);
    else if (b.dataset.copiar) copiarComida(b.dataset.copiar);
    else editarEntrada(+b.dataset.entrada);
  };
  $('#fecha').onchange = (e) => { if (e.target.value) { S.fecha = e.target.value; pintarHoy(); } };
  activarDeslizar();
}

// Deslizar una entrada a la izquierda más de un tercio de su ancho la borra
function activarDeslizar() {
  vista.querySelectorAll('.entrada').forEach(fila => {
    let x0 = 0, dx = 0;
    fila.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; dx = 0; fila.style.transition = 'none'; }, { passive: true });
    fila.addEventListener('touchmove', (e) => { dx = Math.min(0, e.touches[0].clientX - x0); fila.style.transform = `translateX(${dx}px)`; }, { passive: true });
    fila.addEventListener('touchend', () => {
      fila.style.transition = '';
      if (dx < -fila.offsetWidth / 3) { fila.style.transform = 'translateX(-100%)'; borrarEntrada(+fila.dataset.entrada); }
      else fila.style.transform = '';
    });
  });
}

async function borrarEntrada(id) {
  const e = await db.uno('entradas', id);
  await db.borrar('entradas', id);
  pintarHoy();
  toast(`${e.nombre} borrado`, { texto: 'Deshacer', fn: async () => { await db.guardar('entradas', e); pintarHoy(); } });
}

function anadirA(comida) {
  const titulo = 'Añadir a ' + COMIDAS[comida].toLowerCase();
  const buscar = () => elegirAlimento(titulo,
    (a) => pedirCantidad(a, { volver: buscar }, (g) => nuevaEntrada(comida, a, g)),
    { rapido: () => anadidoRapido(comida, buscar) });
  buscar();
}

async function nuevaEntrada(comida, a, g) {
  // Se guarda una copia de los valores: si luego editas el alimento, los días pasados no cambian
  await db.guardar('entradas', { fecha: S.fecha, comida, nombre: a.nombre, g, ...paraGramos(a, g), alimentoId: a.id });
  await db.guardar('alimentos', { ...a, ultimoUso: Date.now() });
  await cargarAlimentos();
  cerrarHoja();
  pintarHoy();
  toast(`${a.nombre} añadido`);
}

function anadidoRapido(comida, volver) {
  abrirHoja('Añadido rápido', `
    <label for="rn">Nombre</label><input id="rn" placeholder="Café con leche">
    <label for="rk">Kcal</label><input id="rk" inputmode="numeric" placeholder="60">
    <button class="prin" id="ok" style="width:100%;margin-top:16px">Añadir</button>`, volver);
  $('#ok').onclick = async () => {
    const kcal = num($('#rk').value);
    if (kcal <= 0) return toast('Pon las kcal');
    await db.guardar('entradas', { fecha: S.fecha, comida, nombre: $('#rn').value.trim() || 'Añadido rápido', g: null, kcal, prot: 0, hc: 0, grasa: 0, fibra: 0 });
    cerrarHoja();
    pintarHoy();
  };
}

async function editarEntrada(id) {
  const e = await db.uno('entradas', id);
  abrirHoja(esc(e.nombre), (e.g
    ? `<label for="eg">Cantidad (g)</label><input id="eg" inputmode="decimal" value="${r1(e.g)}">`
    : `<label for="en">Nombre</label><input id="en" value="${esc(e.nombre)}">
       <label for="ek">Kcal</label><input id="ek" inputmode="numeric" value="${r0(e.kcal)}">`)
    + `<div class="fila-botones"><button class="peligro" id="del">Borrar</button><button class="prin" id="ok">Guardar</button></div>`);
  $('#del').onclick = () => { cerrarHoja(); borrarEntrada(id); };
  $('#ok').onclick = async () => {
    if (e.g) {
      const g = num($('#eg').value);
      if (g <= 0) return toast('Pon una cantidad');
      NUTRIENTES.forEach(k => { e[k] = e[k] * g / e.g; }); // proporcional a la cantidad nueva
      e.g = g;
    } else {
      e.kcal = num($('#ek').value);
      e.nombre = $('#en').value.trim() || e.nombre;
    }
    await db.guardar('entradas', e);
    cerrarHoja();
    pintarHoy();
  };
}

function copiarComida(comida) {
  let lista = [];
  abrirHoja(`Copiar ${COMIDAS[comida].toLowerCase()}`, `
    <label for="cf">¿De qué día?</label><input type="date" id="cf" value="${sumarDias(S.fecha, -1)}">
    <div id="cprev" class="tarjeta" style="margin-top:12px"></div>
    <button class="prin" id="ok" style="width:100%">Copiar a ${nombreDia(S.fecha).toLowerCase()}</button>`);
  const verPrevia = async () => {
    lista = (await db.delDia($('#cf').value)).filter(e => e.comida === comida);
    $('#cprev').innerHTML = lista.length
      ? lista.map(e => `<div>${esc(e.nombre)} <span class="suave">${r0(e.kcal)} kcal</span></div>`).join('')
      : '<span class="suave">Ese día no hay nada en esta comida.</span>';
  };
  $('#cf').onchange = verPrevia;
  verPrevia();
  $('#ok').onclick = async () => {
    if (!lista.length) return;
    for (const { id, ...e } of lista) await db.guardar('entradas', { ...e, fecha: S.fecha });
    cerrarHoja();
    pintarHoy();
    toast(`Copiados ${lista.length} alimentos`);
  };
}

// ---------- Elegir alimento y cantidad (diario y recetas) ----------
function filtrar(texto) {
  const palabras = sinAcentos(texto).split(/\s+/).filter(Boolean);
  return S.alimentos
    .filter(a => palabras.every(p => sinAcentos(a.nombre).includes(p)))
    .map(a => [!sinAcentos(a.nombre).startsWith(palabras[0] ?? ''), a]) // primero los que empiezan por lo buscado
    .sort(([px, x], [py, y]) => px - py || x.nombre.localeCompare(y.nombre, 'es'))
    .map(([, a]) => a);
}

const itemAlimento = (a) => `<button class="item" data-al="${a.id}"><span>${esc(a.nombre)}</span>
  <span class="suave peq">${a.origen === 'receta' ? r0(a.kcal * a.racion.g / 100) + ' kcal/ración' : r0(a.kcal) + ' kcal/100 g'}</span></button>`;

function listaElegir(texto) {
  if (texto.trim()) return filtrar(texto).map(itemAlimento).join('')
    || '<p class="suave">No está en tu base. Créalo en la pestaña Alimentos o usa el añadido rápido.</p>';
  const favoritos = S.alimentos.filter(a => a.favorito);
  const recientes = S.alimentos.filter(a => a.ultimoUso && !a.favorito).sort((a, b) => b.ultimoUso - a.ultimoUso).slice(0, 10);
  const bloque = (titulo, l) => l.length ? `<div class="titulo-lista">${titulo}</div>` + l.map(itemAlimento).join('') : '';
  return bloque('★ Favoritos', favoritos) + bloque('🕒 Recientes', recientes) + bloque('Todos', filtrar(''));
}

function elegirAlimento(titulo, alElegir, { volver, rapido } = {}) {
  abrirHoja(titulo, `<input id="buscar" type="search" placeholder="Buscar alimento…" autocomplete="off">
    ${rapido ? '<div class="fila-botones"><button id="rapido">⚡ Añadido rápido</button></div>' : ''}
    <div id="res" style="margin-top:10px"></div>`, volver);
  const pintar = () => { $('#res').innerHTML = listaElegir($('#buscar').value); };
  $('#buscar').oninput = pintar;
  pintar();
  $('#res').onclick = (e) => { const b = e.target.closest('[data-al]'); if (b) alElegir(S.alimentos.find(a => a.id === +b.dataset.al)); };
  if (rapido) $('#rapido').onclick = rapido;
}

// Cantidad en gramos o en raciones ("2 huevos") con la previsualización de kcal
function pedirCantidad(a, { volver, boton = 'Añadir' }, alAceptar) {
  const hayRacion = a.racion?.g > 0;
  let porRacion = hayRacion;
  abrirHoja(esc(a.nombre), `
    <p class="suave peq">Por 100 g: ${r0(a.kcal)} kcal · P ${r1(a.prot)} · H ${r1(a.hc)} · G ${r1(a.grasa)} · Fibra ${r1(a.fibra)}</p>
    ${hayRacion ? `<div class="fila-botones"><button id="m-rac">${esc(a.racion.nombre)} (${r0(a.racion.g)} g)</button><button id="m-g">Gramos</button></div>` : ''}
    <label for="cant" id="cant-l"></label><input id="cant" inputmode="decimal">
    <p id="prev" style="font-size:22px;font-weight:700"></p>
    <button class="prin" id="ok" style="width:100%">${boton}</button>`, volver);
  const gramos = () => num($('#cant').value) * (porRacion ? a.racion.g : 1);
  const previa = () => { $('#prev').textContent = `${r0(paraGramos(a, gramos()).kcal)} kcal · ${r0(gramos())} g`; };
  const modo = (racion) => {
    porRacion = racion;
    $('#cant').value = racion ? 1 : 100;
    $('#cant-l').textContent = racion ? `Número de raciones (${a.racion.nombre})` : 'Gramos';
    if (hayRacion) { $('#m-rac').classList.toggle('prin', racion); $('#m-g').classList.toggle('prin', !racion); }
    previa();
  };
  modo(porRacion);
  if (hayRacion) { $('#m-rac').onclick = () => modo(true); $('#m-g').onclick = () => modo(false); }
  $('#cant').oninput = previa;
  $('#ok').onclick = () => (gramos() > 0 ? alAceptar(gramos()) : toast('Pon una cantidad'));
}

// ---------- Base de alimentos ----------
function pintarAlimentos() {
  vista.innerHTML = `<h2>Mis alimentos</h2>
    <div class="fila-botones"><button class="prin" id="nuevo">+ Alimento</button><button class="prin" id="receta">+ Receta</button></div>
    <input id="buscar-al" type="search" placeholder="Buscar…" autocomplete="off" value="${esc(S.buscarAl)}">
    <div id="lista-al" style="margin-top:10px"></div>`;
  const pintar = () => {
    S.buscarAl = $('#buscar-al').value;
    $('#lista-al').innerHTML = filtrar(S.buscarAl).map(a => `<div class="item-fila">
      <button class="estrella ${a.favorito ? 'on' : ''}" data-fav="${a.id}" aria-label="Favorito: ${esc(a.nombre)}" aria-pressed="${!!a.favorito}">★</button>
      ${itemAlimento(a)}</div>`).join('');
  };
  pintar();
  $('#buscar-al').oninput = pintar;
  $('#nuevo').onclick = () => editarAlimento({});
  $('#receta').onclick = () => editarReceta({});
  $('#lista-al').onclick = async (e) => {
    const fav = e.target.closest('[data-fav]'), item = e.target.closest('[data-al]');
    if (fav) {
      const a = S.alimentos.find(x => x.id === +fav.dataset.fav);
      await db.guardar('alimentos', { ...a, favorito: !a.favorito });
      await cargarAlimentos();
      pintar();
    } else if (item) editarAlimento(S.alimentos.find(x => x.id === +item.dataset.al));
  };
}

function editarAlimento(a) {
  if (a.origen === 'receta') return editarReceta(a);
  const campo = (k, texto) => `<div><label for="f-${k}">${texto}</label><input id="f-${k}" inputmode="decimal" value="${a[k] ?? ''}"></div>`;
  abrirHoja(a.id ? 'Editar alimento' : 'Nuevo alimento', `
    <label for="f-nombre">Nombre</label><input id="f-nombre" value="${esc(a.nombre)}">
    <p class="suave peq">Valores por 100 g (vienen en la etiqueta)</p>
    <div class="rejilla">${campo('kcal', 'Kcal')}${campo('prot', 'Proteínas (g)')}${campo('hc', 'Hidratos (g)')}${campo('grasa', 'Grasas (g)')}${campo('fibra', 'Fibra (g)')}</div>
    <p class="suave peq">Ración o unidad (opcional). Ejemplo: «1 huevo» = 60 g</p>
    <div class="rejilla">
      <div><label for="f-rn">Nombre</label><input id="f-rn" value="${esc(a.racion?.nombre)}" placeholder="1 unidad"></div>
      <div><label for="f-rg">Gramos</label><input id="f-rg" inputmode="decimal" value="${a.racion?.g ?? ''}"></div></div>
    <div class="fila-botones">${a.id ? '<button class="peligro" id="del">Borrar</button>' : ''}<button class="prin" id="ok">Guardar</button></div>`);
  $('#ok').onclick = async () => {
    const nombre = $('#f-nombre').value.trim();
    if (!nombre) return toast('Ponle un nombre');
    const rg = num($('#f-rg').value);
    await db.guardar('alimentos', {
      ...a, nombre, ...Object.fromEntries(NUTRIENTES.map(k => [k, num($(`#f-${k}`).value)])),
      racion: rg > 0 ? { nombre: $('#f-rn').value.trim() || '1 ración', g: rg } : null,
      origen: a.origen || 'propio', favorito: !!a.favorito,
    });
    await cargarAlimentos();
    cerrarHoja();
    refrescar();
  };
  if (a.id) $('#del').onclick = () => borrarAlimento(a);
}

async function borrarAlimento(a) {
  if (!confirm(`¿Borrar «${a.nombre}»? Lo que ya apuntaste en el diario no cambia.`)) return;
  await db.borrar('alimentos', a.id);
  await cargarAlimentos();
  cerrarHoja();
  refrescar();
}

// Receta: cada ingrediente guarda sus valores por 100 g, así no depende de que el alimento siga existiendo
function editarReceta(a) {
  const r = { nombre: a.nombre || '', raciones: a.raciones || 1, ingredientes: structuredClone(a.ingredientes || []) };
  const pintar = () => {
    abrirHoja(a.id ? 'Editar receta' : 'Nueva receta', `
      <label for="r-nombre">Nombre</label><input id="r-nombre" value="${esc(r.nombre)}" placeholder="Mi tortilla de patatas">
      <label for="r-rac">¿Cuántas raciones salen?</label><input id="r-rac" inputmode="decimal" value="${r.raciones}">
      <div class="titulo-lista">Ingredientes</div>
      <div id="r-ings">${r.ingredientes.map((i, n) => `<div class="ingrediente"><span>${esc(i.nombre)}</span>
        <input inputmode="decimal" data-n="${n}" value="${r1(i.g)}" aria-label="Gramos de ${esc(i.nombre)}"> g
        <button class="redondo" data-quitar="${n}" aria-label="Quitar ${esc(i.nombre)}">✕</button></div>`).join('')}</div>
      <button id="r-mas" style="width:100%">+ Ingrediente</button>
      <p id="r-res" class="tarjeta" style="margin-top:12px"></p>
      <div class="fila-botones">${a.id ? '<button class="peligro" id="del">Borrar</button>' : ''}<button class="prin" id="ok">Guardar</button></div>`);
    const resumen = () => {
      const v = valoresReceta(r.ingredientes, r.raciones);
      $('#r-res').innerHTML = `Total: ${r0(v.kcalTotal)} kcal en ${r0(v.pesoTotal)} g<br>
        <b>Cada ración (${v.racion.g} g): ${r0(v.kcalTotal / r.raciones)} kcal</b>`;
    };
    resumen();
    $('#r-nombre').oninput = (e) => { r.nombre = e.target.value; };
    $('#r-rac').oninput = (e) => { r.raciones = Math.max(1, num(e.target.value)); resumen(); };
    $('#r-ings').oninput = (e) => { r.ingredientes[e.target.dataset.n].g = num(e.target.value); resumen(); };
    $('#r-ings').onclick = (e) => {
      const b = e.target.closest('[data-quitar]');
      if (b) { r.ingredientes.splice(+b.dataset.quitar, 1); pintar(); }
    };
    $('#r-mas').onclick = () => elegirAlimento('Añadir ingrediente',
      (ing) => pedirCantidad(ing, { volver: pintar, boton: 'Añadir a la receta' }, (g) => {
        r.ingredientes.push({ alimentoId: ing.id, nombre: ing.nombre, g, ...Object.fromEntries(NUTRIENTES.map(k => [k, ing[k] || 0])) });
        pintar();
      }), { volver: pintar });
    $('#ok').onclick = async () => {
      if (!r.nombre.trim() || !r.ingredientes.length) return toast('Pon un nombre y al menos un ingrediente');
      const { pesoTotal, kcalTotal, ...valores } = valoresReceta(r.ingredientes, r.raciones);
      await db.guardar('alimentos', { ...a, ...valores, nombre: r.nombre.trim(), raciones: r.raciones,
        ingredientes: r.ingredientes, origen: 'receta', favorito: !!a.favorito });
      await cargarAlimentos();
      cerrarHoja();
      refrescar();
    };
    if (a.id) $('#del').onclick = () => borrarAlimento(a);
  };
  pintar();
}

// ---------- Ajustes ----------
function pintarAjustes() {
  const p = S.perfil || { sexo: 'h', actividad: 'ligero' };
  const opciones = (obj, elegido) => Object.entries(obj).map(([k, t]) => `<option value="${k}" ${k === elegido ? 'selected' : ''}>${t}</option>`).join('');
  const campo = (k, texto, teclado = 'decimal') => `<div><label for="p-${k}">${texto}</label><input id="p-${k}" inputmode="${teclado}" value="${p[k] || ''}"></div>`;
  vista.innerHTML = `<h2>Ajustes</h2>
    <section class="tarjeta"><h3>Tus datos</h3>
      <div class="rejilla">
        <div><label for="p-sexo">Sexo</label><select id="p-sexo">${opciones({ h: 'Hombre', m: 'Mujer' }, p.sexo)}</select></div>
        ${campo('edad', 'Edad', 'numeric')}${campo('altura', 'Altura (cm)', 'numeric')}${campo('peso', 'Peso actual (kg)')}
        ${campo('pesoObjetivo', 'Peso objetivo (kg)')}</div>
      <label for="p-actividad">Actividad</label>
      <select id="p-actividad">${opciones(Object.fromEntries(Object.entries(ACTIVIDAD).map(([k, v]) => [k, v.texto])), p.actividad)}</select>
      <p id="p-calc" class="suave"></p></section>
    <section class="tarjeta"><h3>Tu objetivo diario</h3>
      <div class="rejilla">${campo('objetivoKcal', 'Kcal', 'numeric')}${campo('objetivoProt', 'Proteína (g)', 'numeric')}</div>
      <button id="p-usar" style="width:100%;margin-top:10px">Usar la propuesta</button>
      <p id="p-aviso" class="aviso" hidden></p>
      <button class="prin" id="p-ok" style="width:100%;margin-top:10px">Guardar</button></section>
    <section class="tarjeta"><h3>Copia de seguridad</h3>
      <p class="suave peq">Guarda tus datos en un archivo para no perderlos si cambias de móvil o borras el navegador. Hazla de vez en cuando.</p>
      <div class="fila-botones"><button id="exp">Exportar</button><button id="imp">Importar</button></div>
      <input type="file" id="imp-f" accept="application/json,.json" hidden></section>`;

  const leer = () => ({
    sexo: $('#p-sexo').value, actividad: $('#p-actividad').value,
    ...Object.fromEntries(['edad', 'altura', 'peso', 'pesoObjetivo', 'objetivoKcal', 'objetivoProt'].map(k => [k, num($(`#p-${k}`).value)])),
  });
  const completo = (d) => d.edad > 0 && d.altura > 0 && d.peso > 0;
  const actualizar = () => {
    const d = leer(), minimo = minimoSaludable(d.sexo);
    $('#p-calc').innerHTML = completo(d)
      ? `Gastas unas <b>${r0(gastoDiario(d))} kcal</b> al día.<br>Propuesta para bajar ~0,5 kg/semana: <b>${kcalPropuestas(d)} kcal</b> y <b>${protPropuesta(d)} g de proteína</b>.`
      : 'Rellena edad, altura y peso para calcular tu propuesta.';
    $('#p-aviso').hidden = !(d.objetivoKcal > 0 && d.objetivoKcal < minimo);
    $('#p-aviso').textContent = `⚠️ Menos de ${minimo} kcal al día es demasiado poco para hacerlo por tu cuenta: cuesta cubrir los nutrientes y se pierde músculo. Mejor consúltalo con un profesional.`;
  };
  vista.oninput = actualizar;
  actualizar();
  $('#p-usar').onclick = () => {
    const d = leer();
    if (!completo(d)) return toast('Rellena primero edad, altura y peso');
    $('#p-objetivoKcal').value = kcalPropuestas(d);
    $('#p-objetivoProt').value = protPropuesta(d);
    actualizar();
  };
  $('#p-ok').onclick = async () => {
    const d = leer();
    if (!(d.objetivoKcal > 0)) return toast('Pon tu objetivo de kcal (o pulsa «Usar la propuesta»)');
    await db.guardar('ajustes', d, 'perfil');
    S.perfil = d;
    toast('Guardado');
  };
  $('#exp').onclick = exportarCopia;
  $('#imp').onclick = () => $('#imp-f').click();
  $('#imp-f').onchange = importarCopia;
}

async function exportarCopia() {
  const archivo = new File([JSON.stringify(await db.exportar())], `calorias-${fechaISO()}.json`, { type: 'application/json' });
  // En el móvil abre «Compartir» (guardar en Archivos, Drive, enviarlo...); si no se puede, lo descarga
  try {
    if (navigator.canShare?.({ files: [archivo] })) return await navigator.share({ files: [archivo] });
  } catch (e) {
    if (e.name === 'AbortError') return; // has cancelado
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(archivo);
  a.download = archivo.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

async function importarCopia(e) {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const datos = JSON.parse(await f.text());
    if (!confirm('Esto REEMPLAZA todos los datos de la app por los de la copia. ¿Seguir?')) return;
    await db.importar(datos);
    await cargarTodo();
    toast('Copia restaurada');
    ir('hoy');
  } catch (err) {
    alert('No se pudo importar: ' + err.message);
  }
}

// ---------- Arranque ----------
navigator.storage?.persist?.(); // pide al navegador que no borre los datos aunque falte espacio
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
// Si la app se queda abierta de un día para otro, al volver muestra el día nuevo
let hoyAlAbrir = fechaISO();
document.addEventListener('visibilitychange', () => {
  if (document.hidden || fechaISO() === hoyAlAbrir) return;
  if (S.fecha === hoyAlAbrir) S.fecha = fechaISO();
  hoyAlAbrir = fechaISO();
  if (pestana === 'hoy') pintarHoy();
});
await cargarTodo();
ir(S.perfil ? 'hoy' : 'ajustes');
