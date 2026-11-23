# Calorías

App personal para controlar calorías y bajar de peso. Se instala en el móvil desde el navegador y funciona sin internet. Los datos se guardan **solo en tu móvil**: no hay cuentas ni servidor.

## Qué hace (fase 1)
- **Hoy**: calorías consumidas, objetivo y lo que te queda; barras de proteínas, hidratos, grasas y fibra; comidas (desayuno, comida, merienda, cena y picoteo).
  - **+** añade un alimento: buscador con favoritos y recientes, o añadido rápido (nombre + kcal).
  - Toca un alimento para cambiar la cantidad; deslízalo a la izquierda para borrarlo (puedes deshacerlo).
  - **⧉** copia una comida de otro día ("mismo desayuno que ayer").
  - Flechas ‹ › o la fecha para ir a otros días.
- **Alimentos**: 75 alimentos básicos ya cargados (valores aproximados de BEDCA y USDA). Puedes crear, editar y borrar alimentos y recetas, y marcar favoritos con ★.
- **Ajustes**: tus datos, gasto diario (Mifflin-St Jeor), objetivo propuesto con déficit de 500 kcal y proteína (1,6 g/kg), y copia de seguridad (exportar/importar).

## Escáner de códigos de barras (fase 2)
- En **+** (añadir a una comida) pulsa **📷 Escanear** y apunta al código del envase. También puedes escribir el número a mano.
- Los datos salen de **Open Food Facts** (base libre y colaborativa). Revísalos con la etiqueta: si falta algo o el producto no existe, lo rellenas tú.
- Al pulsar **Guardar y seguir** queda guardado en tu base: la próxima vez que lo escanees aparece al momento, sin internet.
- **Sin código de barras** (o si no lo lee): pulsa **📄 Sin código: foto de la tabla nutricional**. Claude lee la etiqueta y rellena kcal, macros y ración por ti; solo revisas y guardas. Usa la clave de Anthropic de la foto con IA. El mismo botón aparece al crear un alimento a mano.
- En la pestaña **Alimentos**, el botón **📷** guarda un producto en tu base sin añadirlo al diario.
- La primera vez el móvil pedirá permiso para usar la cámara: acéptalo. Necesita internet y la app publicada (HTTPS).

## Foto con IA (fase 3)
1. Crea una clave en https://console.anthropic.com → **API Keys** → **Create Key**. Hace falta añadir saldo en **Billing** (con 5 € hay para cientos de fotos: cada una cuesta aprox. 1-2 céntimos).
2. En la app: **Ajustes → Foto con IA**, pega la clave y pulsa **Guardar clave**. Se guarda solo en tu móvil y no va en la copia de seguridad.
3. En **+** (añadir a una comida) pulsa **🤖 Foto IA**, haz la foto, escribe una descripción corta (ej. "lentejas con chorizo, ración normal") y pulsa **Analizar**.
4. Revisa el desglose: cambia los gramos o quita alimentos con ✕. Marca **Guardar también como plato** si lo vas a repetir.
Usa el modelo Claude Sonnet 5.5. Es una estimación: la descripción con cantidades ("2 cucharadas de aceite") la mejora mucho.

## Probarla en el ordenador
```bash
cd ~/proyectos/apps/calorias && python3 -m http.server 8000
```
Abre http://localhost:8000. Pruebas de los cálculos: `node calc.test.js`.

## Publicarla gratis (GitHub Pages)
1. Entra en https://github.com con tu cuenta.
2. Arriba a la derecha, **+ → New repository**. Nombre: `calorias`. Déjalo en **Public** y pulsa **Create repository**.
3. En la página nueva, pulsa **uploading an existing file**.
4. Abre la carpeta **calorias-app** de tu Escritorio de Windows (es una copia lista para subir que Claude actualiza en cada fase). Selecciona **todo lo que hay dentro** (incluida la carpeta `icons`) y arrástralo a la página de GitHub. Pulsa **Commit changes**.
5. Ve a **Settings → Pages**. En *Branch* elige `main` y `/ (root)` y pulsa **Save**.
6. Espera 1-2 minutos. Tu app estará en `https://TU-USUARIO.github.io/calorias/`.

El código queda público, pero **tus datos no**: se guardan solo en tu móvil.

**Actualizar la app**: repite el paso 3 y 4 con los archivos nuevos. GitHub reemplaza los que ya existen. La próxima vez que abras la app con internet, se pondrá al día sola.

## Instalarla en el móvil
- **iPhone (Safari)**: abre la dirección, pulsa el botón **Compartir** (cuadrado con flecha) → **Añadir a pantalla de inicio**.
- **Android (Chrome)**: abre la dirección, menú **⋮** → **Instalar aplicación** (o *Añadir a pantalla de inicio*).

## Copia de seguridad
En **Ajustes → Exportar** se crea un archivo `calorias-FECHA.json`. Guárdalo en Archivos, Drive o mándatelo por correo. Para recuperarlo: **Ajustes → Importar** (reemplaza todos los datos actuales).

## Archivos
| Archivo | Para qué |
|---|---|
| `index.html`, `styles.css` | La página y su aspecto |
| `app.js` | Pantallas y botones |
| `scanner.js` | Cámara y consulta a Open Food Facts |
| `ia.js` | Reduce la foto y pregunta a Claude |
| `db.js` | Guardar datos en el móvil (IndexedDB) y la copia de seguridad |
| `calc.js` | Cálculos (calorías, objetivos, recetas). Probado en `calc.test.js` |
| `alimentos.js` | Los alimentos precargados |
| `sw.js`, `manifest.json`, `icons/` | Para instalarla y usarla sin internet |
| `package.json` | Solo para que `node calc.test.js` funcione |
