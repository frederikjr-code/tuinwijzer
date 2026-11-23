import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { MONTHS, MONTHS_LONG, PLANTS, type Plant, buildIcs } from './plants';
import {
  type Day, DEFAULT_PLACE, GIETER_LITER, type Place, SLANG_LITER_PER_MIN, type Status, type WaterUnit,
  fetchWeather, searchPlace, waterAdvice,
} from './weather';

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

export default function App() {
  const [place, setPlace] = useState<Place>(() => load('place', DEFAULT_PLACE));
  const [mine, setMine] = useState<string[]>(() => load('plants', [] as string[]));

  useEffect(() => save('place', place), [place]);
  useEffect(() => save('plants', mine), [mine]);

  return (
    <main className="wrap">
      <header className="top">
        <svg className="logo" viewBox="0 0 32 32" aria-hidden="true">
          <rect x="10" y="2" width="12" height="28" rx="6" className="logo-tube" />
          <rect x="10" y="15" width="12" height="15" rx="6" className="logo-water" />
          <path d="M13 8h3M13 12h3M13 16h3" className="logo-tick" />
        </svg>
        <div>
          <h1>Tuinwijzer</h1>
          <p>Water geven en snoeien, op het juiste moment.</p>
        </div>
      </header>

      <Water place={place} setPlace={setPlace} />
      <Pruning mine={mine} setMine={setMine} />

      <footer>
        <p>
          Weerdata via <a href="https://open-meteo.com" target="_blank" rel="noreferrer">Open-Meteo</a>. Snoeiadvies is een
          algemene richtlijn, per soort en ras kan het afwijken. Je keuzes worden alleen in je eigen browser bewaard.
        </p>
        <p>Gebouwd door Frederik Vermeulen en gevibecodet met Claude.</p>
      </footer>
    </main>
  );
}

/* ---------------- Wateradvies ---------------- */

function explain(status: Status, balance: number, rain48: number) {
  if (status === 'frost') return 'Er wordt binnen drie dagen vorst verwacht, en natte grond en potten bevriezen dan sneller.';
  const past =
    balance <= -0.5
      ? `De afgelopen week verdampte er ${mm(-balance)} mm meer dan er viel`
      : balance >= 0.5
        ? `De afgelopen week viel er ${mm(balance)} mm meer regen dan er verdampte`
        : 'Regen en verdamping hielden elkaar de afgelopen week in evenwicht';
  const next = rain48 >= 0.5 ? `de komende twee dagen valt naar verwachting ${mm(rain48)} mm` : 'de komende twee dagen blijft het naar verwachting droog';
  return `${past}, en ${next}.`;
}

const STATUS_WORD: Record<Status, string> = { frost: 'Vorst', ok: 'Goed', water: 'Water geven', soon: 'Bijna droog' };

function Water({ place, setPlace }: { place: Place; setPlace: (p: Place) => void }) {
  const [days, setDays] = useState<Day[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDays(null);
    setError(null);
    const demo = new URLSearchParams(location.search).get('demo');
    (demo !== null ? Promise.resolve(demoWeather(demo)) : fetchWeather(place)).then(setDays).catch((e: Error) => setError(e.message));
  }, [place]);

  const [unit, setUnit] = useState<WaterUnit>(() => load('unit', 'gieter' as WaterUnit));
  useEffect(() => save('unit', unit), [unit]);
  const result = useMemo(() => (days ? waterAdvice(days, unit) : null), [days, unit]);
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

  return (
    <section className="section" aria-labelledby="water-h">
      <div className="sechead">
        <h2 id="water-h">Moet ik water geven?</h2>
        <PlacePicker place={place} setPlace={setPlace} />
      </div>

      {error && <p className="notice">Het weer kon niet worden opgehaald: {error}</p>}
      {!error && !result && <p className="muted loading">Het weer wordt opgehaald…</p>}

      {result && days && (
        <>
          <div className="hero">
            <div className="hero-text">
              <p className="hero-big">{headline}</p>
              <p className="hero-sub">{explain(status, result.balance, result.rain48)}</p>
            </div>
            <RainGauge value={result.balance} />
          </div>

          <div className="subhead">
            <h3>Wateradvies per zone</h3>
            <div className="seg" role="group" aria-label="Ik geef water met">
              <button aria-pressed={unit === 'gieter'} onClick={() => setUnit('gieter')}>Gieter</button>
              <button aria-pressed={unit === 'slang'} onClick={() => setUnit('slang')}>Tuinslang</button>
            </div>
          </div>
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
                </div>
              </li>
            ))}
          </ul>
          <p className="muted small">
            {unit === 'gieter'
              ? `Uitgaande van een gieter van ${GIETER_LITER} liter.`
              : `Uitgaande van een tuinslang met sproeikop, die ongeveer ${SLANG_LITER_PER_MIN} liter per minuut geeft.`}
          </p>

          <h3>Regen en verdamping per dag</h3>
          <RainChart days={days} />
        </>
      )}
    </section>
  );
}

