import { type FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { GROUPS, type Grond, type Licht, MONTHS, MONTHS_LONG, PLANTS, type Plant, buildIcs, monthRanges } from './plants';
import {
  type Advice, type Day, DEFAULT_PLACE, GIETER_LITER, type Gift, type Place, SLANG_LITER_PER_MIN, type Status, type WaterUnit,
  addDays, dayPhrase, fetchWeather, isoToday, searchPlace, waterAdvice,
} from './weather';
import { NORMAL_MM, giftMm, useGardenLog } from './gifts';

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* opslaan is een gemak, geen vereiste */
  }
}

const nf = new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** Millimeters met één decimaal, komma en een echt minteken. */
function mm(v: number, signed = false) {
  const s = nf.format(Math.abs(v));
  if (!signed || Math.abs(v) < 0.05) return s;
  return (v > 0 ? '+' : '−') + s;
}

export type Page = 'home' | 'snoeikalender' | 'water';

const NAV: { page: Exclude<Page, 'home'>; href: string; label: string }[] = [
  { page: 'snoeikalender', href: '/snoeikalender', label: 'Snoeikalender' },
  { page: 'water', href: '/water', label: 'Water' },
];

export default function App({ page }: { page: Page }) {
  const [place, setPlace] = useState<Place>(() => load('place', DEFAULT_PLACE));
  const [mine, setMine] = useState<string[]>(() => load('plants', [] as string[]));

  useEffect(() => save('place', place), [place]);
  useEffect(() => save('plants', mine), [mine]);

  return (
    <main className="wrap">
      <header className="top">
        <a className="brand" href="/" aria-label="Tuinwijzer, naar de homepage">
          <svg className="logo" viewBox="0 0 32 32" aria-hidden="true">
            <rect x="10" y="2" width="12" height="28" rx="6" className="logo-tube" />
            <rect x="10" y="15" width="12" height="15" rx="6" className="logo-water" />
            <path d="M13 8h3M13 12h3M13 16h3" className="logo-tick" />
          </svg>
          <div>
            <h1>Tuinwijzer</h1>
            <p>Snoeien en water geven, op het juiste moment.</p>
          </div>
        </a>
        <nav className="nav" aria-label="Hoofdmenu">
          {NAV.map((n) => (
            <a key={n.page} href={n.href} aria-current={page === n.page ? 'page' : undefined}>{n.label}</a>
          ))}
        </nav>
      </header>

      {page === 'water' && <Water place={place} setPlace={setPlace} />}
      {page !== 'water' && <Pruning mine={mine} setMine={setMine} />}
      {page === 'home' && <WaterTeaser place={place} />}

      <footer>
        <p>
          Weerdata via <a href="https://open-meteo.com" target="_blank" rel="noreferrer">Open-Meteo</a>. Snoeiadvies is een
          algemene richtlijn, per soort en ras kan het afwijken. Je keuzes worden alleen in je eigen browser bewaard.
        </p>
        <p>
          Vaste planten: top 100 van Ron den Dikken, Levende Tuin Academie (
          <a href="https://www.tuincursus.com" target="_blank" rel="noreferrer">tuincursus.com</a>). Inheemse planten:{' '}
          <a href="https://www.tuinplantenloods.nl/blogs/nieuws/%F0%9F%8C%BF-top-100-inheemse-planten-van-nederland" target="_blank" rel="noreferrer">
            Tuinplantenloods.nl
          </a>.
        </p>
        <p>Gebouwd door Frederik Vermeulen en gevibecodet met Claude.</p>
      </footer>
    </main>
  );
}

/** Kleine doorverwijzing op de homepage naar het beregeningsadvies. */
function WaterTeaser({ place }: { place: Place }) {
  return (
    <aside className="section teaser" aria-labelledby="teaser-h">
      <svg viewBox="0 0 16 16" aria-hidden="true" className="ico"><path d="M8 2.5s4 4.3 4 7.2a4 4 0 0 1-8 0C4 6.8 8 2.5 8 2.5Z" /></svg>
      <div>
        <h2 id="teaser-h">Moet ik water geven?</h2>
        <p className="muted">Wateradvies per zone op basis van regen en verdamping in {place.name}.</p>
      </div>
      <a className="chip" href="/water">Bekijk het wateradvies <span aria-hidden="true">→</span></a>
    </aside>
  );
}

/* ---------------- Wateradvies ---------------- */

const DEMO = new URLSearchParams(location.search).get('demo');

const longDate = (iso: string) =>
  new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(iso + 'T12:00:00Z'));
const weekdayDay = (iso: string) =>
  new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(iso + 'T12:00:00Z'));

function explain(status: Status, ref: Advice, rain48: number) {
  if (status === 'frost') return 'Er wordt binnen drie dagen vorst verwacht, en natte grond en potten bevriezen dan sneller.';
  const period = ref.windowDays === 7 ? 'De afgelopen week' : `De afgelopen ${ref.windowDays} dagen`;
  const n = ref.natural;
  const past =
    n <= -0.5
      ? `${period} verdampte er ${mm(-n)} mm meer dan er viel`
      : n >= 0.5
        ? `${period} viel er ${mm(n)} mm meer regen dan er verdampte`
        : `Regen en verdamping hielden elkaar ${period.toLowerCase()} in evenwicht`;
  const own = ref.given > 0 ? `, je gaf zelf ${mm(ref.given)} mm water` : '';
  const next = rain48 >= 0.5 ? `de komende twee dagen valt naar verwachting ${mm(rain48)} mm` : 'de komende twee dagen blijft het naar verwachting droog';
  return `${past}${own}, en ${next}.`;
}

