// Servidor del tablero para Railway (o cualquier servidor con Node): sirve la carpeta dist
// y arma config.js con las variables de entorno, así no hay que tocar archivos para conectar la base.
//   SUPABASE_URL        https://xxxx.supabase.co   (si no está, el tablero arranca en demostración)
//   SUPABASE_ANON_KEY   clave pública anon         (NUNCA la service_role)
//   ASISTENTE_IA        0 para apagar Gemini aunque haya Supabase
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const ROOT = join(process.cwd(), 'dist');
const PORT = Number(process.env.PORT) || 8080;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webp': 'image/webp' };
const url = process.env.SUPABASE_URL?.trim(); const key = process.env.SUPABASE_ANON_KEY?.trim();
const cfg = { fuente: url && key ? { tipo: 'supabase', url, anonKey: key } : { tipo: 'demo' }, asistente: { ia: process.env.ASISTENTE_IA !== '0' } };
const CONFIG_JS = `window.SOLBUS_CONFIG = ${JSON.stringify(cfg)};\n`;
const SEC = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin', 'x-frame-options': 'SAMEORIGIN' };

http.createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (path === '/config.js') { res.writeHead(200, { ...SEC, 'content-type': 'text/javascript', 'cache-control': 'no-store' }); return res.end(CONFIG_JS); }
  if (path === '/salud') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
  let file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) file = join(ROOT, 'index.html');
  const html = file.endsWith('.html');
  res.writeHead(200, { ...SEC, 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': html ? 'no-cache' : 'public, max-age=31536000, immutable' });
  createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Tablero en el puerto ${PORT} · fuente: ${cfg.fuente.tipo}`));