/**
 * Verticale regenmeter: −30 tot +30 mm, 0 in het midden.
 * Boven +30 loopt de buis over (bolling en druppels over de rand), onder −30 is hij leeg met een droge bodem.
 */
function RainGauge({ value }: { value: number }) {
  const W = 170, H = 310, top = 26, bottom = 296, tx = 52, tw = 40, r = tw / 2;
  const over = value > 30, dry = value < -30;
  const y = (v: number) => top + ((30 - Math.max(-30, Math.min(30, v))) / 60) * (bottom - top);
  const level = y(value);
  const labelY = Math.max(top + 12, Math.min(bottom - 6, level + 6));
  const labelX = tx + tw + (over ? 20 : 8);
  const ticks = Array.from({ length: 13 }, (_, i) => 30 - i * 5);
  // open bovenkant, ronde bodem
  const tube = `M${tx},${top} V${bottom - r} A${r},${r} 0 0 0 ${tx + tw},${bottom - r} V${top}`;
  const R = tx + tw; // rechterwand

  return (
    <figure className="gauge">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Waterbalans afgelopen 7 dagen: ${mm(value, true)} mm${over ? ', de meter loopt over' : dry ? ', de bodem staat droog' : ''}`}>
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
              <rect x={tx} y={level} width={tw} height={bottom - level + 1} className="water" />
              {!over && <rect x={tx} y={level} width={tw} height={3} className="surface" />}
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
            <path d={`M${tx - 1},${top} Q${tx + r},${top - 16} ${R + 1},${top} Z`} className="water" />
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
        Waterbalans van de afgelopen 7 dagen
        {over && <strong>De meter loopt over.</strong>}
        {dry && <strong>De bodem staat droog.</strong>}
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

function RainChart({ days }: { days: Day[] }) {
  const [ref, width] = useWidth<HTMLDivElement>(700);
  const W = Math.max(280, width), H = 196, padL = 26, padB = 36, padT = 24;
  const dataMax = Math.max(4, ...days.map((d) => Math.max(d.rain, d.et0)));
  const step = niceStep(dataMax / 3);
  const max = Math.ceil((dataMax * 1.05) / step) * step;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const bw = (W - padL) / days.length;
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const todayIdx = days.findIndex((d) => !d.past);
  const fmt = (s: string) => new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric' }).format(new Date(s + 'T12:00:00'));

  return (
    <div className="chart" ref={ref}>
      <div className="legend"><span className="lg rain" /> Regen <span className="lg evap" /> Verdamping <span className="muted">(in mm)</span></div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Regen en verdamping per dag">
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
          return (
            <g key={d.date}>
              <rect x={x + bw * 0.16} width={bw * 0.32} y={y(d.rain)} height={y(0) - y(d.rain)} rx={Math.min(2, bw * 0.08)} className="rain"><title>{`${fmt(d.date)}: ${mm(d.rain)} mm regen`}</title></rect>
              <rect x={x + bw * 0.52} width={bw * 0.32} y={y(d.et0)} height={y(0) - y(d.et0)} rx={Math.min(2, bw * 0.08)} className="evap"><title>{`${fmt(d.date)}: ${mm(d.et0)} mm verdamping`}</title></rect>
              <text x={x + bw / 2} y={H - 20} className={`axis ${i === todayIdx ? 'today' : ''}`} textAnchor="middle">{wd}</text>
              <text x={x + bw / 2} y={H - 6} className={`axis ${i === todayIdx ? 'today' : ''}`} textAnchor="middle">{dn}</text>
            </g>
          );
        })}
      </svg>
      <p className="muted small">Links zie je de afgelopen week, rechts in het lichtere vlak de verwachting.</p>
    </div>
  );
}

/* ---------------- Snoeikalender ---------------- */

const SEASON = ['w', 'w', 'l', 'l', 'l', 'z', 'z', 'z', 'h', 'h', 'h', 'w'];

function Pruning({ mine, setMine }: { mine: string[]; setMine: (ids: string[]) => void }) {
  const [picking, setPicking] = useState(mine.length === 0);
  const month = new Date().getMonth() + 1;
  const next = (month % 12) + 1;
  const plants = PLANTS.filter((p) => mine.includes(p.id));
  const nowList = plants.filter((p) => p.months.includes(month));
  const nextList = plants.filter((p) => p.months.includes(next) && !p.months.includes(month));

  const download = () => {
    const blob = new Blob([buildIcs(plants)], { type: 'text/calendar;charset=utf-8' });
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
          <button className="chip primary" disabled={mine.length === 0} onClick={() => setPicking(false)}>Toon mijn kalender ({mine.length})</button>
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

          <div className="actions">
            <button className="btn" onClick={() => window.print()}>Printen voor in de schuur</button>
            <button className="btn ghost" onClick={download}>Zet in mijn agenda (.ics)</button>
          </div>
          <p className="muted small">
            De print past op één A4 liggend, met per plant wanneer en hoe je snoeit. De agenda werkt met Google Agenda, Outlook
            en Apple Agenda, en de herinneringen herhalen elk jaar op de 1e van de snoeimaand.
          </p>
        </>
      )}

      {plants.length > 0 && <PrintPoster plants={plants} />}
    </section>
  );
}

/** Jaaroverzicht: maandkolommen met seizoenstint. Zonder `month` geen markering (voor de print). */
function YearGrid({ plants, month }: { plants: Plant[]; month?: number }) {
  const cls = (i: number) => `s-${SEASON[i]}${i + 1 === month ? ' cur' : ''}`;
  return (
    <div className="grid12" tabIndex={0} aria-label="Snoeimaanden per plant">
      <div className="row head">
        <span className="pname" />
        {MONTHS.map((m, i) => <span key={m} className={cls(i)} aria-current={i + 1 === month ? 'date' : undefined}>{m}</span>)}
      </div>
      {plants.map((p) => (
        <div className="row" key={p.id} title={p.tip}>
          <span className="pname">{p.name}</span>
          {MONTHS.map((m, i) => (
            <span key={m} className={cls(i)}>
              {p.months.includes(i + 1) ? <i className="cut" aria-label={`snoeien in ${MONTHS_LONG[i]}`} /> : null}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

/** "maart, april en mei" */
function joinNl(items: string[]) {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} en ${items[items.length - 1]}`;
}

/** Alleen zichtbaar bij afdrukken: een poster om in de schuur of garage op te hangen. */
function PrintPoster({ plants }: { plants: Plant[] }) {
  return (
    <div className="poster" aria-hidden="true">
      <div className="poster-head">
        <h2>Snoeikalender</h2>
        <p>Een vakje betekent: deze maand snoeien.</p>
      </div>
      <YearGrid plants={plants} />
      <ol className="poster-tips">
        {plants.map((p) => (
          <li key={p.id}>
            <b>{p.name}</b> <span className="when">snoeien in {joinNl(p.months.map((m) => MONTHS_LONG[m - 1]))}</span>
            <p>{p.tip}</p>
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
        <p>{p.tip}</p>
      </div>
    </li>
  );
}

function PlantPicker({ mine, setMine }: { mine: string[]; setMine: (ids: string[]) => void }) {
  const [q, setQ] = useState('');
  const groups = [...new Set(PLANTS.map((p) => p.group))];
  const match = (p: Plant) => p.name.toLowerCase().includes(q.toLowerCase());
  const toggle = (id: string) => setMine(mine.includes(id) ? mine.filter((x) => x !== id) : [...mine, id]);

  return (
    <div className="picker">
      <input aria-label="Zoek een plant" placeholder="Zoek een plant…" value={q} onChange={(e) => setQ(e.target.value)} />
      {groups.map((g) => {
        const list = PLANTS.filter((p) => p.group === g && match(p));
        if (list.length === 0) return null;
        return (
          <div key={g}>
            <h4>{g}</h4>
            <div className="chips">
              {list.map((p) => (
                <button key={p.id} className={`pchip ${mine.includes(p.id) ? 'on' : ''}`} aria-pressed={mine.includes(p.id)} onClick={() => toggle(p.id)}>
                  {mine.includes(p.id) ? '✓ ' : '+ '}{p.name}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/*
 * Voorbeelddata voor ?demo (handig bij testen zonder internet).
 * Varianten: ?demo=nat (meter loopt over), ?demo=droog (lege meter), ?demo=vorst.
 */
function demoWeather(kind: string): Day[] {
  const today = new Date();
  const wet = kind === 'nat', dry = kind === 'droog';
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today.getTime() + (i - 7) * 86400_000);
    const rain = wet ? [8, 12, 4, 9, 6, 3, 7, 2, 0, 1, 0, 0, 0, 0][i] : [0, 0.4, 0, 0, 1.2, 0, 0, 0, 0, 6.5, 2.1, 0, 0, 0.3][i];
    const et0 = [3.1, 3.4, 3.8, 4.2, 3.0, 3.9, 4.4, 4.1, 3.6, 1.2, 1.8, 3.3, 3.9, 4.0][i] * (dry ? 1.6 : wet ? 0.4 : 1);
    return {
      date: d.toISOString().slice(0, 10),
      rain: dry ? 0 : rain,
      et0,
      tmax: kind === 'vorst' ? 3 : 24,
      tmin: kind === 'vorst' ? -3 : 12,
      past: i < 7,
    };
  });
}
