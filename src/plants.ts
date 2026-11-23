// Snoeigegevens: algemene richtlijnen voor een Nederlandse tuin.
// months = maanden (1-12) waarin je snoeit; tip = wat en hoe.

export type Plant = {
  id: string;
  name: string;
  group: 'Heesters' | 'Hagen' | 'Fruit' | 'Klimplanten' | 'Vaste planten & kruiden';
  months: number[];
  tip: string;
};

export const PLANTS: Plant[] = [
  // Heesters
  { id: 'boerenhortensia', name: 'Boerenhortensia', group: 'Heesters', months: [3, 4], tip: 'Alleen uitgebloeide bloemen wegknippen tot boven het eerste paar dikke knoppen. Niet hard terugsnoeien, dan bloeit hij niet.' },
  { id: 'pluimhortensia', name: 'Pluimhortensia', group: 'Heesters', months: [2, 3], tip: 'Flink terugsnoeien tot 2 à 3 paar knoppen boven de grond. Bloeit op nieuw hout.' },
  { id: 'rozen', name: 'Rozen (struik- en trosrozen)', group: 'Heesters', months: [3], tip: 'Terugsnoeien tot 3 à 5 ogen als de forsythia bloeit. In de zomer uitgebloeide bloemen verwijderen.' },
  { id: 'vlinderstruik', name: 'Vlinderstruik (Buddleja)', group: 'Heesters', months: [3, 4], tip: 'Hard terugsnoeien tot zo\'n 30–50 cm. Bloeit op nieuw hout.' },
  { id: 'forsythia', name: 'Forsythia', group: 'Heesters', months: [4, 5], tip: 'Direct na de bloei de oudste takken bij de grond wegnemen.' },
  { id: 'sering', name: 'Sering', group: 'Heesters', months: [5, 6], tip: 'Na de bloei uitgebloeide trossen en enkele oude takken verwijderen.' },
  { id: 'weigela', name: 'Weigela', group: 'Heesters', months: [6, 7], tip: 'Na de bloei de uitgebloeide takken terugsnoeien tot een jonge zijscheut.' },
  { id: 'rododendron', name: 'Rododendron', group: 'Heesters', months: [6], tip: 'Na de bloei uitgebloeide trossen voorzichtig uitbreken. Snoeien is verder zelden nodig.' },
  { id: 'magnolia', name: 'Magnolia', group: 'Heesters', months: [7, 8], tip: 'Zo min mogelijk snoeien. Alleen dode of storende takken, in de zomer.' },
  { id: 'buxus', name: 'Buxus', group: 'Heesters', months: [5, 6, 8], tip: 'In vorm knippen op een bewolkte dag. Let op buxusmot.' },
  { id: 'olijf', name: 'Olijfboom (pot)', group: 'Heesters', months: [4, 5], tip: 'In het voorjaar in vorm snoeien en de kroon wat uitdunnen.' },
  // Hagen
  { id: 'liguster', name: 'Ligusterhaag', group: 'Hagen', months: [5, 7, 9], tip: 'Twee tot drie keer per seizoen knippen voor een dichte haag.' },
  { id: 'beuk', name: 'Beuken- of haagbeukenhaag', group: 'Hagen', months: [6, 8], tip: 'Knippen na de eerste groei in juni en zo nodig nog eens in augustus.' },
  { id: 'taxus', name: 'Taxus', group: 'Hagen', months: [6, 8, 9], tip: 'Goed bestand tegen snoei, ook in oud hout.' },
  { id: 'conifeer', name: 'Conifeer / thuja', group: 'Hagen', months: [5, 8], tip: 'Niet tot in het oude, bruine hout knippen, want dat loopt niet meer uit.' },
  { id: 'laurier', name: 'Laurierkers', group: 'Hagen', months: [6, 8], tip: 'Na de bloei knippen. Grote bladeren liever met een snoeischaar dan met een heggenschaar.' },
  // Fruit
  { id: 'appel', name: 'Appelboom', group: 'Fruit', months: [12, 1, 2], tip: 'Wintersnoei bij vorstvrij weer: kruisende en naar binnen groeiende takken weg, kroon open houden.' },
  { id: 'peer', name: 'Perenboom', group: 'Fruit', months: [12, 1, 2], tip: 'Wintersnoei zoals bij de appel. Snoei niet te veel tegelijk.' },
  { id: 'kers', name: 'Kersenboom', group: 'Fruit', months: [7, 8], tip: 'Snoeien na de oogst in de zomer. In de winter is de kans op loodglansziekte groter.' },
  { id: 'pruim', name: 'Pruimenboom', group: 'Fruit', months: [6, 7, 8], tip: 'Snoeien in de zomer vanwege loodglansziekte. Houd het beperkt.' },
  { id: 'vijg', name: 'Vijgenboom', group: 'Fruit', months: [3, 4], tip: 'In het voorjaar bevroren en storende takken verwijderen.' },
  { id: 'druif', name: 'Druif', group: 'Fruit', months: [12, 1, 6, 7], tip: 'Hoofdsnoei in de winterrust (later bloedt hij). In de zomer lange scheuten toppen boven de trossen.' },
  { id: 'framboos-zomer', name: 'Zomerframboos', group: 'Fruit', months: [8], tip: 'Na de oogst de gedragen stengels bij de grond wegknippen. De nieuwe stengels laten staan.' },
  { id: 'framboos-herfst', name: 'Herfstframboos', group: 'Fruit', months: [2], tip: 'Alle stengels bij de grond afknippen.' },
  { id: 'blauwebes', name: 'Blauwe bes', group: 'Fruit', months: [2, 3], tip: 'Oudste, grijze takken bij de grond wegnemen. Jonge takken dragen het meeste.' },
  { id: 'rodebes', name: 'Rode bes', group: 'Fruit', months: [2, 7], tip: 'In de winter uitdunnen. In de zomer zijscheuten inkorten tot 5 blad.' },
  // Klimplanten
  { id: 'clematis3', name: 'Clematis (zomerbloeiend)', group: 'Klimplanten', months: [2, 3], tip: 'Terugsnoeien tot ca. 30 cm boven de grond. Geldt voor snoeigroep 3; voorjaarsbloeiers anders.' },
  { id: 'blauweregen', name: 'Blauwe regen', group: 'Klimplanten', months: [2, 7, 8], tip: 'Zomer: lange scheuten inkorten tot 5–6 bladeren. Februari: verder terug tot 2–3 knoppen.' },
  { id: 'klimroos', name: 'Klimroos', group: 'Klimplanten', months: [2, 3], tip: 'Zijtakken inkorten tot 2–3 ogen. Hoofdtakken zo horizontaal mogelijk leiden.' },
  { id: 'klimop', name: 'Klimop', group: 'Klimplanten', months: [4, 8], tip: 'Terugknippen waar hij te ver doorgroeit. Let op nesten in het voorjaar.' },
  // Vaste planten & kruiden
  { id: 'lavendel', name: 'Lavendel', group: 'Vaste planten & kruiden', months: [4, 8], tip: 'April: in vorm knippen, niet in het kale hout. Augustus: uitgebloeide aren wegknippen.' },
  { id: 'rozemarijn', name: 'Rozemarijn', group: 'Vaste planten & kruiden', months: [5, 6], tip: 'Na de bloei licht terugknippen, niet in het oude hout.' },
  { id: 'salie', name: 'Salie', group: 'Vaste planten & kruiden', months: [4], tip: 'In het voorjaar terugknippen tot net boven de nieuwe uitlopers.' },
  { id: 'vasteplanten', name: 'Vaste planten (border)', group: 'Vaste planten & kruiden', months: [3], tip: 'Laat uitgebloeide stengels in de winter staan voor insecten en vogels. Knip ze in maart terug.' },
  { id: 'siergras', name: 'Siergras', group: 'Vaste planten & kruiden', months: [3], tip: 'Terugknippen tot zo\'n 10–15 cm voordat het nieuwe gras uitloopt. Wintergroene soorten alleen uitkammen.' },
];

export const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
export const MONTHS_LONG = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

/** Maakt een .ics-bestand met een jaarlijks terugkerende herinnering per plant per snoeimaand. */
export function buildIcs(plants: Plant[]): string {
  const year = new Date().getFullYear();
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/[,;]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tuinwijzer//Snoeikalender//NL', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Snoeikalender'];
  for (const p of plants) {
    for (const m of p.months) {
      const d = `${year}${String(m).padStart(2, '0')}01`;
      const next = new Date(Date.UTC(year, m - 1, 2)).toISOString().slice(0, 10).replace(/-/g, '');
      lines.push(
        'BEGIN:VEVENT',
        `UID:${p.id}-${m}@tuinwijzer`,
        `DTSTAMP:${now}`,
        `DTSTART;VALUE=DATE:${d}`,
        `DTEND;VALUE=DATE:${next}`,
        'RRULE:FREQ=YEARLY',
        `SUMMARY:${esc(`✂️ Snoeien: ${p.name}`)}`,
        `DESCRIPTION:${esc(`${p.tip}\n\nSnoeimaand(en): ${p.months.map((x) => MONTHS_LONG[x - 1]).join(', ')}`)}`,
        'END:VEVENT',
      );
    }
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
