# RideSense – App Store-klargjøring

Dette dokumentet samler forslag til App Store-metadata, personvern, teknisk løp og innsending.

## Anbefalt lanseringsstrategi

RideSense er i dag en Next.js-app med server-side API-ruter. En ren WebView-wrapper rundt nettstedet er teknisk enkel, men bør ikke være sluttmålet. Apple krever at en app har funksjonalitet, innhold og UI som løfter den utover en ompakket nettside.

Anbefalt rekkefølge:

1. Stabiliser webappen og publiser den på en permanent HTTPS-adresse.
2. Test PWA/mobilopplevelse på iPhone.
3. Lag en iOS-klient som bruker samme RideSense-backend.
4. Legg til minst én tydelig iOS-spesifikk verdi før App Store-innsending, for eksempel:
   - frivillig bruk av enhetens posisjon som startpunkt,
   - lokale varsler/push når et godt sykkelvindu oppstår,
   - deling av valgt rute/værvindu via iOS share sheet,
   - favoritter lagret sikkert på enheten.
5. Test via TestFlight.
6. Send til App Review.

## Foreløpig App Store-metadata

### Navn
RideSense

### Undertittel
Sykkelvær og ruteanalyse

### Promotional text
Finn de beste timene for sykkelturen. RideSense kombinerer vær, vind og ruteanalyse i én enkel score.

### Beskrivelse
RideSense hjelper deg å velge når og hvor du bør sykle.

Velg et sted eller analyser en rute, og få en tydelig vurdering av forholdene basert på blant annet vind, nedbør og temperatur. RideSense viser vær time for time, beregner en enkel score og finner de beste sykkelvinduene fremover.

Funksjoner:
- værscore for sykling
- timesprognose og 7-dagers oversikt
- beste sykkelvindu
- kartbasert valg av startpunkt
- ruteanalyse mellom start og stopp
- vurdering av vind, nedbør og temperatur
- datakvalitet og tidspunkt for siste oppdatering

RideSense er beslutningsstøtte. Faktiske vær- og veiforhold kan avvike fra prognosene, og brukeren må alltid vurdere sikkerheten selv.

### Søkeord – utkast
sykkelvær,sykling,vær,vind,rute,landevei,sykkel,ruteanalyse,prognose

### Primær kategori – forslag
Weather

### Sekundær kategori – forslag
Sports

### Aldersklassifisering – foreløpig
Forventet laveste relevante aldersklassifisering, forutsatt at appen ikke får brukerinnhold, chat, gambling, kjøp eller annet alderssensitivt innhold. Endelig klassifisering bestemmes ved å svare på Apples spørreskjema.

## URL-er

Når produksjonsdomenet er klart:

- Privacy Policy URL: `https://<produksjonsdomene>/privacy`
- Support URL: `https://<produksjonsdomene>/support`
- Marketing URL: `https://<produksjonsdomene>/`

## Personvern – foreløpig vurdering

Dagens webapp:

- krever ikke brukerkonto,
- har ikke egen brukerdatabase for konto/profil,
- bruker lokal lagring for onboarding-status,
- behandler søketekst, adresser og koordinater når brukeren ber om stedssøk, vær eller ruteanalyse,
- bruker eksterne vær-, kart- og geokodingstjenester,
- har ikke dokumentert reklame- eller analyse-SDK i dagens repo.

Før App Store-innsending må denne vurderingen kontrolleres mot den ferdige iOS-builden og alle tredjeparts-SDK-er.

## Eksterne tjenester som må vurderes i personvernarbeidet

Basert på dagens kode og dokumentasjon kan RideSense bruke:

- MET
- Kartverket / GeoNorge
- OpenStreetMap / Nominatim
- Open-Meteo
- OSRM
- eventuelle observasjonskilder som senere aktiveres

## iOS-spesifikke personvernvalg

Hvis appen får en funksjon som bruker enhetens posisjon:

- brukeren skal aktivt gi tillatelse,
- appen skal fungere med manuelt stedvalg når det er praktisk mulig,
- `NSLocationWhenInUseUsageDescription` må ha en tydelig forklaring,
- App Store privacy-svar og personvernerklæring må oppdateres.

Forslag til tillatelsestekst:

> RideSense bruker posisjonen din når du ber om det, for å finne vær og sykkelforhold der du befinner deg.

## App Review-notat – utkast

RideSense provides cycling-specific weather scoring and route analysis for locations in Norway. The user can search for a location, select a route, review hourly weather conditions, and receive a cycling score and recommended time window. No account or purchase is required.

If location access is included in the submitted build, it is optional and used only when the user chooses to use the current location as the starting point.

## Skjermbilder – anbefalt innhold

1. Startskjerm med RideSense og stedvalg.
2. Værscore og beste sykkelvindu.
3. Timesprognose med vind/nedbør/temperatur.
4. Kart og valgt startpunkt.
5. Ruteanalyse med samlet score.

Skjermbildene skal tas fra den faktiske iOS-builden som sendes inn.

## Release-sjekkliste

### Web/backend
- [ ] Permanent HTTPS-produksjonsadresse.
- [ ] Miljøvariabler satt korrekt i produksjon.
- [ ] Feilhåndtering testet ved nedetid hos eksterne tjenester.
- [ ] Rate limits og caching kontrollert.
- [ ] Ingen hemmeligheter eksponert i klientbundlen.

### Kvalitet
- [ ] `npm run typecheck` grønn.
- [ ] lint grønn.
- [ ] `npm run build` grønn.
- [ ] Testet på små og store iPhone-skjermer.
- [ ] Testet med tregt/dårlig nett.
- [ ] Testet tomme og ugyldige søk.
- [ ] Testet feil fra vær- og rutetjenester.

### PWA/web
- [x] Web manifest lagt til.
- [x] Personvernside lagt til.
- [x] Supportside lagt til.
- [x] Lenker til personvern/support synlige i appen.
- [ ] Endelig 1024×1024 appikon.
- [ ] PNG-ikoner for PWA/iOS.

### iOS
- [ ] Bundle ID valgt.
- [ ] iOS-prosjekt opprettet.
- [ ] Native verdi utover ren WebView lagt til.
- [ ] Privacy manifest kontrollert.
- [ ] Tillatelsestekster kontrollert.
- [ ] Test på fysisk iPhone.
- [ ] Archive/build uten feil.
- [ ] TestFlight-build lastet opp.

### App Store Connect
- [ ] Apple Developer-medlemskap aktivt.
- [ ] App opprettet i App Store Connect.
- [ ] Navn/undertittel/beskrivelse lagt inn.
- [ ] Privacy Policy URL lagt inn.
- [ ] Support URL lagt inn.
- [ ] App Privacy-svar ferdigstilt.
- [ ] Aldersklassifisering ferdigstilt.
- [ ] Content Rights besvart.
- [ ] Export Compliance besvart.
- [ ] Skjermbilder lastet opp.
- [ ] Review Notes lagt inn.
- [ ] Build valgt og sendt til review.

## Ikke gjør dette før første godkjenning med mindre det er nødvendig

For å holde første versjon enkel bør vi unngå å introdusere følgende bare for lanseringen:

- betaling/abonnement,
- tredjepartsinnlogging,
- sosial feed/chat,
- omfattende brukerprofiler,
- reklame-SDK,
- unødvendig sporing/analytics.

Disse kan legges til senere dersom produktet faktisk trenger dem.
