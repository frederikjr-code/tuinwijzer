// Weerdata via Open-Meteo (gratis, geen API-key, CORS toegestaan).

export type Place = { name: string; lat: number; lon: number };
export type Day = { date: string; rain: number; et0: number; tmax: number; tmin: number; past: boolean };

export const DEFAULT_PLACE: Place = { name: 'De Bilt', lat: 52.1, lon: 5.18 };

export async function fetchWeather(p: Place): Promise<Day[]> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(p.lat));
  url.searchParams.set('longitude', String(p.lon));
  url.searchParams.set('daily', 'precipitation_sum,et0_fao_evapotranspiration,temperature_2m_max,temperature_2m_min');
  url.searchParams.set('past_days', '7');
  url.searchParams.set('forecast_days', '7');
  url.searchParams.set('timezone', 'Europe/Amsterdam');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weerdienst gaf status ${res.status}`);
  const d = (await res.json()).daily;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date());
  return (d.time as string[]).map((date, i) => ({
    date,
    rain: d.precipitation_sum[i] ?? 0,
    et0: d.et0_fao_evapotranspiration[i] ?? 0,
    tmax: d.temperature_2m_max[i] ?? 0,
    tmin: d.temperature_2m_min[i] ?? 0,
    past: date < today,
  }));
}

export async function searchPlace(q: string): Promise<Place[]> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', q);
  url.searchParams.set('count', '5');
  url.searchParams.set('language', 'nl');
  const res = await fetch(url);
  if (!res.ok) return [];
  const r = (await res.json()).results ?? [];
  return r.map((x: { name: string; admin1?: string; country_code?: string; latitude: number; longitude: number }) => ({
    name: [x.name, x.admin1, x.country_code !== 'NL' ? x.country_code : null].filter(Boolean).join(', '),
    lat: x.latitude,
    lon: x.longitude,
  }));
}

export type Status = 'ok' | 'soon' | 'water' | 'frost';
export type Advice = { zone: string; icon: string; status: Status; text: string };

/** Hoe de bezoeker water geeft. Aannames staan hieronder, zodat ze makkelijk aan te passen zijn. */
export type WaterUnit = 'gieter' | 'slang';
export const GIETER_LITER = 10; // gewone gieter
export const SLANG_LITER_PER_MIN = 10; // tuinslang met sproeikop, ongeveer

/** Een hoeveelheid water: liters (bereik) per m² of per plant. 1 mm regen = 1 liter per m². */
type Dose = { liters: [number, number]; per: 'm²' | 'plant' };

const nl = (n: number) => new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 1 }).format(n);

function formatDose({ liters: [lo, hi], per }: Dose, unit: WaterUnit) {
  const size = unit === 'gieter' ? GIETER_LITER : SLANG_LITER_PER_MIN;
  const a = lo / size, b = hi / size;
  const amount = a === b ? nl(a) : `${nl(a)} tot ${nl(b)}`;
  const word = unit === 'gieter' ? (b < 2 ? 'gieter' : 'gieters') : b < 2 ? 'minuut' : 'minuten';
  return unit === 'gieter' ? `${amount} ${word} per ${per}` : `${amount} ${word} sproeien per ${per}`;
}

/**
 * Eenvoudige waterbalans: neerslag minus verdamping (ET0) van de afgelopen 7 dagen,
 * gecorrigeerd voor verwachte regen in de komende 2 dagen.
 */
export function waterAdvice(days: Day[], unit: WaterUnit = 'gieter'): { balance: number; rain48: number; advice: Advice[] } {
  const past = days.filter((d) => d.past).slice(-7);
  const future = days.filter((d) => !d.past);
  const balance = past.reduce((s, d) => s + d.rain - d.et0, 0);
  const last3 = past.slice(-3).reduce((s, d) => s + d.rain - d.et0, 0);
  const rain48 = future.slice(0, 2).reduce((s, d) => s + d.rain, 0);
  const frost = future.slice(0, 3).some((d) => d.tmin < 0);
  const lowEvap = past.reduce((s, d) => s + d.et0, 0) < 5; // winterrust: nauwelijks verdamping

  const zones: { zone: string; icon: string; limit: number; dose?: Dose; how: string; b: number; frostTip: string }[] = [
    { zone: 'Gras', icon: '🌿', limit: -15, dose: { liters: [10, 15], per: 'm²' }, how: 'liever 1× flink dan elke dag een beetje', b: balance,
      frostTip: 'Loop niet over het bevroren gras, dat beschadigt de sprieten.' },
    { zone: 'Planten', icon: '🌸', limit: -20, dose: { liters: [10, 10], per: 'plant' }, how: 'aan de voet, \'s ochtends of \'s avonds', b: balance,
      frostTip: 'Dek gevoelige planten af met vliesdoek of een laag blad rond de voet.' },
    { zone: 'Moestuin', icon: '🥕', limit: -12, dose: { liters: [10, 10], per: 'm²' }, how: 'bij de wortels en niet over het blad', b: balance,
      frostTip: 'Bescherm wintergroenten met vliesdoek en oogst wat niet tegen vorst kan.' },
    { zone: 'Potten', icon: '🪴', limit: -6, how: 'tot er water uit het gat onderin loopt, voel eerst of de grond droog is', b: last3,
      frostTip: 'Potten liever droog en beschut zetten.' },
  ];

  const advice = zones.map(({ zone, icon, limit, dose, how, b, frostTip }): Advice => {
    const amount = dose ? `${formatDose(dose, unit)}, ${how}` : how;
    if (frost) return { zone, icon, status: 'frost', text: `Vorst verwacht: geen water geven. ${frostTip}` };
    if (lowEvap && b > limit) return { zone, icon, status: 'ok', text: 'De tuin is in rust en verdampt nauwelijks. Geen water nodig.' };
    if (rain48 >= 5 && b > limit * 2) return { zone, icon, status: 'ok', text: `Er komt ${rain48.toFixed(0)} mm regen aan. Wacht dat even af.` };
    if (b <= limit) return { zone, icon, status: 'water', text: `Water geven: ${amount}.` };
    if (b <= limit / 2) return { zone, icon, status: 'soon', text: 'Het wordt droger. Houd het in de gaten, binnen een paar dagen is water nodig.' };
    return { zone, icon, status: 'ok', text: 'Genoeg vocht in de grond. Geen water nodig.' };
  });

  return { balance, rain48, advice };
}
