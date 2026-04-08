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
- Enkel ruteanalyse for 1-3 generiske ruter rundt valgt startadresse.
- Sampling av fem punkter langs hver rute med egen værhenting per punkt.
- Samlet rutescore og forklaring på hvilken rute som er best akkurat nå.
- Valgt rute vises tydelig på kartet.
- Ruter bygges fra faktiske OSM-veier og prioriterer asfaltregistrert dekke.
- Brukeren velger først sted, deretter startadresse i stedet, før analyse kjøres.
- Brukeren velger min og maks km før analyse, og distansen regnes som tur/retur.

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
    route-analysis/route.ts # samlet analyse av forhåndsdefinerte ruter
    weather/route.ts      # værdata for lat/lon
  globals.css
  layout.tsx
  page.tsx                # hovedside (søk, posisjon, visning)

components/
  BestWindowCard.tsx
  LocationMap.tsx      # kart med flyttbar markør
  RouteAnalysisPanel.tsx # rutevalg og sammenligning
  ScoreBadge.tsx
  WeatherTable.tsx

data/
  routes/
    route-one.ts          # profil for Rute 1
    route-two.ts          # profil for Rute 2
    route-three.ts        # profil for Rute 3
    index.ts

lib/
  route-analysis.ts       # veisøk + sampling + værhenting for ruter
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

## Ruteanalyse

Ruteanalyse bygger videre på den samme timescoren som brukes for enkeltsteder, men først etter at brukeren har valgt et sted:

1. Brukeren søker opp et sted, for eksempel `Bodø`.
2. Deretter søker brukeren opp en konkret startadresse i det valgte stedet.
3. Vær og kart knyttes til denne startadressen.
4. Brukeren angir `min km` og `maks km` før analyse.
5. Kilometergrensen tolkes som total tur/retur-distanse.
6. Appen bruker tre generiske ruteprofiler: `Rute 1`, `Rute 2` og `Rute 3`.
7. Hver profil ligger i sin egen datafil under `data/routes/`.
8. På serveren hentes faktiske veier rundt valgt startadresse fra OpenStreetMap via Overpass.
9. Veiene filtreres på relevante `highway`-typer og prioriterer `surface=asphalt`, med harde dekker som fallback dersom området har få asfalt-taggete veier.
10. Mulige vendepunkter på disse veiene rutes deretter mot startadressen via faktisk veinett.
11. Appen bygger 1-3 tur/retur-ruter som passer innenfor valgt km-intervall.
12. Hver rute får `startplass` og `sluttplass` (vendepunkt), og total distanse inkluderer returen tilbake til start.
13. Fem punkter samples jevnt fordelt langs hver rute.
14. For hvert punkt hentes værdata fra MET via samme værlogikk som resten av appen.
15. Nærmeste tilgjengelige værtime scores med eksisterende `calculateBikeScore`.
16. Den nye funksjonen `calculateRouteScore` beregner en samlet score for ruten ved å:
   - ta snittet av punkt-scorene
   - trekke litt for stor variasjon mellom punktene, slik at ujevne ruter scorer lavere
17. Appen sammenligner rutene og viser en kort forklaring, for eksempel:
   - `Rute 1 er best nå på grunn av mindre vind og mindre risiko for nedbør.`
18. Når brukeren velger en rute i UI-et, tegnes den tydelig på kartet og kartet sentreres på ruten.

Dette gjør at ruteanalysen fortsatt er enkel, men den tar høyde for at værforhold kan variere underveis på samme tur.

## Arkitekturvalg

- **UI-komponenter**: ligger i `components/`
- **Datainnhenting**: `lib/weather.ts` + API-ruter i `app/api/`
- **Scoringslogikk**: `lib/scoring.ts`
- **Ruteanalyse**: `lib/route-analysis.ts` + `data/routes/`
- **Typer/interfaces**: `lib/types.ts`

Dette gjør løsningen enklere å vedlikeholde og bygge videre på.

## Neste steg

Forslag til konkrete utvidelser:

1. **Kart**: vis valgt sted og værsoner direkte på kart.
2. **Ruter**: la bruker lagre egne faste sykkelruter og få score per rute.
3. **Værstasjoner**: vis nærmeste målestasjoner for mer lokal nøyaktighet.
4. **Strava**: importer turhistorikk og gi personlige anbefalinger.
5. **iPhone-app**: push-varsler når forholdene blir gode.

## Driftsnotater

- Vær hentes fra MET sitt `locationforecast`-API.
- Stedssøk hentes fra OpenStreetMap Nominatim.
- Veidata for ruter hentes fra OpenStreetMap Overpass.
- API-kall cache’es for å redusere last og forbedre svartid.

