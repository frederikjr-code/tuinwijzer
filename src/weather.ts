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

/**
 * Eenvoudige waterbalans: neerslag minus verdamping (ET0) van de afgelopen 7 dagen,
 * gecorrigeerd voor verwachte regen in de komende 2 dagen.
 */
export function waterAdvice(days: Day[]): { balance: number; rain48: number; advice: Advice[] } {
  const past = days.filter((d) => d.past).slice(-7);
  const future = days.filter((d) => !d.past);
  const balance = past.reduce((s, d) => s + d.rain - d.et0, 0);
  const last3 = past.slice(-3).reduce((s, d) => s + d.rain - d.et0, 0);
  const rain48 = future.slice(0, 2).reduce((s, d) => s + d.rain, 0);
  const frost = future.slice(0, 3).some((d) => d.tmin < 0);
  const lowEvap = past.reduce((s, d) => s + d.et0, 0) < 5; // winterrust: nauwelijks verdamping

  const zones = [
    { zone: 'Gazon', icon: '🌿', limit: -15, amount: '10–15 mm per keer (± 10–15 liter per m²), liever 1× flink dan elke dag een beetje', b: balance },
    { zone: 'Border & struiken', icon: '🌸', limit: -20, amount: 'een flinke gieter per plant aan de voet, \'s ochtends of \'s avonds', b: balance },
    { zone: 'Moestuin', icon: '🥕', limit: -12, amount: '± 10 liter per m², bij de wortels en niet over het blad', b: balance },
    { zone: 'Potten & bakken', icon: '🪴', limit: -6, amount: 'tot er water uit het gat onderin loopt, voel eerst of de grond droog is', b: last3 },
  ];

  const advice = zones.map(({ zone, icon, limit, amount, b }): Advice => {
    if (frost) return { zone, icon, status: 'frost', text: 'Vorst verwacht: geen water geven. Potten liever droog en beschut zetten.' };
    if (lowEvap && b > limit) return { zone, icon, status: 'ok', text: 'De tuin is in rust en verdampt nauwelijks. Geen water nodig.' };
    if (rain48 >= 5 && b > limit * 2) return { zone, icon, status: 'ok', text: `Er komt ${rain48.toFixed(0)} mm regen aan. Wacht dat even af.` };
    if (b <= limit) return { zone, icon, status: 'water', text: `Water geven: ${amount}.` };
    if (b <= limit / 2) return { zone, icon, status: 'soon', text: 'Het wordt droger. Houd het in de gaten, binnen een paar dagen is water nodig.' };
    return { zone, icon, status: 'ok', text: 'Genoeg vocht in de grond. Geen water nodig.' };
  });

  return { balance, rain48, advice };
}
