import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { MONTHS, MONTHS_LONG, PLANTS, type Plant, buildIcs } from './plants';
import { type Day, DEFAULT_PLACE, type Place, fetchWeather, searchPlace, waterAdvice } from './weather';

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

export default function App() {
  const [place, setPlace] = useState<Place>(() => load('place', DEFAULT_PLACE));
  const [mine, setMine] = useState<string[]>(() => load('plants', [] as string[]));

  useEffect(() => save('place', place), [place]);
  useEffect(() => save('plants', mine), [mine]);

  return (
    <main className="wrap">
      <header className="top">
        <div className="logo">🌱</div>
        <div>
          <h1>Tuinwijzer</h1>
          <p>Water geven en snoeien, op het juiste moment.</p>
        </div>
      </header>

      <Water place={place} setPlace={setPlace} />
      <Pruning mine={mine} setMine={setMine} />

      <footer>
        Weerdata via <a href="https://open-meteo.com" target="_blank" rel="noreferrer">Open-Meteo</a>. Snoeiadvies is een
        algemene richtlijn, per soort en ras kan het afwijken. Je keuzes worden alleen in je eigen browser bewaard.
        <br />
        Gebouwd door Frederik Vermeulen · gevibecodet met Claude
      </footer>
    </main>
  );
}

/* ---------------- Wateradvies ---------------- */

function Water({ place, setPlace }: { place: Place; setPlace: (p: Place) => void }) {
  const [days, setDays] = useState<Day[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDays(null);
    setError(null);
    const demo = new URLSearchParams(location.search).has('demo');
    (demo ? Promise.resolve(demoWeather()) : fetchWeather(place)).then(setDays).catch((e: Error) => setError(e.message));
  }, [place]);

  const result = useMemo(() => (days ? waterAdvice(days) : null), [days]);
  const worst = result?.advice.find((a) => a.status === 'water') ?? result?.advice.find((a) => a.status === 'frost') ?? result?.advice.find((a) => a.status === 'soon');
  const headline = !result
    ? ''
    : worst?.status === 'water'
      ? 'Vandaag water geven'
      : worst?.status === 'frost'
        ? 'Niet water geven: vorst op komst'
        : worst?.status === 'soon'
          ? 'Nog niet, maar het wordt droger'
          : 'Geen water nodig';

  return (
    <section className="card">
      <div className="cardhead">
        <h2>💧 Moet ik water geven?</h2>
        <PlacePicker place={place} setPlace={setPlace} />
      </div>

      {error && <p className="notice">Het weer kon niet worden opgehaald: {error}</p>}
      {!error && !result && <p className="muted">Weer ophalen…</p>}

      {result && days && (
        <>
          <div className={`headline ${worst?.status ?? 'ok'}`}>
            <span className="big">{headline}</span>
            <span className="sub">
              Waterbalans afgelopen 7 dagen: <b>{result.balance > 0 ? '+' : ''}{result.balance.toFixed(1)} mm</b>
              {' · '}verwachte regen komende 48 uur: <b>{result.rain48.toFixed(1)} mm</b>
            </span>
          </div>
          <div className="zones">
            {result.advice.map((a) => (
              <div key={a.zone} className={`zone ${a.status}`}>
                <div className="zhead"><span>{a.icon}</span><b>{a.zone}</b><span className={`dot ${a.status}`} /></div>
                <p>{a.text}</p>
              </div>
            ))}
          </div>
          <RainChart days={days} />
        </>
      )}
    </section>
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
      <button className="chip" onClick={() => setOpen(!open)}>📍 {place.name} ▾</button>
      {open && (
        <div className="popover">
          <input autoFocus placeholder="Zoek je woonplaats…" value={q} onChange={(e) => setQ(e.target.value)} />
          {hits.map((h) => (
            <button key={`${h.lat},${h.lon}`} className="hit" onClick={() => choose(h)}>{h.name}</button>
          ))}
          <button className="hit locate" onClick={locate}>🎯 Gebruik mijn huidige locatie</button>
        </div>
      )}
    </div>
  );
}

