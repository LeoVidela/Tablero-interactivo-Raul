#!/usr/bin/env python3
"""
Micronauta en vivo para el Tablero Solbus
=========================================

Abre Micronauta con Selenium (un Chrome por flota), inicia sesión, navega a la vista configurada
(Córdoba: Vistas → Vista Corredores · Comodoro: Vistas → Activos) y publica la pantalla en vivo
por HTTP para que la pestaña Tráfico del tablero la muestre:

    http://localhost:8765/status          estado de cada flota (JSON)
    http://localhost:8765/cordoba.png     última captura de Córdoba
    http://localhost:8765/comodoro.png    última captura de Comodoro

Credenciales: archivo .env al lado de este script (ver .env.example). Nunca van al tablero ni al repo.

Uso:
    python micronauta_live.py              # Chrome oculto (headless), sólo para esta PC
    python micronauta_live.py --visible    # muestra las ventanas de Chrome (para ver qué hace)
    python micronauta_live.py --lan        # permite que otras PCs de la red vean el vivo
"""
from __future__ import annotations

import argparse
import json
import os
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from selenium import webdriver
from selenium.common.exceptions import WebDriverException
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By

try:  # webdriver-manager es opcional (Selenium 4.10+ ya trae Selenium Manager)
    from webdriver_manager.chrome import ChromeDriverManager
except ImportError:  # pragma: no cover
    ChromeDriverManager = None

BASE = 'https://micronauta.dnsalias.net/megaweb'
LOGIN_URL = f'{BASE}/psw/login.php?mode=logout'
VIEW_URL = f'{BASE}/vista/topframe_inter.php'
HERE = Path(__file__).resolve().parent


def load_env(path: Path) -> None:
    """Lee KEY=VALUE de .env (sin dependencias externas)."""
    if not path.exists():
        return
    for line in path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


load_env(HERE / '.env')

FEEDS = {
    'cordoba': {
        'label': 'Córdoba',
        'user': os.environ.get('CORDOBA_USER', 'svidela'),
        'password': os.environ.get('CORDOBA_PASSWORD', ''),
        'steps': [s for s in os.environ.get('CORDOBA_PASOS', 'Vistas|Vista Corredores').split('|') if s.strip()],
    },
    'comodoro': {
        'label': 'Comodoro',
        'user': os.environ.get('COMODORO_USER', 'leonardov'),
        'password': os.environ.get('COMODORO_PASSWORD', ''),
        'steps': [s for s in os.environ.get('COMODORO_PASOS', 'Vistas|Activos').split('|') if s.strip()],
    },
}
INTERVAL = float(os.environ.get('INTERVALO_SEGUNDOS', '3'))          # cada cuánto se toma una captura
RELOAD_MIN = float(os.environ.get('RECARGAR_CADA_MINUTOS', '30'))    # recarga preventiva de la vista
WIDTH, HEIGHT = (int(x) for x in os.environ.get('RESOLUCION', '1600x900').lower().split('x'))

LOWER = 'abcdefghijklmnopqrstuvwxyzáéíóúñ'
UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÑ'


