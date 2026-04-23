# RideSense

RideSense er en webapp som hjelper syklister med å finne gode tidspunkt og ruter basert på vær.
Appen bruker værprognoser fra MET, kan supplere med lokale stasjonsmålinger, og gir en enkel værscore fra 0 til 100.

## Hva appen gjør nå

### 1) Stedssøk og adressevalg

- Du kan søke etter område/sted i Norge.
- Deretter kan du søke etter konkret startadresse i valgt område.
- Appen bruker flere kilder for å finne relevante treff.

### 2) Vær og værscore

For valgt startpunkt henter appen timesdata for inntil 7 døgn og viser:

- temperatur
- nedbør
- vind
- skydekke
- værsymbol

Hver time får en **værscore (0–100)**:

- **75–100**: gode forhold
- **50–74**: ok forhold
- **0–49**: dårlige forhold

Scoren bygger på:

- nedbør (trekker ned)
- vind (trekker ned)
- vindkast (ekstra trekk ved kraftige kast, hvis vindkast finnes i prognosen)
- temperatur (best rundt 18–22 °C)
- skydekke (litt pluss når det er mindre skyer)

Ved vindkast som nærmer seg **15 m/s** bør man vurdere skjermet rute eller å droppe turen.
Ved vindkast over ca. **17–20 m/s** frarådes normalt landeveissykling.

### 3) Beste sykkelvindu

Appen regner ut:

- beste vindu i dag
- beste vindu for neste 7 dager

I tillegg finnes en lokal visning i grensesnittet som finner beste synlige segment i tabellen.

### 4) Datagrunnlag og tillit

RideSense skiller mellom:

- **kun prognose**
- **prognose + observasjon**

Hvis observasjon fra nærliggende stasjon finnes, vurderes avvik mellom observasjon og prognose.
Det påvirker både score og en enkel tillitsindikator (high/medium/low).

### 5) Kart og interaksjon

- Kart vises med OpenStreetMap.
- Markøren kan flyttes.
- Når markøren flyttes, oppdateres værdata og score automatisk for ny posisjon.

### 6) Ruteanalyse (valgt start og stopp)

Du kan analysere en valgt rute ved å sette **startadresse** og **stoppadresse**:

- appen forsøker å hente veigeometri mellom punktene (OSRM)
- hvis returrute finnes, analyseres tur/retur
- hvis returrute ikke finnes, analyseres enveisrute
- ruten samples i flere punkter
- vær hentes for punktene
- ruten får samlet rutescore per tidspunkt
- appen viser beste sykkelvindu for ruten (neste 24 timer og neste 7 døgn)

## Teknisk oversikt

- Next.js (App Router)
- React + TypeScript
- Tailwind CSS
- API-ruter i appen (server-side)

## API-endepunkter

- `GET /api/geocode` – steds- og adressesøk
- `GET /api/weather` – værdata + score for punkt
- `GET /api/route-analysis` – ruteanalyse for valgt start- og stoppunkt
- `GET /api/weather-symbol` – servering av værikoner

## Miljøvariabler

Opprett `.env.local` i prosjektroten:

```env
MET_USER_AGENT="RideSense/1.0 din-epost@domene.no"
GEOCODE_USER_AGENT="RideSense/1.0 din-epost@domene.no"
NETATMO_ACCESS_TOKEN="valgfri-token"
```

- `MET_USER_AGENT` brukes mot MET API.
- `GEOCODE_USER_AGENT` brukes ved geokoding.
- `NETATMO_ACCESS_TOKEN` er valgfri, men nødvendig om du vil bruke stasjonsobservasjoner.

## Kom i gang lokalt

```bash
npm install
npm run dev
```

Åpne så: `http://localhost:3000`

## Nyttige kommandoer

```bash
npm run lint
npm run typecheck
npm run build
npm run download:weather-symbols
pytest
```

> Merk: `download:weather-symbols` kjører et Python-skript som laster ned værikoner.
> Merk: `pytest` kjører Python-tester (for tiden enkle tester av nedlastingsskriptet).

## Prosjektstruktur (kort)

```text
app/
  api/
    geocode/route.ts
    weather/route.ts
    route-analysis/route.ts
    weather-symbol/route.ts
  page.tsx

components/
  LocationMap.tsx
  WeatherTable.tsx
  RouteAnalysisPanel.tsx
  BestWindowCard.tsx
  ScoreBadge.tsx
  ScoreModelInfo.tsx

lib/
  weather.ts
  scoring.ts
  route-analysis.ts
  station-observations.ts
  types.ts

data/
  routes/

scripts/
  download_weather_symbols.py
```

## Begrensninger akkurat nå

- Kvalitet i ruteanalyse avhenger av eksterne karttjenester.
- Hvis eksterne API-er er trege/nede, vises feilmelding i appen.
- Resultater er beslutningsstøtte og ikke en garanti for faktiske forhold.

## Videre forbedringer

- personlige preferanser i score (f.eks. høyere toleranse for vind)
- lagring av favorittruter
- bedre historikk og sammenligning av planlagte turer
- varslingsfunksjon når gode forhold oppstår
