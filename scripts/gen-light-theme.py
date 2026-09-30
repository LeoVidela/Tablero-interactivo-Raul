#!/usr/bin/env python3
"""Genera src/theme-light.css a partir de las hojas oscuras (styles.css, taller.css, g/views.css).

Cada regla que usa colores se re-emite bajo :root[data-theme="light"] con:
  - neutros (grises azulados, blancos, superficies oscuras) invertidos en luminosidad;
  - sombras / fondos de modal negros más suaves;
  - colores pastel usados como texto oscurecidos para mantener contraste;
  - el texto blanco sobre botones de color (naranja, verde, rojo…) se mantiene.
Volver a correrlo después de tocar los estilos:  python3 scripts/gen-light-theme.py
"""
import colorsys, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCES = ['src/styles.css', 'src/taller.css', 'src/g/views.css']
OUT = ROOT / 'src/theme-light.css'
P = ':root[data-theme="light"]'
COLOR_RE = re.compile(r'#[0-9a-fA-F]{3,8}\b|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*[\d.]+\s*)?\)')

def parse_color(t):
    if t.startswith('#'):
        h = t[1:]
        if len(h) in (3, 4): h = ''.join(c * 2 for c in h)
        if len(h) not in (6, 8): return None
        r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
        a = int(h[6:8], 16) / 255 if len(h) == 8 else 1.0
        return r, g, b, a
    nums = [float(x) for x in re.findall(r'[\d.]+', t)]
    return (*nums[:3], nums[3] if len(nums) > 3 else 1.0)

def fmt(r, g, b, a):
    r, g, b = (max(0, min(255, round(v))) for v in (r, g, b))
    return f'rgba({r},{g},{b},{round(a, 3)})' if a < 0.999 else f'#{r:02x}{g:02x}{b:02x}'

def convert(t, prop, keep_white):
    c = parse_color(t)
    if not c: return t
    r, g, b, a = c
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    sat = (max(r, g, b) - min(r, g, b)) / 255
    is_text = prop in ('color', 'fill', 'caret-color', '-webkit-text-fill-color')
    if keep_white and is_text and l > 0.9: return t
    if sat < 0.28:  # neutro
        if l < 0.035 and a < 1:  # sombra / fondo de modal
            return fmt(r, g, b, a * (0.35 if 'shadow' in prop else 0.55))
        if l < 0.3:  # superficie oscura -> superficie clara
            nl = min(1.0, 0.95 + (l - 0.04) * 0.6)
            s2 = s * 0.5
        else:  # texto / línea clara -> oscura
            nl = max(0.09, 1 - l)
            if is_text and nl > 0.46: nl = 0.46
            s2 = s
        nr, ng, nb = colorsys.hls_to_rgb(h, nl, s2)
        return fmt(nr * 255, ng * 255, nb * 255, a)
    # color saturado
    if l < 0.26 and a >= 0.5:  # superficies de color oscuras (navy, marrón) -> tinte claro
        nr, ng, nb = colorsys.hls_to_rgb(h, 0.93, min(1, s * 0.7))
        return fmt(nr * 255, ng * 255, nb * 255, a)
    if is_text and l > 0.46 and not keep_white:
        nr, ng, nb = colorsys.hls_to_rgb(h, 0.36, s)
        return fmt(nr * 255, ng * 255, nb * 255, a)
    if not is_text and l > 0.7 and a >= 0.5 and 'background' not in prop:
        nr, ng, nb = colorsys.hls_to_rgb(h, 0.42, s)
        return fmt(nr * 255, ng * 255, nb * 255, a)
    return t

def split_blocks(css):
    """Devuelve lista de (prelude, body, is_nested)."""
    out, i, n = [], 0, len(css)
    while i < n:
        j = css.find('{', i)
        if j < 0: break
        prelude = css[i:j].strip()
        depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == '{': depth += 1
            elif css[k] == '}': depth -= 1
            k += 1
        body = css[j + 1:k - 1]
        out.append((prelude, body, '{' in body))
        i = k
    return out