class Feed:
    def __init__(self, key: str, cfg: dict, visible: bool):
        self.key, self.cfg, self.visible = key, cfg, visible
        self.driver: webdriver.Chrome | None = None
        self.frame: bytes | None = None
        self.updated = 0.0
        self.state = 'iniciando'
        self.error = ''
        self.lock = threading.Lock()

    # ---------- navegador ----------
    def _new_driver(self) -> webdriver.Chrome:
        opts = webdriver.ChromeOptions()
        if not self.visible:
            opts.add_argument('--headless=new')
        opts.add_argument(f'--window-size={WIDTH},{HEIGHT}')
        opts.add_argument('--disable-gpu')
        opts.add_argument('--no-first-run')
        opts.add_argument('--disable-notifications')
        opts.add_experimental_option('excludeSwitches', ['enable-logging', 'enable-automation'])
        if ChromeDriverManager:
            return webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=opts)
        return webdriver.Chrome(options=opts)

    def _frames(self):
        """Recorre el documento principal y todos los frames/iframes (Micronauta usa frames)."""
        d = self.driver
        def walk(path):
            d.switch_to.default_content()
            for idx in path:
                d.switch_to.frame(idx)
            yield path
            n = len(d.find_elements(By.CSS_SELECTOR, 'iframe,frame'))
            for i in range(n):
                yield from walk(path + [i])
        yield from walk([])

    def _click_text(self, text: str, timeout: float = 20) -> None:
        needle = text.strip().lower()
        lit = f'"{needle}"'
        norm = f"translate(normalize-space(string(.)),'{UPPER}','{LOWER}')"
        xp = f"//*[not(self::script) and not(self::style)][contains({norm},{lit})][not(*[contains({norm},{lit})])]"
        end = time.time() + timeout
        while time.time() < end:
            for _ in self._frames():
                cands = [e for e in self.driver.find_elements(By.XPATH, xp) if e.is_displayed()]
                if not cands:
                    continue
                exact = [e for e in cands if e.text.strip().lower() == needle]
                el = (exact or cands)[0]
                self.driver.execute_script(
                    "const t=arguments[0].closest('a,button,li,[onclick],[role=menuitem],[role=button]')||arguments[0];"
                    "t.scrollIntoView({block:'center'});t.click();", el)
                time.sleep(1.5)
                return
            time.sleep(1)
        raise RuntimeError(f'No encontré "{text}" en la pantalla de Micronauta')

    def _logged_out(self) -> bool:
        d = self.driver
        if 'login.php' in d.current_url:
            return True
        try:
            d.switch_to.default_content()
            return bool(d.find_elements(By.ID, 'password'))
        except WebDriverException:
            return True

    def open_view(self) -> None:
        d = self.driver
        if not self.cfg['password']:
            raise RuntimeError(f'Falta la contraseña de {self.cfg["label"]} en micronauta-live/.env')
        self.state = 'iniciando sesión'
        d.get(LOGIN_URL)
        time.sleep(2)
        d.find_element(By.ID, 'username').clear()
        d.find_element(By.ID, 'username').send_keys(self.cfg['user'])
        d.find_element(By.ID, 'password').send_keys(self.cfg['password'])
        # mismo botón que usa kms_recorridos_entre_paradas.py; si cambia, se envía el formulario
        btn = d.find_elements(By.XPATH, '//*[@id="sign-in-form"]/input') or d.find_elements(By.CSS_SELECTOR, '#sign-in-form [type=submit], #sign-in-form button')
        if btn:
            btn[0].click()
        else:
            d.find_element(By.ID, 'password').submit()
        time.sleep(4)
        if self._logged_out():
            raise RuntimeError('Micronauta rechazó el usuario o la contraseña')
        self.state = 'abriendo vista'
        d.get(VIEW_URL)
        time.sleep(5)
        for step in self.cfg['steps']:
            self._click_text(step)
        time.sleep(3)
        self.state = 'en vivo'
        self.error = ''

    # ---------- ciclo ----------
    def run(self) -> None:
        backoff = 10
        while True:
            try:
                if self.driver is None:
                    self.driver = self._new_driver()
                self.open_view()
                opened = time.time()
                backoff = 10
                while True:
                    self.driver.switch_to.default_content()
                    png = self.driver.get_screenshot_as_png()
                    with self.lock:
                        self.frame, self.updated = png, time.time()
                    if time.time() - opened > RELOAD_MIN * 60 or self._logged_out():
                        break  # vuelve a entrar y a navegar a la vista
                    time.sleep(INTERVAL)
            except Exception as exc:  # noqa: BLE001 — el servicio nunca se cae: reintenta
                self.state, self.error = 'error', str(exc).splitlines()[0][:300]
                print(f'[{self.cfg["label"]}] {self.error}')
                if os.environ.get('DEBUG'):
                    traceback.print_exc()
                try:
                    if self.driver:
                        self.driver.quit()
                except Exception:  # noqa: BLE001
                    pass
                self.driver = None
                time.sleep(backoff)
                backoff = min(backoff * 2, 300)

    def status(self) -> dict:
        age = time.time() - self.updated if self.updated else None
        state = self.state if age is None or age < max(30, INTERVAL * 6) else 'sin imagen reciente'
        return {'label': self.cfg['label'], 'state': state, 'error': self.error, 'updated': self.updated or None, 'age': round(age, 1) if age is not None else None}


FEED_OBJS: dict[str, Feed] = {}


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.send_header('Cache-Control', 'no-store')

    def do_OPTIONS(self):  # noqa: N802
        self.send_response(204)
        self._cors()
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()

    def do_GET(self):  # noqa: N802
        path = self.path.split('?')[0].strip('/')
        if path in ('', 'status'):
            body = json.dumps({'ok': True, 'intervalo': INTERVAL, 'feeds': {k: f.status() for k, f in FEED_OBJS.items()}}).encode()
            self.send_response(200); self._cors(); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(body)
            return
        key = path.removesuffix('.png')
        feed = FEED_OBJS.get(key)
        if feed and path.endswith('.png'):
            with feed.lock:
                frame = feed.frame
            if frame:
                self.send_response(200); self._cors(); self.send_header('Content-Type', 'image/png'); self.end_headers(); self.wfile.write(frame)
                return
            self.send_response(503); self._cors(); self.end_headers()
            return
        self.send_response(404); self._cors(); self.end_headers()

    def log_message(self, *args):  # silencio: el tablero consulta cada pocos segundos
        pass


def main() -> None:
    ap = argparse.ArgumentParser(description='Micronauta en vivo para el Tablero Solbus')
    ap.add_argument('--visible', action='store_true', help='mostrar las ventanas de Chrome')
    ap.add_argument('--lan', action='store_true', help='escuchar en toda la red (no sólo esta PC)')
    ap.add_argument('--port', type=int, default=int(os.environ.get('PUERTO', '8765')))
    ap.add_argument('--solo', choices=list(FEEDS), help='levantar una sola flota')
    args = ap.parse_args()

    for key, cfg in FEEDS.items():
        if args.solo and key != args.solo:
            continue
        FEED_OBJS[key] = Feed(key, cfg, args.visible)
        threading.Thread(target=FEED_OBJS[key].run, daemon=True, name=key).start()

    host = '0.0.0.0' if args.lan else '127.0.0.1'
    print(f'Micronauta en vivo → http://{"<IP de esta PC>" if args.lan else "localhost"}:{args.port}/status  (Ctrl+C para cortar)')
    ThreadingHTTPServer((host, args.port), Handler).serve_forever()


if __name__ == '__main__':
    main()
