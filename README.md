# RideSense

RideSense er en webapp for syklister som vil finne gode tidspunkter å sykle på, basert på vær.
Appen henter prognoser fra MET, kan bruke observasjoner fra nærliggende Netatmo-stasjoner (hvis token er satt), og viser en enkel værscore fra 0 til 100.

## Hva appen gjør nå

### 1) Finn sted raskt

- Søk etter sted i Norge (løpende søk).
- Hurtigvalg med flere byer (for eksempel Oslo, Bergen, Trondheim).
- Egen knapp: **"Prøv med Oslo"**.

### 2) Værscore time for time

For valgt sted vises timeverdier for blant annet:

- temperatur
- nedbør
- vind
- vindkast
- skydekke
- værsymbol

Hver time får en **værscore (0–100)**:

- **80–100:** bra
- **60–79:** ok
- **40–59:** dårlig
- **0–39:** svært dårlig

### 3) To visninger av prognosen

- **Neste 24 timer**
  - Fokus på aktuelle sykkeltider.
  - Nattimer **00:00–06:00** skjules.
- **Neste 7 dager**
  - Dag-velger for å se én dag av gangen.
  - Oppsummert beste tidsvindu for hele perioden.

### 4) Beste sykkelvindu automatisk

Appen beregner automatisk:

- beste tidspunkt neste 24 timer
- beste tidspunkt neste 7 dager
- beste tidspunkt for valgt dag i 7-dagersvisning

### 5) Datagrunnlag og oppdatering

RideSense viser om scoren er basert på:

- **kun prognose**
- **prognose + observasjon**

Hvis observasjoner er tilgjengelig, brukes disse mot prognosen for mer realistisk score.

I tillegg viser appen:

- når data sist ble oppdatert
- hvor "gammel" værdataen er
- knapp for **"Oppdater værdata"**

### 6) Kart og interaksjon

- Kart basert på OpenStreetMap.
- Markøren er flyttbar.
- Når du drar markøren, hentes værdata automatisk for ny posisjon.

## Teknologi

- Next.js (App Router)
- React + TypeScript
- Tailwind CSS
- Leaflet (kart)
- API-ruter i appen (server-side)

## API-endepunkter

- `GET /api/geocode` – stedsøk (Nominatim, Open-Meteo, Geonorge)
- `GET /api/weather` – værdata + score for valgt punkt
- `GET /api/weather-symbol` – serverer værikoner

## Miljøvariabler

Opprett `.env.local` i prosjektroten:

```env
MET_USER_AGENT="RideSense/1.0 din-epost@domene.no"
GEOCODE_USER_AGENT="RideSense/1.0 din-epost@domene.no"
NETATMO_ACCESS_TOKEN="valgfri-token"
```

> `NETATMO_ACCESS_TOKEN` er valgfri. Uten den kjører appen kun på prognosedata.

## Kom i gang lokalt

```bash
npm install
npm run dev
```

Åpne deretter `http://localhost:3000`.

## Nyttige kommandoer

```bash
npm run lint
npm run typecheck
npm run build
npm run download:weather-symbols
pytest
```
