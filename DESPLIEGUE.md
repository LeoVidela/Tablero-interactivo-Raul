# Despliegue del Tablero Gerencial

## 1. Railway (pruebas, antes de solbus.online)

El tablero es una página estática: en Railway corre un servidor Node mínimo (`server.mjs`) que usa muy poca memoria.

1. Railway → New → GitHub Repo → `dashboard-transporte` (rama `modernizacion` mientras se prueba).
2. Railway detecta `railway.json`: compila con `npm run build` y arranca con `node server.mjs`.
3. Variables del servicio:
   - `SUPABASE_URL` = `https://xxxx.supabase.co`
   - `SUPABASE_ANON_KEY` = clave pública **anon** (nunca la service_role)
   - `ASISTENTE_IA` = `0` si se quiere apagar Gemini
   Sin variables, el tablero arranca en modo demostración.
4. Settings → Networking → Generate Domain → queda una dirección `*.up.railway.app` para probar.

Cuando se apruebe, se apunta `solbus.online` (o `tablero.solbus.online`) a ese servicio: Settings → Networking → Custom Domain, y en DonWeb se carga el registro CNAME que indica Railway.

## 2. Hosting estático (DonWeb u otro)

`npm run build` → subir el contenido de `dist/` y editar `config.js` con la dirección y la clave pública de Supabase.

## 3. Asistente con Gemini (opcional)

El navegador nunca tiene la clave de Gemini: la guarda una función de Supabase.

1. Sacar una clave en Google AI Studio (aistudio.google.com → Get API key). El plan Google AI Pro no trae clave de API, pero la capa gratuita de la API alcanza para mostrar la funcionalidad. En la capa gratuita Google puede usar las consultas para mejorar sus productos; por eso al asistente solo le llegan totales por base y mes, nunca nombres, DNI ni legajos.
2. Supabase → Edge Functions → crear la función `asistente` con el contenido de `supabase/functions/asistente/index.ts`
   (o con la CLI: `supabase functions deploy asistente`).
3. Supabase → Edge Functions → Secrets:
   - `GEMINI_API_KEY` = la clave de AI Studio
   - `ORIGENES` = `https://solbus.online,https://<tu-servicio>.up.railway.app`
   - `GEMINI_MODEL` = opcional (por defecto `gemini-flash-latest`)
4. Listo: si el tablero está conectado a Supabase, el asistente usa la función automáticamente. Si la función falla o no existe, responde igual con el cálculo local.

Cómo responde: el tablero calcula la respuesta (los números son siempre los del tablero) y Gemini la redacta y puede comparar o explicar usando un resumen de indicadores. Las consultas sobre personas (legajos, choferes, mecánicos) no se mandan a Gemini.

## 4. Modo Sistemas

Gerencia no ve el estado de la conexión, qué datos son de demostración, el panel «Fuente de datos» ni las preguntas técnicas del asistente.
Para verlos en un equipo: entrar una vez con `?sistemas=1` al final de la dirección. Se apaga con `?sistemas=0`.
Ordena la vista; la protección real de los datos son los permisos de Supabase (el navegador solo puede ejecutar `tablero_snapshot()`).
