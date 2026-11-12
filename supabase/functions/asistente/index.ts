// Función «asistente» de Supabase (Deno): recibe la pregunta del tablero y la respuesta que el tablero ya calculó,
// y le pide a Gemini que la redacte usando SOLO esos datos. La clave de Gemini vive acá como secreto, nunca en el navegador.
//
// Secretos (Supabase → Edge Functions → Secrets, o `supabase secrets set`):
//   GEMINI_API_KEY   clave de Google AI Studio (obligatoria)
//   GEMINI_MODEL     opcional, por defecto gemini-flash-latest
//   ORIGENES         opcional, dominios que pueden llamar, separados por coma
//                    (por defecto https://solbus.online; sumar la dirección de Railway mientras se prueba)
const KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-flash-latest';
const ORIGENES = (Deno.env.get('ORIGENES') ?? 'https://solbus.online').split(',').map((s) => s.trim()).filter(Boolean);

const SISTEMA = `Sos el asistente del Tablero Gerencial de Solbus (transporte urbano de pasajeros con bases en Córdoba, Comodoro, San Luis y Villa Mercedes).
Respondés a gerentes en español rioplatense, claro y directo.
Reglas:
- Usá SOLO los datos que vienen en el mensaje (RESPUESTA DEL TABLERO, TABLA y CONTEXTO). No inventes números, fechas, nombres ni causas.
- Si la RESPUESTA DEL TABLERO trae un número, ese es el número correcto: no lo cambies ni lo recalcules.
- Si algo no está en los datos, decí que el tablero no tiene ese dato.
- Podés comparar, ordenar y señalar qué está fuera de objetivo, siempre con los números provistos.
- Nunca hables de bases de datos, conexiones, fuentes, tablas, Supabase, datos de demostración ni de cómo se cargan los datos. Si te lo preguntan, respondé que eso lo gestiona el área de Sistemas.
- Formato: máximo 130 palabras. Usá **negrita** para los números clave y líneas que empiecen con «• » para listas. Sin títulos, sin tablas, sin emojis.`;

const hits = new Map<string, number[]>();
const limitado = (ip: string) => { const now = Date.now(); const h = (hits.get(ip) ?? []).filter((t) => now - t < 60_000); h.push(now); hits.set(ip, h); return h.length > 20; };

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? '';
  const permitido = ORIGENES.includes('*') || ORIGENES.includes(origin);
  const cors = { 'access-control-allow-origin': permitido ? origin || '*' : ORIGENES[0], 'access-control-allow-headers': 'authorization, apikey, content-type', 'access-control-allow-methods': 'POST, OPTIONS', vary: 'origin' };
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'content-type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'método no permitido' }, 405);
  if (!permitido) return json({ error: 'origen no permitido' }, 403);
  if (!KEY) return json({ error: 'falta GEMINI_API_KEY' }, 500);
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'x';
  if (limitado(ip)) return json({ error: 'demasiadas consultas, esperá un minuto' }, 429);

  let b: { pregunta?: string; respuestaTablero?: string; tablaTablero?: { head: string[]; rows: string[][] } | null; contexto?: string; historial?: { q: string; a: string }[] };
  try { b = await req.json(); } catch { return json({ error: 'cuerpo inválido' }, 400); }
  const pregunta = String(b.pregunta ?? '').slice(0, 300).trim();
  if (!pregunta) return json({ error: 'falta la pregunta' }, 400);
  const tabla = b.tablaTablero?.head ? [b.tablaTablero.head.join(' | '), ...(b.tablaTablero.rows ?? []).slice(0, 25).map((r) => r.join(' | '))].join('\n') : '(sin tabla)';
  const historial = (b.historial ?? []).slice(-4).flatMap((t) => [{ role: 'user', parts: [{ text: String(t.q).slice(0, 300) }] }, { role: 'model', parts: [{ text: String(t.a).slice(0, 1500) }] }]);
  const mensaje = `PREGUNTA: ${pregunta}\n\nRESPUESTA DEL TABLERO:\n${String(b.respuestaTablero ?? '').slice(0, 4000)}\n\nTABLA:\n${tabla}\n\nCONTEXTO:\n${String(b.contexto ?? '').slice(0, 30000)}`;

  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY },
    body: JSON.stringify({ system_instruction: { parts: [{ text: SISTEMA }] }, contents: [...historial, { role: 'user', parts: [{ text: mensaje }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 800 } }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return json({ error: `Gemini ${r.status}: ${j?.error?.message ?? 'error'}` }, 502);
  const texto = (j?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('').trim();
  return texto ? json({ texto }) : json({ error: 'Gemini no devolvió texto' }, 502);
});
