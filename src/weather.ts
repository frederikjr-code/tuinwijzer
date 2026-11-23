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
  const today = isoToday();
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
export type Advice = {
  zone: string;
  icon: string;
  status: Status;
  text: string;
  /** regen − verdamping over de periode (7 dagen, voor Potten 3) */
  natural: number;
  /** eigen giften in mm over dezelfde periode, inclusief vandaag */
  given: number;
  /** natural + given */
  balance: number;
  limit: number;
  windowDays: number;
};

/** Een eigen gift: zoveel mm water op een zone, op een dag (YYYY-MM-DD). */
export type Gift = { id: string; zone: string; date: string; mm: number };

/** Datum van vandaag in Nederland, als YYYY-MM-DD. */
export function isoToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date());
}
/** YYYY-MM-DD plus n dagen (rekent op 12:00 UTC, dus geen gedoe met zomertijd). */
export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400_000);
}

/** "vandaag", "gisteren", "eergisteren" of "afgelopen dinsdag". */
export function dayPhrase(date: string, today: string): string {
  const n = daysBetween(date, today);
  if (n <= 0) return 'vandaag';
  if (n === 1) return 'gisteren';
  if (n === 2) return 'eergisteren';
  const wd = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z'));
  return `afgelopen ${wd}`;
}

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
 * Waterbalans per zone: neerslag minus verdamping (ET0) plus je eigen giften,
 * over de afgelopen 7 dagen (Potten: 3 dagen), gecorrigeerd voor verwachte regen in de komende 2 dagen.
 */
export function waterAdvice(
  days: Day[],
  unit: WaterUnit = 'gieter',
  gifts: Gift[] = [],
  today: string = isoToday(),
): { rain48: number; frost: boolean; resting: boolean; pastDates: string[]; advice: Advice[] } {
  const past = days.filter((d) => d.past).slice(-7);
  const future = days.filter((d) => !d.past);
  const rain48 = future.slice(0, 2).reduce((s, d) => s + d.rain, 0);
  const frost = future.slice(0, 3).some((d) => d.tmin < 0);
  const et0Week = past.reduce((s, d) => s + d.et0, 0);
  const resting = et0Week < 5; // winterrust: nauwelijks verdamping
  const avgEt0 = past.length ? et0Week / past.length : 0;

  const zones: { zone: string; icon: string; limit: number; dose?: Dose; how: string; windowDays: number; frostTip: string }[] = [
    { zone: 'Gras', icon: '🌿', limit: -15, dose: { liters: [10, 15], per: 'm²' }, how: 'liever 1× flink dan elke dag een beetje', windowDays: 7,
      frostTip: 'Loop niet over het bevroren gras, dat beschadigt de sprieten.' },
    { zone: 'Planten', icon: '🌸', limit: -20, dose: { liters: [10, 10], per: 'plant' }, how: "aan de voet, 's ochtends of 's avonds", windowDays: 7,
      frostTip: 'Dek gevoelige planten af met vliesdoek of een laag blad rond de voet.' },
    { zone: 'Moestuin', icon: '🥕', limit: -12, dose: { liters: [10, 10], per: 'm²' }, how: 'bij de wortels en niet over het blad', windowDays: 7,
      frostTip: 'Bescherm wintergroenten met vliesdoek en oogst wat niet tegen vorst kan.' },
    { zone: 'Potten', icon: '🪴', limit: -6, how: 'geef water tot het uit het gat onderin loopt, voel eerst of de grond droog is', windowDays: 3,
      frostTip: 'Potten liever droog en beschut zetten.' },
  ];

  const advice = zones.map(({ zone, icon, limit, dose, how, windowDays, frostTip }): Advice => {
    const span = past.slice(-windowDays);
    const natural = span.reduce((s, d) => s + d.rain - d.et0, 0);
    const start = span[0]?.date ?? today;
    const mine = gifts.filter((g) => g.zone === zone && g.date >= start && g.date <= today);
    const given = mine.reduce((s, g) => s + g.mm, 0);
    const b = natural + given;
    const last = mine.reduce<string | null>((m, g) => (!m || g.date > m ? g.date : m), null);
    const base = { zone, icon, natural, given, balance: b, limit, windowDays };
    const say = (status: Status, text: string): Advice => ({ ...base, status, text });

    const amount = dose ? `${formatDose(dose, unit)}, ${how}` : how;
    const cap = (t: string) => t[0].toUpperCase() + t.slice(1);
    // De status ("Vorst", "Water geven", …) staat als woord in de rij; de tekst herhaalt die niet.
    if (frost) return say('frost', frostTip);
    if (b <= limit) {
      const note = last ? `Je gaf ${dayPhrase(last, today)} water, maar dat is nog niet genoeg. ` : '';
      return say('water', `${note}${cap(amount)}.`);
    }
    if (last) {
      // Schatting: hoeveel dagen gemiddelde verdamping tot de balans weer op de drempel zit.
      const n = avgEt0 >= 0.3 ? Math.max(1, Math.ceil((b - limit) / avgEt0)) : Infinity;
      const when = n > 14 ? 'Voorlopig is er geen water meer nodig.' : `Pas over ongeveer ${n} ${n === 1 ? 'dag' : 'dagen'} weer nodig.`;
      return say(b <= limit / 2 ? 'soon' : 'ok', `${cap(`je gaf ${dayPhrase(last, today)} water.`)} ${when}`);
    }
    if (resting) return say('ok', 'De tuin is in rust en verdampt nauwelijks. Geen water nodig.');
    if (rain48 >= 5 && b > limit * 2) return say('ok', `Er komt ${rain48.toFixed(0)} mm regen aan. Wacht dat even af.`);
    if (b <= limit / 2) return say('soon', 'Het wordt droger. Houd het in de gaten, binnen een paar dagen is water nodig.');
    return say('ok', 'Genoeg vocht in de grond. Geen water nodig.');
  });

  return { rain48, frost, resting, pastDates: past.map((d) => d.date), advice };
}