def prefix(sel):
    res = []
    for s in sel.split(','):
        s = s.strip()
        if not s: continue
        if s.startswith(':root'): res.append(P + s[5:])
        elif s in ('html', 'html,body'): res.append(P)
        elif s.startswith('html'): res.append(P + ' ' + s[4:].strip() if s[4:].strip() else P)
        else: res.append(f'{P} {s}')
    return ','.join(res)

def split_decls(body):
    decls, depth, cur = [], 0, ''
    for ch in body:
        if ch == '(': depth += 1
        elif ch == ')': depth -= 1
        if ch == ';' and depth == 0: decls.append(cur); cur = ''
        else: cur += ch
    if cur.strip(): decls.append(cur)
    return [d.strip() for d in decls if ':' in d]

def process_rule(sel, body):
    decls = split_decls(body)
    bgs = ' '.join(d for d in decls if d.split(':', 1)[0].strip().startswith('background'))
    keep_white = False
    for t in COLOR_RE.findall(bgs):
        c = parse_color(t)
        if not c: continue
        r, g, b, a = c
        h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        if (max(r, g, b) - min(r, g, b)) / 255 > 0.35 and 0.3 < l < 0.72 and a > 0.75: keep_white = True
    new = []
    for d in decls:
        prop, val = d.split(':', 1)
        prop = prop.strip()
        if prop.startswith('--') or COLOR_RE.search(val):
            nv = COLOR_RE.sub(lambda m: convert(m.group(0), prop if not prop.startswith('--') else ('color' if 'ink' in prop or 'sub' in prop else 'background'), keep_white), val)
            new.append(f'{prop}:{nv.strip()}')  # también los que no cambian: mantiene el orden de especificidad de las reglas
    return f'{prefix(sel)}{{{";".join(new)}}}' if new else ''

def walk(css):
    out = []
    for prelude, body, nested in split_blocks(css):
        if prelude.startswith('@keyframes') or prelude.startswith('@font-face') or prelude.startswith('@import'): continue
        if prelude.startswith('@media') or prelude.startswith('@supports'):
            inner = walk(body)
            if inner: out.append(f'{prelude}{{{inner}}}')
        elif not nested:
            r = process_rule(prelude, body)
            if r: out.append(r)
    return '\n'.join(out)

css = '\n'.join((ROOT / f).read_text() for f in SOURCES)
css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
extra = f"""
/* ---------- ajustes manuales del modo claro ---------- */
{P}{{color-scheme:light}}
{P} body,{P} .app-shell{{background:#eef1f7}}
{P} .app-shell{{background:radial-gradient(circle at 73% -10%,rgba(232,88,24,.10),transparent 32%),#eef1f7}}
{P} .ambient{{opacity:.05}}
{P} .sidebar{{background:rgba(255,255,255,.86)}}
{P} .panel,{P} .metric-card,{P} .base-card{{box-shadow:0 1px 2px rgba(15,23,42,.05),0 6px 18px rgba(15,23,42,.05)}}
{P} .bus-canvas img{{filter:none}}
{P} .toast{{background:#ecfdf5;color:#047857}}
{P} .avatar,{P} .top-avatar{{background:linear-gradient(135deg,#ff6b1a,#111);color:#fff}}
{P} .brand img{{filter:none}}
{P} .g-alerts-head{{background:linear-gradient(90deg,#0f2a6b,#1e3a8a);color:#fff}}
{P} .g-alerts-head h3{{color:#fff}}{P} .g-alerts-head svg{{color:#fbbf24}}{P} .g-alerts-head button{{background:rgba(255,255,255,.14);color:#fff}}
"""
OUT.write_text('/* Archivo generado por scripts/gen-light-theme.py — no editar a mano. */\n' + walk(css) + '\n' + extra)
print(f'OK {OUT.relative_to(ROOT)} · {OUT.stat().st_size // 1024} KB')
