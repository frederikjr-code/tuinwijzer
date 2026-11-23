# 🌱 Tuinwijzer

**Water geven en snoeien, op het juiste moment.**

Tuinwijzer is een kleine web-app voor je eigen tuin:

- **💧 Moet ik water geven?** De app berekent een waterbalans: regen minus verdamping van de afgelopen 7 dagen, plus de verwachte regen. Je krijgt advies per zone (gras, planten, moestuin, potten) voor je eigen woonplaats. Geef je zelf water, dan tik je per zone op *Water gegeven*, of je beantwoordt de dagelijkse vraag of je gisteren water gaf. Die giften tellen mee in de balans en worden alleen in je eigen browser bewaard (14 dagen).
- **✂️ Snoeikalender:** kies welke planten je hebt en zie per maand wat je moet snoeien en hoe. Met één klik zet je de herinneringen in je eigen agenda (.ics, werkt met Google, Outlook en Apple). Je kiest uit ruim 200 planten, met filters op standplaats, grondsoort (zand, klei, veen, leem), vochtigheid en inheemse soorten. Bovenaan zie je wat je deze maand snoeit; heb je nog niets gekozen, dan toont de pagina wat er nu in het algemeen gesnoeid kan worden. De grondsoort per plant (`src/grondsoorten.ts`) is ingevuld op basis van algemene tuinpraktijk en is een richtlijn. Bronnen: de top 100 vaste planten van Ron den Dikken (Levende Tuin Academie, tuincursus.com) en de top 100 inheemse planten van Tuinplantenloods.nl.

## Techniek

| Onderdeel | Keuze |
|---|---|
| Frontend | React + TypeScript, gebouwd met Vite |
| Weerdata | [Open-Meteo](https://open-meteo.com) Forecast + Geocoding API (gratis, geen key) |
| Opslag | `localStorage`: je planten en woonplaats blijven alleen in je eigen browser |
| Hosting | Vercel, met automatische deploy bij elke push naar `main` |

Er is geen backend en er zijn geen accounts. Er worden geen persoonsgegevens verzameld.

### Hoe het wateradvies werkt
Open-Meteo levert per dag de neerslag en de referentieverdamping (ET₀, FAO-methode). Tuinwijzer telt *neerslag − verdamping* op over de afgelopen week. Zakt die balans onder een drempel per zone, dan krijg je het advies om water te geven. Potten reageren sneller en kijken daarom naar de laatste 3 dagen. Bij verwachte regen of vorst wordt het advies bijgesteld.

## Lokaal draaien

```bash
npm install
npm run dev        # ontwikkelserver op http://localhost:5173
npm run build      # productiebuild in dist/
```

Voeg `?demo` toe aan de URL om de app met voorbeeld-weerdata te bekijken.

## Disclaimer
Het snoeiadvies is een algemene richtlijn voor Nederlandse tuinen. Per soort en ras kan het afwijken.

---
Gebouwd door Frederik Vermeulen, gevibecodet met [Claude](https://claude.ai).
