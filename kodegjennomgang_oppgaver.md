# Kodegjennomgang – fire fullførte oppgaver

De fire oppgavene fra kodegjennomgangen er nå utført. Her er en enkel oversikt
over hva som ble rettet og hvordan rettingene kontrolleres.

## 1) Skrivefeil: «nar» er endret til «når»

**Hva er problemet?**

En feilmelding i testen sier «nar fil finnes». Det norske ordet skal være «når».
Feilen påvirker ikke selve programmet, men gjør testen mindre ryddig og
feilmeldingen vanskeligere å lese dersom testen feiler.

**Hvor finnes det?**

- `tests/test_download_weather_symbols.py`, i testen
  `test_download_symbol_skips_existing_file_without_overwrite`.

**Løsning:**

- Teksten er endret til «urlopen skal ikke kalles når fil finnes».

**Ferdig når:**

- Ordet er rettet uten at testens oppførsel er endret.
- `pytest` fortsatt passerer.

## 2) Bug: SVG-innhold kontrolleres før en fil lagres

**Hva er problemet?**

Nedlastingen godtar alle svar som inneholder minst ett tegn. Hvis nettjenesten
for eksempel svarer med en HTML-feilside og status 200, blir feilsiden lagret med
`.svg`-endelse. Ved overskriving slettes dessuten den gamle, fungerende filen før
det nye innholdet skrives. En bruker kan derfor ende opp med et ødelagt værikon.

**Hvor finnes det?**

- `scripts/download_weather_symbols.py`, i `_fetch_svg_bytes` og
  `download_symbol`.

**Løsning:**

- De nedlastede bytene parses med `xml.etree.ElementTree` før noe lagres.
- Bare XML der rotelementet faktisk heter `svg`, med eller uten SVG-navnerom,
  godtas.
- Innholdet skrives først til en midlertidig fil. Målfila erstattes først etter
  vellykket validering, slik at et fungerende ikon beholdes ved ugyldige svar.

**Ferdig når:**

- Gyldig SVG lagres som før.
- Tomt innhold, ugyldig XML og HTML avvises.
- Et eksisterende, gyldig ikon ikke slettes når et nytt svar er ugyldig.
- `pytest` passerer uten nettilgang.

## 3) Dokumentasjonsavvik: README viser de faktiske scoregrensene

**Hva er problemet?**

README beskriver fire nivåer: «bra» fra 80 poeng, «ok» fra 60, «dårlig» fra 40
og «svært dårlig» under 40. Koden lager derimot bare tre nivåer: «bra» fra 75,
«ok» fra 50 og «dårlig» under 50. En bruker kan derfor lese én forklaring og se
en annen vurdering i appen.

**Hvor finnes det?**

- `README.md`, under «Værscore time for time».
- `lib/scoring.ts`, i `getScoreLabel`.
- `components/ScoreBadge.tsx`, der de tre nivåene vises.

**Løsning:**

- README beskriver nå de samme tre nivåene som appen bruker: «bra» fra 75 poeng,
  «ok» fra 50 poeng og «dårlig» under 50 poeng.

**Ferdig når:**

- README og appen bruker samme antall nivåer, navn og poenggrenser.
- En ikke-teknisk bruker kan forstå hvilken merkelapp en poengsum får.

## 4) Testforbedring: `overwrite=True` testes uten ekte nettverk

**Hva er problemet?**

Testene kontrollerer at en eksisterende fil beholdes når overskriving er slått
av, men de kontrollerer ikke motsatt tilfelle. Dermed kan funksjonen slutte å
respektere `overwrite=True` uten at testene oppdager det.

**Hvor finnes det?**

- `tests/test_download_weather_symbols.py`.
- `scripts/download_weather_symbols.py`, i `download_symbol`.

**Løsning:**

- En ny `pytest`-test oppretter en gammel SVG, bruker en falsk nedlasting og
  kontrollerer at `overwrite=True` lagrer det nye innholdet.
- En ekstra test kontrollerer at et HTML-svar avvises uten at det gamle ikonet
  blir ødelagt.
- Testene bruker ikke internett.

**Ferdig når:**

- Testen feiler dersom `overwrite=True` ignoreres.
- Testen er stabil uten nettverk.
- `pytest` passerer.