/** "Ervan uitgaande dat je sinds maandag 16 november geen water gaf." voor dagen zonder antwoord. */
function assumption(pastDates: string[], known: (d: string) => boolean): string | null {
  const unknown = pastDates.filter((d) => !known(d));
  if (unknown.length === 0) return null;
  const first = pastDates.indexOf(unknown[0]);
  const contiguous = unknown.every((d, i) => d === pastDates[first + i]);
  const endsYesterday = unknown[unknown.length - 1] === pastDates[pastDates.length - 1];
  if (unknown.length === 1) return `Ervan uitgaande dat je ${endsYesterday ? 'gisteren' : `op ${weekdayDay(unknown[0])}`} geen water gaf.`;
  if (contiguous && endsYesterday) return `Ervan uitgaande dat je sinds ${longDate(unknown[0])} geen water gaf.`;
  if (contiguous) return `Ervan uitgaande dat je van ${weekdayDay(unknown[0])} tot en met ${longDate(unknown[unknown.length - 1])} geen water gaf.`;
  return `Ervan uitgaande dat je op ${joinNl(unknown.map(weekdayDay))} geen water gaf.`;
}

const STATUS_WORD: Record<Status, string> = { frost: 'Vorst', ok: 'Goed', water: 'Water geven', soon: 'Bijna droog' };
const DAY_LABELS = ['Vandaag', 'Gisteren', 'Eergisteren'];

type Toast = { text: string; undo: () => void };

function Water({ place, setPlace }: { place: Place; setPlace: (p: Place) => void }) {
  const [days, setDays] = useState<Day[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [today] = useState(isoToday);
  const yesterday = addDays(today, -1);
  const log = useGardenLog(today, DEMO !== null);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    setDays(null);
    setError(null);
    (DEMO !== null ? Promise.resolve(demoWeather(DEMO)) : fetchWeather(place)).then(setDays).catch((e: Error) => setError(e.message));
  }, [place]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [toast]);

  const [unit, setUnit] = useState<WaterUnit>(() => load('unit', 'gieter' as WaterUnit));
  useEffect(() => save('unit', unit), [unit]);
  const result = useMemo(() => (days ? waterAdvice(days, unit, log.gifts, today) : null), [days, unit, log.gifts, today]);
  const worst = result?.advice.find((a) => a.status === 'water') ?? result?.advice.find((a) => a.status === 'frost') ?? result?.advice.find((a) => a.status === 'soon');
  const status: Status = worst?.status ?? 'ok';
  const headline = !result
    ? ''
    : status === 'water'
      ? 'Vandaag water geven'
      : status === 'frost'
        ? 'Geen water geven: vorst op komst'
        : status === 'soon'
          ? 'Nog niet, maar het wordt droger'
          : 'Geen water nodig';

  // De regenmeter toont de zone die het meeste water nodig heeft, anders Gras.
  const ref = result
    ? ([...result.advice].filter((a) => a.status === 'water' || a.status === 'soon').sort((a, b) => a.balance - a.limit - (b.balance - b.limit))[0] ??
      result.advice.find((a) => a.zone === 'Gras') ??
      result.advice[0])
    : null;

  const logGifts = (zones: string[], date: string, extraUndo?: () => void) => {
    const ids = log.addGifts(zones.map((zone) => ({ zone, date })));
    const when = date === today ? '' : ` (${dayPhrase(date, today)})`;
    setToast({ text: `Water gegeven bij ${joinNl(zones)}${when}`, undo: () => { log.removeGifts(ids); extraUndo?.(); } });
  };

  // Geen check-in bij vorst of als de tuin in rust is: dan doet water geven er niet toe.
  const showCheckIn = result && !result.frost && !result.resting && !log.known(yesterday);
  const note = result && !result.frost && !result.resting ? assumption(result.pastDates, log.known) : null;

  return (
    <section className="section" aria-labelledby="water-h">
      <div className="sechead">
        <h2 id="water-h">Moet ik water geven?</h2>
        <PlacePicker place={place} setPlace={setPlace} />
      </div>

      {error && <p className="notice">Het weer kon niet worden opgehaald: {error}</p>}
      {!error && !result && <p className="muted loading">Het weer wordt opgehaald…</p>}

      {result && days && ref && (
        <>
          <div className="hero">
            <div className="hero-text">
              <p className="hero-big">{headline}</p>
              <p className="hero-sub">{explain(status, ref, result.rain48)}</p>
              {note && <p className="hero-note">{note}</p>}
            </div>
            <RainGauge natural={ref.natural} given={ref.given} zone={ref.zone} windowDays={ref.windowDays} />
          </div>

          <div className="subhead">
            <h3>Wateradvies per zone</h3>
            <div className="seg" role="group" aria-label="Ik geef water met">
              <button aria-pressed={unit === 'gieter'} onClick={() => setUnit('gieter')}>Gieter</button>
              <button aria-pressed={unit === 'slang'} onClick={() => setUnit('slang')}>Tuinslang</button>
            </div>
          </div>

          {showCheckIn && (
            <CheckIn
              zones={result.advice.map((a) => a.zone)}
              onYes={(zones) => {
                log.addAnswer(yesterday);
                logGifts(zones, yesterday, () => log.removeAnswer(yesterday));
              }}
              onNo={() => {
                log.addAnswer(yesterday);
                setToast({ text: 'Genoteerd: gisteren geen water gegeven', undo: () => log.removeAnswer(yesterday) });
              }}
            />
          )}

          <ul className="zones">
            {result.advice.map((a) => (
              <li key={a.zone} className="zone">
                <span className={`stripe ${a.status}`} aria-hidden="true" />
                <div className="zbody">
                  <div className="zhead">
                    <b className="zname">{a.zone}</b>
                    <span className={`zstatus ${a.status}`}>{STATUS_WORD[a.status]}</span>
                  </div>
                  <p>{a.text}</p>
                  <ZoneLog zone={a.zone} onLog={(daysAgo) => logGifts([a.zone], addDays(today, -daysAgo))} />
                </div>
              </li>
            ))}
          </ul>
          <p className="muted small">
            {unit === 'gieter'
              ? `Uitgaande van een gieter van ${GIETER_LITER} liter.`
              : `Uitgaande van een tuinslang met sproeikop, die ongeveer ${SLANG_LITER_PER_MIN} liter per minuut geeft.`}
            {' '}Elke gift telt als {joinNl(Object.entries(NORMAL_MM).map(([z, v]) => `${v} mm bij ${z}`))}.
          </p>

          <h3>Regen, verdamping en jouw water per dag</h3>
          <RainChart days={days} gifts={log.gifts} />
        </>
      )}

      <div className="toast-slot" role="status" aria-live="polite">
        {toast && (
          <div className="toast">
            <span>{toast.text}, </span>
            <button onClick={() => { toast.undo(); setToast(null); }}>ongedaan maken</button>
          </div>
        )}
      </div>
    </section>
  );
}