function RainChart({ days }: { days: Day[] }) {
  const W = 700, H = 170, padL = 30, padB = 34, padT = 10;
  const max = Math.max(4, ...days.map((d) => Math.max(d.rain, d.et0))) * 1.1;
  const bw = (W - padL) / days.length;
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const todayIdx = days.findIndex((d) => !d.past);
  const fmt = (s: string) => new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric' }).format(new Date(s + 'T12:00:00'));

  return (
    <div className="chart">
      <div className="legend"><span className="lg rain" /> Regen (mm) <span className="lg evap" /> Verdamping (mm)</div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Regen en verdamping per dag">
        {todayIdx > 0 && <rect x={padL + todayIdx * bw} y={padT} width={W - padL - todayIdx * bw} height={H - padT - padB} className="future" />}
        {[0, max / 2].map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} className="grid" />
            <text x={padL - 5} y={y(t) + 4} className="axis" textAnchor="end">{t.toFixed(0)}</text>
          </g>
        ))}
        {days.map((d, i) => {
          const x = padL + i * bw;
          return (
            <g key={d.date}>
              <rect x={x + bw * 0.14} width={bw * 0.36} y={y(d.rain)} height={y(0) - y(d.rain)} rx={2} className="rain"><title>{`${fmt(d.date)}: ${d.rain.toFixed(1)} mm regen`}</title></rect>
              <rect x={x + bw * 0.52} width={bw * 0.34} y={y(d.et0)} height={y(0) - y(d.et0)} rx={2} className="evap"><title>{`${fmt(d.date)}: ${d.et0.toFixed(1)} mm verdamping`}</title></rect>
              <text x={x + bw / 2} y={H - 18} className={`axis ${i === todayIdx ? 'today' : ''}`} textAnchor="middle">{fmt(d.date).split(' ')[0]}</text>
              <text x={x + bw / 2} y={H - 5} className={`axis ${i === todayIdx ? 'today' : ''}`} textAnchor="middle">{fmt(d.date).split(' ')[1]}</text>
            </g>
          );
        })}
      </svg>
      <div className="muted small">Afgelopen week links, verwachting rechts (lichter vlak).</div>
    </div>
  );
}

/* ---------------- Snoeikalender ---------------- */

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
    <section className="card">
      <div className="cardhead">
        <h2>✂️ Snoeikalender</h2>
        <button className="chip" onClick={() => setPicking(!picking)}>{picking ? 'Klaar' : `Mijn planten (${mine.length}) ✎`}</button>
      </div>

      {picking && <PlantPicker mine={mine} setMine={setMine} />}

      {!picking && plants.length === 0 && <p className="muted">Kies eerst welke planten je in je tuin hebt.</p>}

      {!picking && plants.length > 0 && (
        <>
          <div className="now">
            <h3>Deze maand ({MONTHS_LONG[month - 1]})</h3>
            {nowList.length === 0 ? (
              <p className="muted">Niets te snoeien. Even genieten van de tuin.</p>
            ) : (
              nowList.map((p) => <PlantTip key={p.id} p={p} />)
            )}
            {nextList.length > 0 && (
              <>
                <h3 className="nexth">Volgende maand ({MONTHS_LONG[next - 1]})</h3>
                {nextList.map((p) => <PlantTip key={p.id} p={p} />)}
              </>
            )}
          </div>

          <div className="grid12">
            <div className="row head">
              <span />
              {MONTHS.map((m, i) => <span key={m} className={i + 1 === month ? 'cur' : ''}>{m}</span>)}
            </div>
            {plants.map((p) => (
              <div className="row" key={p.id} title={p.tip}>
                <span className="pname">{p.name}</span>
                {MONTHS.map((m, i) => (
                  <span key={m} className={`cell ${i + 1 === month ? 'cur' : ''}`}>{p.months.includes(i + 1) ? <i className="cut" /> : null}</span>
                ))}
              </div>
            ))}
          </div>

          <button className="btn" onClick={download}>📅 Zet in mijn agenda (.ics)</button>
          <p className="muted small">Werkt met Google Agenda, Outlook en Apple Agenda. Herinneringen herhalen elk jaar op de 1e van de snoeimaand.</p>
        </>
      )}
    </section>
  );
}

function PlantTip({ p }: { p: Plant }) {
  return (
    <div className="tip">
      <b>{p.name}</b>
      <p>{p.tip}</p>
    </div>
  );
}

function PlantPicker({ mine, setMine }: { mine: string[]; setMine: (ids: string[]) => void }) {
  const [q, setQ] = useState('');
  const groups = [...new Set(PLANTS.map((p) => p.group))];
  const match = (p: Plant) => p.name.toLowerCase().includes(q.toLowerCase());
  const toggle = (id: string) => setMine(mine.includes(id) ? mine.filter((x) => x !== id) : [...mine, id]);

  return (
    <div className="picker">
      <input placeholder="Zoek een plant…" value={q} onChange={(e) => setQ(e.target.value)} />
      {groups.map((g) => {
        const list = PLANTS.filter((p) => p.group === g && match(p));
        if (list.length === 0) return null;
        return (
          <div key={g}>
            <h4>{g}</h4>
            <div className="chips">
              {list.map((p) => (
                <button key={p.id} className={`pchip ${mine.includes(p.id) ? 'on' : ''}`} onClick={() => toggle(p.id)}>
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

/* Voorbeelddata voor ?demo (handig bij testen zonder internet) */
function demoWeather(): Day[] {
  const today = new Date();
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today.getTime() + (i - 7) * 86400_000);
    const rain = [0, 0.4, 0, 0, 1.2, 0, 0, 0, 0, 6.5, 2.1, 0, 0, 0.3][i];
    return {
      date: d.toISOString().slice(0, 10),
      rain,
      et0: [3.1, 3.4, 3.8, 4.2, 3.0, 3.9, 4.4, 4.1, 3.6, 1.2, 1.8, 3.3, 3.9, 4.0][i],
      tmax: 24,
      tmin: 12,
      past: i < 7,
    };
  });
}
