# RideSense

RideSense er en webapp som hjelper syklister med å finne gode tidspunkt basert på vær.
Appen bruker værprognoser fra MET, kan supplere med lokale stasjonsmålinger, og gir en enkel værscore fra 0 til 100.

## Hva appen gjør nå

### 1) Stedssøk

- Du kan søke etter område/sted i Norge.
- Appen bruker geokoding for å finne relevante treff.

### 2) Vær og værscore

For valgt punkt henter appen timesdata for inntil 7 døgn og viser:

- temperatur
- nedbør
- vind
- skydekke
- værsymbol

Hver time får en **værscore (0–100)**:

- **75–100**: gode forhold
- **50–74**: ok forhold
- **0–49**: dårlige forhold

### 3) Beste sykkelvindu

Appen regner ut:

- beste vindu neste 24 timer
- beste vindu neste 7 dager

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

## Teknisk oversikt

- Next.js (App Router)
- React + TypeScript
- Tailwind CSS
- API-ruter i appen (server-side)

## API-endepunkter

- `GET /api/geocode` – stedsøk
- `GET /api/weather` – værdata + score for punkt
- `GET /api/weather-symbol` – servering av værikoner

## Miljøvariabler

Opprett `.env.local` i prosjektroten:

```env
MET_USER_AGENT="RideSense/1.0 din-epost@domene.no"
GEOCODE_USER_AGENT="RideSense/1.0 din-epost@domene.no"
NETATMO_ACCESS_TOKEN="valgfri-token"
```

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
