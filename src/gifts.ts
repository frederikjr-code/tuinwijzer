// Eigen giften en de dagelijkse check-in, bewaard in localStorage (alleen de laatste 14 dagen).
import { useCallback, useEffect, useState } from 'react';
import { type Gift, addDays } from './weather';

/** Een gift in mm per zone. Elke geregistreerde gift telt als een normale gift. */
export const NORMAL_MM: Record<string, number> = { Gras: 12, Planten: 15, Moestuin: 10, Potten: 10 };
export const giftMm = (zone: string) => NORMAL_MM[zone] ?? 10;

const KEEP_DAYS = 14;

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* opslaan is een gemak, geen vereiste */
  }
}

let seq = 0;
const newId = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`;

/**
 * Giften en check-in-antwoorden. In de demo (?demo) gebruiken we aparte sleutels,
 * zodat testklikken je echte gegevens niet beïnvloeden.
 */
export function useGardenLog(today: string, demo: boolean) {
  const prefix = demo ? 'demo:' : '';
  const oldest = addDays(today, -(KEEP_DAYS - 1));
  const [gifts, setGifts] = useState<Gift[]>(() => read<Gift[]>(prefix + 'gifts', []).filter((g) => g.date >= oldest));
  // Dagen waarop de check-in is beantwoord (ja of nee).
  const [answers, setAnswers] = useState<string[]>(() => read<string[]>(prefix + 'answers', []).filter((d) => d >= oldest));

  useEffect(() => write(prefix + 'gifts', gifts.filter((g) => g.date >= oldest)), [gifts, prefix, oldest]);
  useEffect(() => write(prefix + 'answers', answers.filter((d) => d >= oldest)), [answers, prefix, oldest]);

  const addGifts = useCallback((list: { zone: string; date: string }[]) => {
    const made = list.map(({ zone, date }) => ({ id: newId(), zone, date, mm: giftMm(zone) }));
    setGifts((g) => [...g, ...made]);
    return made.map((g) => g.id);
  }, []);
  const removeGifts = useCallback((ids: string[]) => setGifts((g) => g.filter((x) => !ids.includes(x.id))), []);
  const addAnswer = useCallback((date: string) => setAnswers((a) => (a.includes(date) ? a : [...a, date])), []);
  const removeAnswer = useCallback((date: string) => setAnswers((a) => a.filter((d) => d !== date)), []);

  /** Weten we iets over deze dag? Beantwoord in de check-in, of er is een gift geregistreerd. */
  const known = (date: string) => answers.includes(date) || gifts.some((g) => g.date === date);

  return { gifts, addGifts, removeGifts, addAnswer, removeAnswer, known };
}
