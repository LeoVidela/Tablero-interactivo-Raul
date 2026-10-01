import { useEffect, useState } from 'react';
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun, Wind } from 'lucide-react';
import type { UnitFilter, UnitName } from '../data';

/** Hora oficial de Argentina (UTC-3, sin horario de verano). */
export const TZ = 'America/Argentina/Cordoba';
export function arNow() {
  const d = new Date();
  const parts = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const fecha = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  return { d, hour, minute, fecha: fecha.charAt(0).toUpperCase() + fecha.slice(1), iso, hhmm: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` };
}
export const saludo = (h: number) => (h >= 5 && h < 13 ? 'Buen día' : h >= 13 && h < 20 ? 'Buenas tardes' : 'Buenas noches');

export function useArClock(every = 30_000) {
  const [t, setT] = useState(arNow);
  useEffect(() => { const id = window.setInterval(() => setT(arNow()), every); return () => window.clearInterval(id); }, [every]);
  return t;
}

const COORDS: Record<UnitName, [number, number, string]> = {
  'Córdoba': [-31.4201, -64.1888, 'Córdoba'], Comodoro: [-45.8641, -67.4966, 'Comodoro Rivadavia'],
  'San Luis': [-33.2950, -66.3356, 'San Luis'], 'Villa Mercedes': [-33.6757, -65.4578, 'Villa Mercedes'],
};
const ORDER: UnitName[] = ['Córdoba', 'Comodoro', 'San Luis', 'Villa Mercedes'];
interface Wx { u: UnitName; temp: number; code: number; wind: number }

// Códigos WMO de Open-Meteo → texto e ícono
function wmo(code: number) {
  if (code === 0) return { t: 'Despejado', I: Sun };
  if (code <= 2) return { t: 'Algo nublado', I: CloudSun };
  if (code === 3) return { t: 'Nublado', I: Cloud };
  if (code <= 48) return { t: 'Niebla', I: CloudFog };
  if (code <= 57) return { t: 'Llovizna', I: CloudDrizzle };
  if (code <= 67 || (code >= 80 && code <= 82)) return { t: 'Lluvia', I: CloudRain };
  if (code <= 77 || code === 85 || code === 86) return { t: 'Nieve', I: CloudSnow };
  return { t: 'Tormenta', I: CloudLightning };
}

/** Clima actual de las 4 bases con Open-Meteo (gratis, sin clave). Se refresca cada 15 min. */
function useWeather() {
  const [wx, setWx] = useState<Wx[] | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const lat = ORDER.map((u) => COORDS[u][0]).join(','); const lon = ORDER.map((u) => COORDS[u][1]).join(',');
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m&timezone=${encodeURIComponent(TZ)}`);
        const j = await r.json(); const arr = Array.isArray(j) ? j : [j];
        if (alive) setWx(arr.map((x: { current: { temperature_2m: number; weather_code: number; wind_speed_10m: number } }, i: number) => ({ u: ORDER[i], temp: x.current.temperature_2m, code: x.current.weather_code, wind: x.current.wind_speed_10m })));
      } catch { /* sin conexión: no se muestra el clima */ }
    };
    load(); const id = window.setInterval(load, 15 * 60_000);
    return () => { alive = false; window.clearInterval(id); };
  }, []);
  return wx;
}

export function GreetingTitle({ name = 'Leo' }: { name?: string }) {
  const t = useArClock();
  return <>{saludo(t.hour)}, {name} <span>✦</span></>;
}

export function GreetingBar({ unit }: { unit: UnitFilter }) {
  const t = useArClock();
  const wx = useWeather();
  const shown = wx ? (unit === 'Todos' ? wx : wx.filter((w) => w.u === unit)) : [];
  return <div className="greet-bar">
    <span className="greet-date">{t.fecha} · <b>{t.hhmm} hs</b></span>
    {shown.map((w) => { const { t: txt, I } = wmo(w.code); return <span className="greet-wx" key={w.u} title={`${COORDS[w.u][2]}: ${txt}, viento ${Math.round(w.wind)} km/h`}><I size={14} /> {w.u.split(' ')[0] === 'Villa' ? 'V. Mercedes' : w.u} <b>{Math.round(w.temp)}°</b>{unit !== 'Todos' && <> · {txt} · <Wind size={12} /> {Math.round(w.wind)} km/h</>}</span>; })}
  </div>;
}
