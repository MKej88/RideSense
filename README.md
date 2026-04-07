# RideSense MVP

RideSense er en produksjonsklar MVP bygget med Next.js som hjelper landeveissyklister i Norge med å finne gode sykkeltidspunkt de neste 24 timene.

## Funksjoner

- Søk etter sted i Norge.
- Knapp for `Bruk min posisjon`.
- Viser værtime-for-time for neste 24 timer:
  - temperatur
  - nedbør
  - vindhastighet
  - vindkast (hvis tilgjengelig)
  - vindretning (hvis tilgjengelig)
- Beregner sykkelscore (0–100) per time.
- Fargekoder score:
  - grønn = gode forhold
  - gul = greie forhold
  - rød = dårlige forhold
- Finner og viser `Beste tidspunkt i dag`.
- Kort forklaring på hvorfor tidsvinduet er best.
- Feilhåndtering, tomtilstand og enkel responsiv UI.
- Interaktivt kart med OpenStreetMap-kartlag og flyttbar markør.
- Automatisk oppdatering av vær og sykkelscore når markøren flyttes.

## Teknologi

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Leaflet lastet fra CDN (interaktiv kartvisning)
- API-ruter på server-siden (`/api/geocode`, `/api/weather`)
- Caching via `fetch(..., { next: { revalidate } })` og `Cache-Control`

## Kom i gang lokalt

### 1) Installer avhengigheter

```bash
npm install
```

### 2) Sett miljøvariabler

Opprett en fil `.env.local` i prosjektroten:

```env
MET_USER_AGENT="RideSense/1.0 din-epost@domene.no"
GEOCODE_USER_AGENT="RideSense/1.0 din-epost@domene.no"
```

> `User-Agent` er anbefalt av både MET og Nominatim.

### 3) Kjør utviklingsserver

```bash
npm run dev
```

Åpne deretter [http://localhost:3000](http://localhost:3000).

### 4) Kjør sjekker

```bash
npm run typecheck
npm run lint
npm run build
```

## Prosjektstruktur

```text
app/
  api/
    geocode/route.ts      # stedssøk mot Nominatim
    weather/route.ts      # værdata for lat/lon
  globals.css
  layout.tsx
  page.tsx                # hovedside (søk, posisjon, visning)

components/
  BestWindowCard.tsx
  LocationMap.tsx      # kart med flyttbar markør
  ScoreBadge.tsx
  WeatherTable.tsx

lib/
  scoring.ts              # scoringsmodell v1 + beste tidsvindu
  types.ts                # delte typer/interfaces
  weather.ts              # datainnhenting/transformering av værdata
```


## Kartløsning (nytt)

- Kartkomponenten er skilt ut i `components/LocationMap.tsx` for å beholde arkitekturen.
- Kartgrunnlaget kommer fra åpne OpenStreetMap-kartfliser (`tile.openstreetmap.org`).
- Markøren kan dras til ny posisjon. Når brukeren slipper markøren, hentes nye værdata automatisk fra `/api/weather`, og sykkelscoren beregnes på nytt med eksisterende logikk.
- Kartet er mobilvennlig med responsiv høyde (`h-72` på mobil, `h-96` på større skjermer).

## Scoringsmodell v1 (enkelt forklart)

Scoren starter på `100` for hver time. Deretter trekkes poeng for forhold som gjør sykling dårligere:

- **Regn**: mer regn gir større trekk.
- **Vind**: moderat og sterk vind trekker tydelig ned.
- **Vindkast**: ekstra trekk ved kraftige kast.
- **Temperatur**:
  - best rundt 12–22 °C
  - trekk for kaldt, varmt og svært varmt

Alle terskler ligger samlet i `SCORE_THRESHOLDS` i `lib/scoring.ts`, så de er enkle å justere senere.

## Arkitekturvalg

- **UI-komponenter**: ligger i `components/`
- **Datainnhenting**: `lib/weather.ts` + API-ruter i `app/api/`
- **Scoringslogikk**: `lib/scoring.ts`
- **Typer/interfaces**: `lib/types.ts`

Dette gjør løsningen enklere å vedlikeholde og bygge videre på.

## Neste steg

Forslag til konkrete utvidelser:

1. **Kart**: vis valgt sted og værsoner direkte på kart.
2. **Ruter**: la bruker lagre faste sykkelruter og få score per rute.
3. **Værstasjoner**: vis nærmeste målestasjoner for mer lokal nøyaktighet.
4. **Strava**: importer turhistorikk og gi personlige anbefalinger.
5. **iPhone-app**: push-varsler når forholdene blir gode.

## Driftsnotater

- Vær hentes fra MET sitt `locationforecast`-API.
- Stedssøk hentes fra OpenStreetMap Nominatim.
- API-kall cache’es for å redusere last og forbedre svartid.