/** Dagelijkse vraag over gisteren. Verdwijnt zodra er een antwoord (of een gift voor gisteren) is. */
function CheckIn({ zones, onYes, onNo }: { zones: string[]; onYes: (zones: string[]) => void; onNo: () => void }) {
  const [choosing, setChoosing] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const toggle = (z: string) => setSel(sel.includes(z) ? sel.filter((x) => x !== z) : [...sel, z]);

  return (
    <div className="checkin">
      <div className="crow">
        <p className="cq">Heb je gisteren water gegeven?</p>
        {!choosing && (
          <div className="cbtns">
            <button className="chip" onClick={() => setChoosing(true)}>Ja</button>
            <button className="chip" onClick={onNo}>Nee</button>
          </div>
        )}
      </div>
      {choosing && (
        <div className="cchoose">
          <p className="mlabel">Welke zones?</p>
          <div className="chips">
            {zones.map((z) => (
              <button key={z} className={`pchip ${sel.includes(z) ? 'on' : ''}`} aria-pressed={sel.includes(z)} onClick={() => toggle(z)}>
                {sel.includes(z) ? '✓ ' : '+ '}{z}
              </button>
            ))}
          </div>
          <div className="actions">
            <button className="btn" disabled={sel.length === 0} onClick={() => onYes(sel)}>Opslaan</button>
            <button className="btn ghost" onClick={() => setChoosing(false)}>Annuleren</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** "Water gegeven": één tik is een gift vandaag; via het pijltje kies je gisteren of eergisteren. */
function ZoneLog({ zone, onLog }: { zone: string; onLog: (daysAgo: number) => void }) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="zlog" ref={box} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <div className="split">
        <button className="chip" onClick={() => onLog(0)}>
          <svg viewBox="0 0 16 16" aria-hidden="true" className="ico"><path d="M8 2.5s4 4.3 4 7.2a4 4 0 0 1-8 0C4 6.8 8 2.5 8 2.5Z" /></svg>
          Water gegeven
        </button>
        <button className="chip more" aria-expanded={open} aria-label={`Andere dag kiezen voor ${zone}`} onClick={() => setOpen(!open)}>
          <svg viewBox="0 0 16 16" aria-hidden="true" className="ico chev"><path d="m4 6 4 4 4-4" /></svg>
        </button>
      </div>
      {open && (
        <div className="popover logmenu" role="dialog" aria-label={`Water gegeven bij ${zone}`}>
          <p className="mlabel">Wanneer?</p>
          <div className="seg" role="group" aria-label="Dag">
            {DAY_LABELS.map((l, i) => <button key={l} aria-pressed={day === i} onClick={() => setDay(i)}>{l}</button>)}
          </div>
          <button className="btn" onClick={() => { onLog(day); setOpen(false); }}>
            Opslaan ({giftMm(zone)} mm)
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Verticale regenmeter: −30 tot +30 mm, 0 in het midden.
 * Onderste laag: regen − verdamping. Daarbovenop: jouw eigen water.
 * Boven +30 loopt de buis over (bolling en druppels over de rand), onder −30 is hij leeg met een droge bodem.
 */
function RainGauge({ natural, given, zone, windowDays }: { natural: number; given: number; zone: string; windowDays: number }) {
  const value = natural + given;
  const W = 170, H = 310, top = 26, bottom = 296, tx = 52, tw = 40, r = tw / 2;
  const over = value > 30, dry = value < -30;
  const y = (v: number) => top + ((30 - Math.max(-30, Math.min(30, v))) / 60) * (bottom - top);
  const level = y(value), natLevel = y(natural);
  const hasGift = given > 0 && natLevel > level;
  const labelY = Math.max(top + 12, Math.min(bottom - 6, level + 6));
  const labelX = tx + tw + (over ? 20 : 8);
  const ticks = Array.from({ length: 13 }, (_, i) => 30 - i * 5);
  // open bovenkant, ronde bodem
  const tube = `M${tx},${top} V${bottom - r} A${r},${r} 0 0 0 ${tx + tw},${bottom - r} V${top}`;
  const R = tx + tw; // rechterwand
  const period = windowDays === 7 ? 'de afgelopen 7 dagen' : `de afgelopen ${windowDays} dagen`;

  return (
    <figure className="gauge">
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`Waterbalans bij ${zone}, ${period}: ${mm(value, true)} mm${given > 0 ? `, waarvan ${mm(given)} mm jouw water` : ''}${over ? ', de meter loopt over' : dry ? ', de bodem staat droog' : ''}`}>
        <defs>
          <clipPath id="tube-clip"><path d={`${tube} Z`} /></clipPath>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={t % 10 === 0 ? tx - 14 : tx - 8} x2={tx - 2} y1={y(t)} y2={y(t)} className={`gtick ${t === 0 ? 'zero' : ''}`} />
            {t % 10 === 0 && (
              <text x={tx - 18} y={y(t) + 4} textAnchor="end" className={`glabel ${t === 0 ? 'zero' : ''}`}>
                {t > 0 ? `+${t}` : t < 0 ? `−${-t}` : '0'}
              </text>
            )}
          </g>
        ))}
        <path d={`${tube} Z`} className="tube" />
        <g clipPath="url(#tube-clip)">
          {!dry && (
            <g className="gfill">
              <rect x={tx} y={natLevel} width={tw} height={bottom - natLevel + 1} className="water" />
              {hasGift && <rect x={tx} y={level} width={tw} height={natLevel - level} className="gift" />}
              {!over && <rect x={tx} y={level} width={tw} height={3} className={hasGift ? 'surface gift-top' : 'surface'} />}
            </g>
          )}
          <line x1={tx + 9} x2={tx + 9} y1={top + 12} y2={bottom - 18} className="glare" />
        </g>
        {dry && (
          <g className="gdry" aria-hidden="true" clipPath="url(#tube-clip)">
            <rect x={tx} y={bottom - 16} width={tw} height={16} className="dry-bed" />
            <path d={`M${tx + 7},${bottom - 15} l5,6 l5,-4 l4,7 M${tx + 22},${bottom - 15} l3,5 l6,-2 l2,6 M${tx + 14},${bottom - 6} l4,-3`} className="dry-crack" />
          </g>
        )}
        {over && (
          <g className="gover" aria-hidden="true">
            <path d={`M${tx - 1},${top} Q${tx + r},${top - 16} ${R + 1},${top} Z`} className={hasGift ? 'gift' : 'water'} />
            <path d={`M${R - 3},${top - 3} q10,1 10,14 v30`} className="stream" />
            <path d={`M${R + 7},${top + 52} c-4,6 -4,10 0,10 c4,0 4,-4 0,-10 Z`} className="drop d1" />
            <path d={`M${R + 7},${top + 72} c-4,6 -4,10 0,10 c4,0 4,-4 0,-10 Z`} className="drop d2" />
            <path d={`M${tx - 5},${top + 30} c-3,5 -3,8 0,8 c3,0 3,-3 0,-8 Z`} className="drop d2" />
          </g>
        )}
        <path d={tube} className="tube-edge" />
        <path d={`M${tx - 4},${top} H${tx} M${R},${top} H${R + 4}`} className="tube-edge" />
        <line x1={tx} x2={R} y1={y(0)} y2={y(0)} className="gzero" />
        <text x={labelX} y={labelY} className="gvalue">{mm(value, true)}</text>
        <text x={labelX} y={labelY + 16} className="gunit">mm</text>
      </svg>
      <figcaption>
        Waterbalans bij {zone}, {period}
        {over && <strong>De meter loopt over.</strong>}
        {dry && <strong>De bodem staat droog.</strong>}
        <span className="glegend">
          <span><i className="sw rain" /> regen</span>
          <span><i className="sw gift" /> jouw water</span>
        </span>
      </figcaption>
    </figure>
  );
}

function PlacePicker({ place, setPlace }: { place: Place; setPlace: (p: Place) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Place[]>([]);

  useEffect(() => {
    if (q.trim().length < 2) return setHits([]);
    const t = setTimeout(() => searchPlace(q.trim()).then(setHits).catch(() => setHits([])), 300);
    return () => clearTimeout(t);
  }, [q]);

  const choose = (p: Place) => {
    setPlace(p);
    setOpen(false);
    setQ('');
  };

  const locate = () =>
    navigator.geolocation?.getCurrentPosition(
      (pos) => choose({ name: 'Mijn locatie', lat: +pos.coords.latitude.toFixed(3), lon: +pos.coords.longitude.toFixed(3) }),
      () => alert('Locatie niet beschikbaar. Zoek je woonplaats op naam.'),
    );

  return (
    <div className="place">
      <button className="chip" aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 16 16" aria-hidden="true" className="ico"><path d="M8 15s5-4.6 5-8.5A5 5 0 0 0 3 6.5C3 10.4 8 15 8 15Z" /><circle cx="8" cy="6.5" r="1.8" /></svg>
        {place.name}
        <svg viewBox="0 0 16 16" aria-hidden="true" className="ico chev"><path d="m4 6 4 4 4-4" /></svg>
      </button>
      {open && (
        <div className="popover">
          <input autoFocus aria-label="Woonplaats" placeholder="Zoek je woonplaats…" value={q} onChange={(e) => setQ(e.target.value)} />
          {hits.map((h) => (
            <button key={`${h.lat},${h.lon}`} className="hit" onClick={() => choose(h)}>{h.name}</button>
          ))}
          <button className="hit locate" onClick={locate}>Gebruik mijn huidige locatie</button>
        </div>
      )}
    </div>
  );
}

// Kleinste "ronde" stap (1, 2, 5, 10, 20, 50, …) die minstens x is.
function niceStep(x: number) {
  const pow = 10 ** Math.floor(Math.log10(x));
  return [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= x)!;
}

/** Breedte van een element in px, zodat de grafiek op elk scherm leesbare letters houdt. */
function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Per dag: rechts van de regen een balkje voor jouw grootste gift die dag (tooltip toont alle zones). */
function RainChart({ days, gifts }: { days: Day[]; gifts: Gift[] }) {
  const [ref, width] = useWidth<HTMLDivElement>(700);
  const W = Math.max(280, width), H = 196, padL = 26, padB = 36, padT = 24;
  const giftsOn = (date: string) => gifts.filter((g) => g.date === date);
  const giftMax = (date: string) => Math.max(0, ...giftsOn(date).map((g) => g.mm));
  const dataMax = Math.max(4, ...days.map((d) => Math.max(d.rain, d.et0, giftMax(d.date))));
  const step = niceStep(dataMax / 3);
  const max = Math.ceil((dataMax * 1.05) / step) * step;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const bw = (W - padL) / days.length;
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const todayIdx = days.findIndex((d) => !d.past);
  const fmt = (s: string) => new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric' }).format(new Date(s + 'T12:00:00'));

  return (
    <div className="chart" ref={ref}>
      <div className="legend">
        <span className="lg rain" /> Regen <span className="lg gift" /> Jouw water <span className="lg evap" /> Verdamping <span className="muted">(in mm)</span>
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Regen, jouw water en verdamping per dag">
        {todayIdx > 0 && <rect x={padL + todayIdx * bw} y={padT} width={W - padL - todayIdx * bw} height={H - padT - padB} className="future" />}
        {todayIdx > 0 && (
          <g className="today-mark">
            <line x1={padL + todayIdx * bw} x2={padL + todayIdx * bw} y1={padT - 12} y2={y(0)} />
            <text x={padL + todayIdx * bw + 5} y={padT - 4}>vandaag</text>
          </g>
        )}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} className={`grid ${t === 0 ? 'base' : ''}`} />
            <text x={padL - 6} y={y(t) + 4} className="axis" textAnchor="end">{t.toFixed(0)}</text>
          </g>
        ))}
        {days.map((d, i) => {
          const x = padL + i * bw;
          const [wd, dn] = fmt(d.date).split(' ');
          const g = giftMax(d.date);
          const rx = Math.min(2, bw * 0.06);
          return (
            <g key={d.date}>
              <rect x={x + bw * 0.1} width={bw * 0.26} y={y(d.rain)} height={y(0) - y(d.rain)} rx={rx} className="rain"><title>{`${fmt(d.date)}: ${mm(d.rain)} mm regen`}</title></rect>
              {g > 0 && (
                <rect x={x + bw * 0.37} width={bw * 0.26} y={y(g)} height={y(0) - y(g)} rx={rx} className="gift">
                  <title>{`${fmt(d.date)}, jouw water: ${giftsOn(d.date).map((x) => `${x.zone} ${mm(x.mm)} mm`).join(', ')}`}</title>
                </rect>
              )}
              <rect x={x + bw * 0.64} width={bw * 0.26} y={y(d.et0)} height={y(0) - y(d.et0)} rx={rx} className="evap"><title>{`${fmt(d.date)}: ${mm(d.et0)} mm verdamping`}</title></rect>
              <text x={x + bw / 2} y={H - 20} className={`axis ${i === todayIdx ? 'today' : ''}`} textAnchor="middle">{wd}</text>
              <text x={x + bw / 2} y={H - 6} className={`axis ${i === todayIdx ? 'today' : ''}`} textAnchor="middle">{dn}</text>
            </g>
          );
        })}
      </svg>
      <p className="muted small">
        Links zie je de afgelopen week, rechts in het lichtere vlak de verwachting. Gaf je op één dag aan meer zones water, dan
        toont het groene balkje de grootste gift.
      </p>
    </div>
  );
}

/* ---------------- Snoeikalender ---------------- */

const SEASON = ['w', 'w', 'l', 'l', 'l', 'z', 'z', 'z', 'h', 'h', 'h', 'w'];
const LIGHTS: Licht[] = ['zon', 'halfschaduw', 'schaduw'];
const SOILS: Grond[] = ['droog', 'vochtig', 'nat'];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function Pruning({ mine, setMine }: { mine: string[]; setMine: (ids: string[]) => void }) {
  const [picking, setPicking] = useState(mine.length === 0);
  const month = new Date().getMonth() + 1;
  const next = (month % 12) + 1;
  const plants = PLANTS.filter((p) => mine.includes(p.id));
  const pruned = plants.filter((p) => p.months.length > 0); // planten zonder snoei komen niet in de agenda
  const nowList = plants.filter((p) => p.months.includes(month));
  const nextList = plants.filter((p) => p.months.includes(next) && !p.months.includes(month));

  const download = () => {
    const blob = new Blob([buildIcs(pruned)], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'snoeikalender.ics';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <section className="section prune" aria-labelledby="prune-h">
      <div className="sechead">
        <h2 id="prune-h">Maak je eigen snoeikalender</h2>
        {picking ? (
          <button className="chip primary" disabled={plants.length === 0} onClick={() => setPicking(false)}>Toon mijn kalender ({plants.length})</button>
        ) : (
          <button className="chip" onClick={() => setPicking(true)}>Planten aanpassen</button>
        )}
      </div>

      {picking && (
        <>
          <p className="lead">Kies de planten die in je tuin staan.</p>
          <PlantPicker mine={mine} setMine={setMine} />
        </>
      )}

      {!picking && plants.length === 0 && <p className="muted">Kies eerst welke planten je in je tuin hebt.</p>}

      {!picking && plants.length > 0 && (
        <>
          <h3>Deze maand ({MONTHS_LONG[month - 1]})</h3>
          {nowList.length === 0 ? (
            <p className="muted">Niets te snoeien. Even genieten van de tuin.</p>
          ) : (
            <ul className="tips">{nowList.map((p) => <PlantTip key={p.id} p={p} />)}</ul>
          )}
          {nextList.length > 0 && (
            <>
              <h3>Volgende maand ({MONTHS_LONG[next - 1]})</h3>
              <ul className="tips later">{nextList.map((p) => <PlantTip key={p.id} p={p} />)}</ul>
            </>
          )}

          <h3>Het hele jaar</h3>
          <YearGrid plants={plants} month={month} />

          <h3>Mijn planten</h3>
          <ul className="pcards">{plants.map((p) => <PlantCard key={p.id} p={p} />)}</ul>

          <div className="actions">
            <button className="btn" onClick={() => window.print()}>Printen voor in de schuur</button>
            <button className="btn ghost" onClick={download} disabled={pruned.length === 0}>Zet in mijn agenda (.ics)</button>
          </div>
          <p className="muted small">
            De print is een A4 liggend, met per plant wanneer en hoe je snoeit; bij veel planten lopen de tips door op een tweede blad. De agenda werkt met Google Agenda, Outlook
            en Apple Agenda, en de herinneringen herhalen elk jaar op de 1e van de snoeimaand.
            {pruned.length < plants.length && ' Planten die geen snoei nodig hebben, komen niet in de agenda.'}
          </p>
        </>
      )}

      {plants.length > 0 && <PrintPoster plants={plants} />}
    </section>
  );
}

/**
 * Jaaroverzicht: maandkolommen met seizoenstint, snoeimaanden als vakje en bloeimaanden als lichte balk.
 * Zonder `month` geen markering van de huidige maand (voor de print).
 */
function YearGrid({ plants, month }: { plants: Plant[]; month?: number }) {
  const cls = (i: number) => `s-${SEASON[i]}${i + 1 === month ? ' cur' : ''}`;
  return (
    <>
      <div className="ylegend" aria-hidden="true">
        <span><i className="cut" /> snoeien</span>
        <span><i className="bloom-sw" /> bloei</span>
      </div>
      <div className="grid12" tabIndex={0} aria-label="Snoei- en bloeimaanden per plant">
        <div className="row head">
          <span className="pname" />
          {MONTHS.map((m, i) => <span key={m} className={cls(i)} aria-current={i + 1 === month ? 'date' : undefined}>{m}</span>)}
        </div>
        {plants.map((p) => {
          const blooms = (m: number) => !!p.bloom?.includes(m);
          return (
            <div className="row" key={p.id} title={p.tip}>
              <span className="pname">
                <span>{p.name}</span>
                {p.months.length === 0 && <span className="nocut">Geen snoei nodig</span>}
              </span>
              {MONTHS.map((m, i) => {
                const b = blooms(i + 1);
                const bl = b ? ` bl${!blooms(i) || i === 0 ? ' bl-s' : ''}${!blooms(i + 2) || i === 11 ? ' bl-e' : ''}` : '';
                const label = [p.months.includes(i + 1) && 'snoeien', b && 'bloei'].filter(Boolean).join(' en ');
                return (
                  <span key={m} className={cls(i) + bl} aria-label={label ? `${MONTHS_LONG[i]}: ${label}` : undefined}>
                    {p.months.includes(i + 1) ? <i className="cut" /> : null}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}

/** "maart, april en mei" of met `of`: "zon of halfschaduw". */
function joinNl(items: string[], word = 'en') {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} ${word} ${items[items.length - 1]}`;
}

/** De bekende eigenschappen van een plant; onbekende velden laten we weg. */
function plantFacts(p: Plant): [string, string][] {
  const facts: [string, string][] = [];
  if (p.light?.length) facts.push(['Standplaats', joinNl(p.light, 'of')]);
  if (p.soil?.length) facts.push(['Grond', joinNl(p.soil, 'of')]);
  if (p.height) facts.push(['Hoogte', `${p.height.replace('-', '–')} cm`]);
  if (p.bloom?.length) facts.push(['Bloei', monthRanges(p.bloom)]);
  facts.push(['Snoeien', p.months.length ? monthRanges(p.months) : 'Geen snoei nodig']);
  return facts;
}

/** Tip als tekst; tips die met "Let op:" beginnen krijgen een waarschuwingsstijl. */
function TipText({ tip }: { tip: string }) {
  if (!tip) return null;
  if (tip.startsWith('Let op:')) {
    return (
      <p className="tiptext warn">
        <svg viewBox="0 0 16 16" aria-hidden="true" className="ico"><path d="M8 2 14.5 13.5h-13L8 2Z" /><path d="M8 6.5v3M8 11.6v.1" /></svg>
        <span><b>Let op:</b>{tip.slice('Let op:'.length)}</span>
      </p>
    );
  }
  return <p className="tiptext">{tip}</p>;
}

function InheemsTag() {
  return <span className="tag">inheems</span>;
}

/** Alleen zichtbaar bij afdrukken: een poster om in de schuur of garage op te hangen. */
function PrintPoster({ plants }: { plants: Plant[] }) {
  return (
    <div className="poster" aria-hidden="true">
      <div className="poster-head">
        <h2>Snoeikalender</h2>
        <p>Een vakje betekent: deze maand snoeien. De lichte balk is de bloeitijd.</p>
      </div>
      <YearGrid plants={plants} />
      <ol className="poster-tips">
        {plants.map((p) => (
          <li key={p.id}>
            <b>{p.name}</b>{' '}
            <span className="when">{p.months.length ? `snoeien in ${monthRanges(p.months)}` : 'geen snoei nodig'}</span>
            <p className="pfacts">{plantFacts(p).filter(([k]) => k !== 'Snoeien').map(([k, v]) => `${k}: ${v}.`).join(' ')}</p>
            <TipText tip={p.tip} />
          </li>
        ))}
      </ol>
      <p className="poster-foot">Gemaakt met Tuinwijzer. Snoeiadvies is een algemene richtlijn, per soort en ras kan het afwijken.</p>
    </div>
  );
}

function PlantTip({ p }: { p: Plant }) {
  return (
    <li className="tip">
      <span className="stripe ok" aria-hidden="true" />
      <div>
        <b>{p.name}</b>
        <TipText tip={p.tip} />
      </div>
    </li>
  );
}

/** Een gekozen plant met alle bekende eigenschappen en de tip. */
function PlantCard({ p }: { p: Plant }) {
  return (
    <li className="pcard">
      <div className="pc-head">
        <b>{p.name}</b>
        {p.inheems && <InheemsTag />}
      </div>
      {p.latin && <i className="latin">{p.latin}</i>}
      <dl className="facts">
        {plantFacts(p).map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <TipText tip={p.tip} />
    </li>
  );
}

function PlantPicker({ mine, setMine }: { mine: string[]; setMine: (ids: string[]) => void }) {
  const [q, setQ] = useState('');
  const [light, setLight] = useState<Licht | null>(null);
  const [soil, setSoil] = useState<Grond | null>(null);
  const [onlyNative, setOnlyNative] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>([]);

  const needle = q.trim().toLowerCase();
  const filtering = light !== null || soil !== null || onlyNative;
  const active = needle !== '' || filtering;
  // Zoeken op Nederlandse én Latijnse naam. Zonder standplaats- of grondgegevens val je weg bij die filters.
  const pass = (p: Plant) =>
    (needle === '' || p.name.toLowerCase().includes(needle) || !!p.latin?.toLowerCase().includes(needle)) &&
    (light === null || !!p.light?.includes(light)) &&
    (soil === null || !!p.soil?.includes(soil)) &&
    (!onlyNative || !!p.inheems);
  const results = PLANTS.filter(pass);
  const toggle = (id: string) => setMine(mine.includes(id) ? mine.filter((x) => x !== id) : [...mine, id]);
  const toggleGroup = (g: string) => setOpenGroups((o) => (o.includes(g) ? o.filter((x) => x !== g) : [...o, g]));
  const clear = () => { setLight(null); setSoil(null); setOnlyNative(false); };
  const n = results.length;

  return (
    <div className="picker">
      <input aria-label="Zoek een plant op Nederlandse of Latijnse naam" placeholder="Zoek op Nederlandse of Latijnse naam…" value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="filters">
        <div className="fgroup" role="group" aria-label="Standplaats">
          <span className="flabel">Standplaats</span>
          <div className="seg">
            {LIGHTS.map((v) => <button key={v} aria-pressed={light === v} onClick={() => setLight(light === v ? null : v)}>{cap(v)}</button>)}
          </div>
        </div>
        <div className="fgroup" role="group" aria-label="Grond">
          <span className="flabel">Grond</span>
          <div className="seg">
            {SOILS.map((v) => <button key={v} aria-pressed={soil === v} onClick={() => setSoil(soil === v ? null : v)}>{cap(v)}</button>)}
          </div>
        </div>
        <label className="fcheck">
          <input type="checkbox" checked={onlyNative} onChange={(e) => setOnlyNative(e.target.checked)} />
          Alleen inheemse planten
        </label>
      </div>

      <p className="fcount" aria-live="polite">
        {active ? `${n} ${n === 1 ? 'plant' : 'planten'} gevonden.` : `${PLANTS.length} planten in ${GROUPS.length} groepen.`}
        {(light || soil) && ' Standplaats en grond zijn alleen bekend voor de vaste planten uit de top 100.'}
        {filtering && <> <button className="linkbtn" onClick={clear}>Filters wissen</button></>}
      </p>
      {n === 0 && needle && <p className="muted nohit">Geen plant gevonden met “{q.trim()}”. Je kunt hem hieronder voorstellen.</p>}

      {GROUPS.map((g) => {
        const all = PLANTS.filter((p) => p.group === g);
        const list = active ? results.filter((p) => p.group === g) : all;
        if (list.length === 0) return null;
        const open = active || openGroups.includes(g);
        const chosen = all.filter((p) => mine.includes(p.id)).length;
        const id = `grp-${g.replace(/\W+/g, '-')}`;
        return (
          <div key={g} className="pgroup">
            <button className="grp-head" aria-expanded={open} aria-controls={id} onClick={() => !active && toggleGroup(g)} disabled={active}>
              <svg viewBox="0 0 16 16" aria-hidden="true" className="ico chev"><path d="m6 4 4 4-4 4" /></svg>
              <span className="gname">{g}</span>
              <span className="gcount">
                {active ? `${list.length} van ${all.length}` : `${all.length} ${all.length === 1 ? 'plant' : 'planten'}`}
                {chosen > 0 && `, ${chosen} gekozen`}
              </span>
            </button>
            {open && (
              <div className="chips" id={id}>
                {list.map((p) => (
                  <button key={p.id} className={`pchip ${mine.includes(p.id) ? 'on' : ''}`} aria-pressed={mine.includes(p.id)} onClick={() => toggle(p.id)}>
                    <span className="pc-name">
                      {mine.includes(p.id) ? '✓ ' : '+ '}{p.name}
                      {p.inheems && <InheemsTag />}
                    </span>
                    {p.latin && <i className="latin">{p.latin}</i>}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <SuggestPlant initial={n === 0 && needle ? q.trim() : ''} />
    </div>
  );
}

/**
 * Suggestie voor een plant die nog ontbreekt. Gaat via Netlify Forms: het formulier "plant-suggestie"
 * staat ook verborgen in index.html, zodat Netlify het bij de build herkent.
 */
function SuggestPlant({ initial }: { initial: string }) {
  const [open, setOpen] = useState(false);
  const [plant, setPlant] = useState('');
  const [note, setNote] = useState('');
  const [bot, setBot] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const start = () => {
    setPlant(initial);
    setState('idle');
    setOpen(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!plant.trim()) return;
    setState('sending');
    try {
      if (DEMO === null) {
        const body = new URLSearchParams({ 'form-name': 'plant-suggestie', plant: plant.trim(), toelichting: note.trim(), 'bot-field': bot });
        const res = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
        if (!res.ok) throw new Error(String(res.status));
      }
      setState('sent');
      setPlant('');
      setNote('');
    } catch {
      setState('error');
    }
  };

  if (!open) {
    return (
      <div className="suggest">
        <p>Staat je plant er niet tussen?</p>
        <button className="chip" onClick={start}>Stel een plant voor</button>
      </div>
    );
  }

  if (state === 'sent') {
    return (
      <div className="suggest" role="status">
        <p><b>Bedankt voor je suggestie!</b> We bekijken of de plant in de snoeikalender past.</p>
        <button className="chip" onClick={start}>Nog een plant voorstellen</button>
      </div>
    );
  }

  return (
    <form className="suggest form" name="plant-suggestie" onSubmit={submit}>
      <h4 className="stitle">Stel een plant voor</h4>
      <label>
        <span>Naam van de plant</span>
        <input required autoFocus value={plant} onChange={(e) => setPlant(e.target.value)} placeholder="Bijvoorbeeld hibiscus" maxLength={80} />
      </label>
      <label>
        <span>Toelichting <span className="muted">(niet verplicht)</span></span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500}
          placeholder="Bijvoorbeeld welke soort, of wanneer jij hem snoeit" />
      </label>
      {/* honeypot tegen spam: mensen zien dit veld niet */}
      <label className="hp" aria-hidden="true">
        Niet invullen <input tabIndex={-1} autoComplete="off" value={bot} onChange={(e) => setBot(e.target.value)} name="bot-field" />
      </label>
      <p className="muted small">Je stuurt alleen de plantnaam en je toelichting mee, geen naam of e-mailadres.</p>
      {state === 'error' && <p className="notice">Versturen lukte niet. Probeer het later nog eens.</p>}
      <div className="actions">
        <button className="btn" type="submit" disabled={state === 'sending' || !plant.trim()}>{state === 'sending' ? 'Versturen…' : 'Versturen'}</button>
        <button className="btn ghost" type="button" onClick={() => setOpen(false)}>Annuleren</button>
      </div>
    </form>
  );
}

/*
 * Voorbeelddata voor ?demo (handig bij testen zonder internet).
 * Gewoon ?demo is een droge zomerweek, ook in de winter. Varianten: ?demo=nat (meter loopt over),
 * ?demo=droog (lege meter), ?demo=vorst, ?demo=rust (winterrust). Giften en check-ins in de demo worden apart bewaard.
 */
function demoWeather(kind: string): Day[] {
  const today = isoToday();
  const wet = kind === 'nat', dry = kind === 'droog';
  return Array.from({ length: 14 }, (_, i) => {
    const rain = wet ? [8, 12, 4, 9, 6, 3, 7, 2, 0, 1, 0, 0, 0, 0][i] : [0, 0.4, 0, 0, 1.2, 0, 0, 0, 0, 6.5, 2.1, 0, 0, 0.3][i];
    const et0 = [3.1, 3.4, 3.8, 4.2, 3.0, 3.9, 4.4, 4.1, 3.6, 1.2, 1.8, 3.3, 3.9, 4.0][i] * (dry ? 1.6 : wet ? 0.4 : kind === 'rust' ? 0.08 : 1);
    return {
      date: addDays(today, i - 7),
      rain: dry ? 0 : rain,
      et0,
      tmax: kind === 'vorst' ? 3 : 24,
      tmin: kind === 'vorst' ? -3 : 12,
      past: i < 7,
    };
  });
}
